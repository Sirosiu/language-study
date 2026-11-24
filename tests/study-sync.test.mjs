import test from 'node:test';
import assert from 'node:assert/strict';
import { StudyLedger } from '../shared/study-ledger.js';
import { LANGUAGES, normaliseItem, answerRecord, sameContent, customQuestion, uuid } from '../shared/study-model.js';
import { privateMarkdown, parsePrivateMarkdown, replacePrivateMarkdown } from '../shared/study-markdown.js';
import { StudyService } from '../shared/study-service.js';
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
const user={id:'00000000-0000-4000-8000-000000000001'};
const note=(markdown,revision=0)=>normaliseItem({key:'note:fr',language:'fr',kind:'note',data:{markdown},revision});
function server(){
  const rows={};let fail=false,hook=null;
  return {rows,setFail:v=>fail=v,setHook:v=>hook=v,client:{
    from(){return {select(){return this;},order(){return this;},async range(start,end){return fail?{error:{message:'Network unavailable'}}:{data:Object.values(rows).sort((a,b)=>a.key.localeCompare(b.key)).slice(start,end+1)};}};},
    async rpc(_name,p){
      if(fail)return {error:{message:'Network unavailable'}};
      if(hook){const fn=hook;hook=null;await fn();}
      const old=rows[p.p_key],item=normaliseItem({key:p.p_key,language:p.p_language,kind:p.p_kind,data:p.p_data,deleted:p.p_deleted,revision:(old?.revision||0)+1,origin:p.p_origin});
      if(old&&sameContent(old,item))return {data:{ok:true,item:old}};
      if((old?.revision||0)!==p.p_expected_revision)return {data:{conflict:true,current:old||null}};
      rows[item.key]=item;return {data:{ok:true,item}};
    },
  }};
}
function device(s,storage=store()){const l=new StudyLedger(s.client,{storage});l.activate(user);return l;}
test('all record types and languages round-trip multiline Unicode Markdown without losing fences or markers',()=>{
  for(const code of Object.keys(LANGUAGES)){
    const q={id:`${code}-Q0001`,type:'translate',translation:'Translate\n<!-- ls:/item -->',answer:'é أ 日本語',native:'model'};
    const answer=answerRecord(code,q,'Multiline\n~~~~~\n<!-- ls:/item -->\n日本語','submitted','review');answer.revision=9;
    const notebook=normaliseItem({key:'note:'+code,language:code,kind:'note',data:{markdown:'# My note\n\n<!-- ls:notebook-end -->\n~~marks~~'},revision:2});
    const question=normaliseItem({key:`question:${code}-U-00000000-0000-4000-8000-000000000099`,language:code,kind:'question',data:{type:'written',title:'Personal',prompt:'Write\n~~~~',native:'',translation:'',answer:'A model',explanation:'Why'}});
    const parsed=parsePrivateMarkdown(privateMarkdown(code,[answer,notebook,question]),code);
    for(const item of [answer,notebook,question])assert.deepEqual(parsed.find(i=>i.key===item.key),item);
    assert.equal(customQuestion(question).custom,true);
  }
});
test('replacement preserves all public course text and rejects broken private markers',()=>{
  const baseline='# My course\n\nLong public grammar';
  const first=replacePrivateMarkdown(baseline,'fr',[note('First')]);
  const next=replacePrivateMarkdown(first,'fr',[note('Second')]);
  assert(next.startsWith(baseline));assert.equal(parsePrivateMarkdown(next,'fr')[0].data.markdown,'Second');
  assert.throws(()=>parsePrivateMarkdown(next.replace('<!-- ls:/item -->',''),'fr'));
  assert.throws(()=>replacePrivateMarkdown('<!-- language-study:private --> damaged','fr',[]));
});
test('model rejects identifiers, unsafe sources, malformed question types and cross-language answers',()=>{
  assert.throws(()=>answerRecord('fr',{id:'de-Q0001'},'text'));
  assert.throws(()=>normaliseItem({key:'answer:fr-Q0000',language:'fr',kind:'answer',data:{answer:'',status:'draft',mark:''}}));
  assert.throws(()=>normaliseItem({key:'word:fr:test',language:'fr',kind:'word',data:{word:'test',source:'javascript:alert(1)'}}));
  assert.throws(()=>normaliseItem({key:'note:xx',language:'xx',kind:'note',data:{markdown:''}}));
});
test('signed-out writes fail and caches remain isolated by account',async()=>{
  const s=server(),storage=store(),l=device(s,storage);l.put(note('Private'));l.activate(null);
  assert.deepEqual(l.items(),[]);assert.throws(()=>l.put(note('Fail')));
  l.activate({id:'other-user'});assert.equal(l.get('note:fr'),null);
  l.activate(user);assert.equal(l.get('note:fr').data.markdown,'Private');
});
test('offline drafts survive reload then sync to another device',async()=>{
  const s=server(),storage=store();const a=device(s,storage);s.setFail(true);a.put(note('Offline draft'));await a.sync();
  assert.equal(a.status().pending,1);assert.match(a.status().error,/Network/);
  const reloaded=device(s,storage);assert.equal(reloaded.get('note:fr').data.markdown,'Offline draft');s.setFail(false);await reloaded.sync();
  const b=device(s);await b.sync();assert.equal(b.get('note:fr').data.markdown,'Offline draft');assert.equal(reloaded.status().pending,0);
});
test('an edit while a save is in flight is rebased and sent, including an early Realtime acknowledgement',async()=>{
  const s=server(),a=device(s);a.put(note('First'));
  s.setHook(()=>{a.put(note('Newer edit'));});await a.sync();
  assert.equal(s.rows['note:fr'].data.markdown,'Newer edit');assert.equal(s.rows['note:fr'].revision,2);assert.equal(a.status().pending,0);
  a.put(note('Third'));
  s.setHook(()=>{a.put(note('Fourth'));a.receive({...note('Third',3),origin:[...a.flight.values()][0].origin});});await a.sync();
  assert.equal(s.rows['note:fr'].data.markdown,'Fourth');assert.equal(a.status().pending,0);
});
test('simultaneous website and Obsidian edits keep both versions until a choice',async()=>{
  const s=server(),a=device(s),b=device(s);a.put(note('Initial'));await a.sync();await b.sync();
  a.put(note('Website edit'));b.put(note('Obsidian edit'));await a.sync();await b.sync();
  assert.equal(b.status().conflicts,1);assert.equal(b.get('note:fr').data.markdown,'Obsidian edit');assert.equal(b.conflicts['note:fr'].remote.data.markdown,'Website edit');
  b.resolve('note:fr','local');await b.sync();await a.sync();assert.equal(a.get('note:fr').data.markdown,'Obsidian edit');
});
test('stale Syncthing Markdown cannot overwrite a newer cloud revision or resurrect a tombstone',async()=>{
  const s=server(),a=device(s);a.put(note('First'));await a.sync();
  const stale=note('Stale local edit',1);a.put(note('New cloud'));await a.sync();a.put(stale,stale.revision);
  assert.equal(a.status().conflicts,1);a.resolve('note:fr','remote');
  a.put({...a.get('note:fr'),deleted:true});await a.sync();a.put(stale,1);
  assert.equal(a.status().conflicts,1);assert.equal(a.conflicts['note:fr'].remote.deleted,true);
});
test('full website answer → Markdown → Obsidian edit → cloud → website round trip',async()=>{
  const s=server(),web=device(s),obsidian=device(s),q={id:'fr-Q0001',type:'translate',translation:'I am learning.',answer:'J’apprends.'};
  web.put(answerRecord('fr',q,'Mon brouillon','draft',''));await web.sync();await obsidian.sync();
  let markdown=privateMarkdown('fr',obsidian.items());markdown=markdown.replace('Mon brouillon','J’apprends.').replace('[ ] Submitted','[x] Submitted').replace('[ ] I can use this','[x] I can use this');
  for(const item of parsePrivateMarkdown(markdown,'fr'))obsidian.put(item,item.revision);
  await obsidian.sync();await web.sync();const answer=web.get('answer:fr-Q0001').data;
  assert.equal(answer.answer,'J’apprends.');assert.equal(answer.status,'submitted');assert.equal(answer.mark,'correct');
});
test('unchanged polls and repeated Realtime revisions do not emit changes or bump revisions',async()=>{
  const s=server();let changes=0;const a=new StudyLedger(s.client,{storage:store(),onChange:()=>changes++});a.activate(user);a.put(note('Same'));await a.sync();const previous=changes;
  await a.sync();a.receive(s.rows['note:fr']);assert.equal(changes,previous);assert.equal(s.rows['note:fr'].revision,1);
});
test('account change during an in-flight write never copies the reply into the other account cache',async()=>{
  const s=server(),a=device(s);a.put(note('Private'));s.setHook(()=>a.activate({id:'other-user'}));await a.sync();assert.equal(a.get('note:fr'),null);
});
test('corrupt offline state stays protected from new writes and background sync',async()=>{
  const storage={getItem:()=>'{bad json',setItem:()=>{throw new Error('Must not overwrite corrupt backup');}},s=server(),a=device(s,storage);
  await a.sync();assert.match(a.status().error,/backup could not be read/);assert.throws(()=>a.put(note('New')));assert.deepEqual(s.rows,{});
});
test('public clients reject both modern secret keys and legacy service-role keys',()=>{
  const url='https://rtytrxcqhcrrogsmjswk.supabase.co';
  assert.throws(()=>new StudyService({url,key:'sb_secret_not-for-client'}),/secret key/);
  const token=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';
  assert.throws(()=>new StudyService({url,key:token}),/service-role key/);
});
test('older mobile WebViews can generate standard UUIDs using getRandomValues',()=>{
  assert.match(uuid({getRandomValues:bytes=>bytes.fill(0)}),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

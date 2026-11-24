import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { build } from 'esbuild-wasm';
import { StudyLedger } from '../shared/study-ledger.js';
import { replacePrivateMarkdown, parsePrivateMarkdown } from '../shared/study-markdown.js';
import { answerRecord } from '../shared/study-model.js';

const output=await build({entryPoints:['obsidian-plugin/main.js'],bundle:true,format:'cjs',platform:'browser',target:'es2022',external:['obsidian'],write:false,footer:{js:'module.exports = module.exports.default;'}});
const notices=[];
const context={module:{exports:{}},exports:{},require:name=>{assert.equal(name,'obsidian');return {Plugin:class{},PluginSettingTab:class{},Modal:class{},Notice:class{constructor(message){notices.push(message);}},TFile:class{},normalizePath:s=>s,Setting:class{}};},setTimeout,clearTimeout,setInterval,clearInterval,crypto,TextEncoder,TextDecoder,URL,Headers,Request,Response,AbortController,console};
vm.runInNewContext(output.outputFiles[0].text,context);
const PluginClass=context.module.exports;
function fixture(){
  let markdown='# French\n\nMy unchanged public lesson';const storage=new Map();
  context.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const ledger=new StudyLedger({}, {storage:context.localStorage});ledger.activate({id:'00000000-0000-4000-8000-000000000099'});
  const plugin=new PluginClass();Object.assign(plugin,{settings:{url:'https://rtytrxcqhcrrogsmjswk.supabase.co',folder:'Language Study'},devicePrefix:'plugin-test',service:{ledger},mirror:{},scheduleSync:()=>{},app:{vault:{read:async()=>markdown,process:async(_file,fn)=>{markdown=fn(markdown);}}}});
  return {plugin,ledger,file:{path:'Language Study/French.md'},get:()=>markdown,set:value=>{markdown=value;}};
}
test('the packaged plugin exports a mobile-compatible class without Node filesystem calls',async()=>{
  assert.equal(typeof PluginClass,'function');
  const manifest=JSON.parse(await readFile('obsidian-plugin/manifest.json'));assert.equal(manifest.isDesktopOnly,false);
  assert(!output.outputFiles[0].text.includes('require("node:fs")'));
});
test('plugin writes website answers into one note, preserves its course, and reads Obsidian edits back',async()=>{
  const f=fixture();f.ledger.receive({key:'answer:fr-Q0001',language:'fr',kind:'answer',revision:1,data:{answer:'Website draft',status:'draft',mark:'',prompt:'Translate I learn',translation:'I learn',modelAnswer:'J’apprends.',type:'translate'}});
  await f.plugin.refreshFile(f.file);assert(f.get().startsWith('# French\n\nMy unchanged public lesson'));assert(f.get().includes('Website draft'));
  f.set(f.get().replace('Website draft','Obsidian answer').replace('[ ] Submitted','[x] Submitted'));
  await f.plugin.refreshFile(f.file);assert.equal(f.ledger.get('answer:fr-Q0001').data.answer,'Obsidian answer');assert.equal(f.ledger.get('answer:fr-Q0001').data.status,'submitted');
});
test('missing blocks do not delete cloud records and a different account cannot upload existing private notes',async()=>{
  const f=fixture();f.ledger.receive({key:'note:fr',language:'fr',kind:'note',revision:2,data:{markdown:'Protected notebook'}});await f.plugin.refreshFile(f.file);
  f.set('# French\n\nPublic course only');await f.plugin.refreshFile(f.file);assert(f.get().includes('Protected notebook'));assert.equal(f.ledger.get('note:fr').deleted,false);
  f.ledger.activate({id:'different-user'});await assert.rejects(()=>f.plugin.refreshFile(f.file),/different account/);
});
test('new cloud revisions render without treating the old written copy as a local edit',async()=>{
  const f=fixture();f.ledger.receive({key:'note:fr',language:'fr',kind:'note',revision:1,data:{markdown:'First'}});await f.plugin.refreshFile(f.file);
  f.ledger.receive({key:'note:fr',language:'fr',kind:'note',revision:2,data:{markdown:'New cloud'}});f.plugin.lastRender={};await f.plugin.refreshFile(f.file);
  assert(f.get().includes('New cloud'));assert.equal(f.ledger.status().conflicts,0);
  assert.equal(parsePrivateMarkdown(f.get(),'fr').find(i=>i.kind==='note').revision,2);
});
test('Obsidian can start a built-in or writing question before any website answer exists',async()=>{
  const f=fixture(),course=JSON.parse(await readFile('web/data/fr.json','utf8'));f.plugin.courseCache={fr:course};
  const q=await f.plugin.getQuestion('fr','fr-Q0001');assert.equal(q.id,'fr-Q0001');assert.equal(f.ledger.get('answer:'+q.id),null);
  f.ledger.put(answerRecord('fr',q,'My first answer in Obsidian','submitted','review'));await f.plugin.refreshFile(f.file);
  assert(f.get().includes('My first answer in Obsidian'));assert.equal(f.ledger.get('answer:fr-Q0001').data.status,'submitted');
  const writing=await f.plugin.getQuestion('fr','fr-E0-0');assert.equal(writing.type,'written');assert(writing.prompt&&writing.answer);
  await assert.rejects(()=>f.plugin.getQuestion('fr','fr-Q0000'),/Question not found/);
});

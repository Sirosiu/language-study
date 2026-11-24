import { StudyService } from '../shared/study-service.js';
import { LANGUAGES, normaliseItem, customQuestion, answerRecord, uuid } from '../shared/study-model.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let service=null, failure='', saveTimer, currentCode='fr', editedQuestion=null;
export const ledger=()=>service?.ledger;
export const signedIn=()=>Boolean(ledger()?.user);
export const savedAnswer=id=>signedIn()&&!ledger().get('answer:'+id)?.deleted?ledger().get('answer:'+id)?.data:null;
export const myQuestions=code=>ledger()?.items(code,'question').map(customQuestion)||[];
export function savePrivateAnswer(code,q,text,status='draft',mark='') {
  if(!signedIn())return;
  try{ledger().put(answerRecord(code,q,text,status,mark));queueSync();}catch(e){message(e.message);}
}
export function queueSync(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>ledger()?.sync(),700);}
function message(text){document.dispatchEvent(new CustomEvent('study:notice',{detail:text}));}
function statusText() {
  if(failure)return failure;
  if(!service)return 'Opening private study…';
  const s=ledger().status();if(!s.signedIn)return 'Sign in to sync your answers and notes.';
  if(s.error)return `Your edits stay on this device. ${s.error}`;
  if(s.conflicts)return `${s.conflicts} edit${s.conflicts===1?' needs':'s need'} your choice below. Both versions are kept.`;
  if(!navigator.onLine)return 'Offline. Your edits are saved on this device and will sync when you reconnect.';
  if(s.busy)return 'Syncing your private study…';
  if(s.pending)return `${s.pending} edit${s.pending===1?' is':'s are'} saved on this device, waiting to sync.`;
  return 'Your private study is synced.';
}
function conflictHtml(code) {
  if(!signedIn())return '';
  return Object.entries(ledger().conflicts).filter(([key])=>ledger().get(key)?.language===code).map(([key,c])=>`<div class="sync-conflict"><h3>Two versions of ${esc(key)}</h3><details><summary>Compare both versions</summary><h4>This device</h4><pre>${esc(JSON.stringify(ledger().get(key)?.data,null,2))}</pre><h4>Cloud</h4><pre>${esc(JSON.stringify(c.remote?.data||null,null,2))}</pre></details><div class="button-row"><button class="secondary" data-resolve="local" data-record="${esc(key)}">Keep this device’s version</button><button class="secondary" data-resolve="remote" data-record="${esc(key)}">Use the cloud version</button></div></div>`).join('');
}
export function renderNotebook(code) {
  currentCode=code;
  const title=`<h1>My ${esc(LANGUAGES[code])} notebook.</h1><p class="intro">Your notes, answers and added questions belong together. Use the same account in Obsidian to keep them in sync.</p>`;
  if(!signedIn())return title+`<div class="account-status" role="status">${esc(statusText())}</div><form id="sign-in-form" class="account-form"><h2>Open your private study</h2><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Password<input type="password" name="password" minlength="6" autocomplete="current-password" required></label><div class="button-row"><button class="primary" type="submit" ${!service?'disabled':''}>Sign in</button><button class="secondary" type="submit" name="action" value="signup" ${!service?'disabled':''}>Create my account</button></div><p class="small">Create an account once, confirm the email if requested, then sign in on each device. Passwords are handled by Supabase.</p><p id="account-message" role="status"></p></form><h2>Connect Obsidian</h2>${pluginHelp()}`;
  const note=ledger().get('note:'+code);
  return title+`<p class="small">Signed in as ${esc(ledger().user.email)}</p><p class="account-status" role="status">${esc(statusText())}</p><div class="button-row"><button class="secondary" data-sync-now>Sync now</button><button class="secondary" data-private-backup>Export private backup</button><button class="text-button" data-signout>Sign out on this device</button></div><div id="sync-conflicts">${conflictHtml(code)}</div><h2>My notebook</h2><label class="small" for="private-note">Write notes in Markdown. Changes save automatically.</label><textarea id="private-note" class="notebook-editor" maxlength="512000">${esc(note&&!note.deleted?note.data.markdown:'')}</textarea><details class="rule"><summary>Preview my notes</summary><div id="note-preview" class="markdown-notes"></div></details><details class="section"><summary>My added questions</summary><div class="section-body"><p class="small">Add translation, explanation or written practice. These questions also appear in Practice and in your Obsidian note.</p>${questionEditor()}<div id="custom-questions">${questionList(code)}</div></div></details><details class="section"><summary>My saved answers</summary><div class="section-body" id="private-answers">${answerList(code)}</div></details><details class="section"><summary>My dictionary words</summary><div class="section-body" id="private-words">${dictionaryWordList(code)}</div></details><details class="section"><summary>Connect Obsidian</summary><div class="section-body">${pluginHelp()}</div></details>`;
}
function pluginHelp(){return `<p><a href="downloads/sirosiu-language-study-plugin.zip" download>Download the Obsidian sync plugin</a> · <a href="sync-setup.html">Open setup instructions</a></p><p class="small">Install the plugin in your Syncthing vault and sign in separately on each device. Obsidian sync runs while the app is open; new website answers appear when you next open it. The course stays in one main note per language.</p>`;}
function questionEditor(){return `<form id="custom-question-form"><label class="small">Question title<input name="title" maxlength="300" required></label><label class="small">Question type<select name="type"><option value="translate">Translation</option><option value="explain">Explain a rule</option><option value="written">Written practice</option></select></label><label class="small">Prompt<textarea name="prompt" maxlength="12000" required></textarea></label><label class="small">Native sentence (optional)<textarea name="native" maxlength="12000"></textarea></label><label class="small">Translation (optional)<textarea name="translation" maxlength="12000"></textarea></label><label class="small">Model answer<textarea name="answer" maxlength="20000" required></textarea></label><label class="small">Explanation (optional)<textarea name="explanation" maxlength="20000"></textarea></label><div class="button-row"><button class="primary" type="submit">Save my question</button><button class="text-button" type="button" data-cancel-question>Clear editor</button></div></form>`;}
function questionList(code){return ledger().items(code,'question').map(q=>`<div class="example"><h3>${esc(q.data.title)}</h3><p>${esc(q.data.prompt||q.data.translation)}</p><div class="button-row"><a href="#${code}/practice/${q.key.slice(9)}">Practise this question</a><button class="text-button" data-edit-question="${esc(q.key)}">Edit</button><button class="text-button" data-delete-record="${esc(q.key)}">Remove</button></div></div>`).join('')||'<p class="small">Your first added question will appear here.</p>';}
function answerList(code){return ledger().items(code,'answer').map(a=>`<details class="rule"><summary>${esc(a.key.slice(7))} · ${esc(a.data.status)}${a.data.mark?' · '+esc(a.data.mark):''}</summary><div class="rule-body"><p>${esc(a.data.prompt)}</p><p class="answer-text">${esc(a.data.answer||'No written answer yet.')}</p><a href="#${code}/${a.key.includes('-E')?'grammar':'practice'}/${a.key.slice(7)}">Open this question</a></div></details>`).join('')||'<p class="small">Try a question in Practice or Grammar. Your written answer saves here automatically while signed in.</p>';}
function dictionaryWordList(code){return ledger().items(code,'word').filter(w=>!w.key.includes('-V')).map(w=>`<p><strong>${esc(w.data.word)}</strong> · ${esc(w.data.meaning)} <button class="text-button" data-delete-record="${esc(w.key)}">Remove</button></p>`).join('')||'<p class="small">Save an entry from Dictionary in the Words page to keep it here and in Obsidian.</p>';}
export function refreshNotebook(code){
  if(!signedIn())return;
  const note=document.querySelector('#private-note'),record=ledger().get('note:'+code);
  if(note&&document.activeElement!==note){note.value=record&&!record.deleted?record.data.markdown:'';updatePreview();}
  for(const [id,html]of [['custom-questions',questionList(code)],['private-answers',answerList(code)],['private-words',dictionaryWordList(code)]]){
    const target=document.getElementById(id);if(!target||target.innerHTML===html||target.contains(document.activeElement))continue;
    const open=[...target.querySelectorAll('details[open] > summary')].map(s=>s.textContent);
    target.innerHTML=html;target.querySelectorAll('details > summary').forEach(s=>{if(open.includes(s.textContent))s.parentElement.open=true;});
  }
}
function updatePreview(){const el=document.querySelector('#note-preview'), input=document.querySelector('#private-note');if(el&&input)el.innerHTML=DOMPurify.sanitize(marked.parse(input.value),{FORBID_TAGS:['img','style','iframe','form','input','script'],FORBID_ATTR:['style']});}
function updateStatus(){document.querySelectorAll('.account-status').forEach(el=>el.textContent=statusText());const c=document.querySelector('#sync-conflicts');if(c)c.innerHTML=conflictHtml(currentCode);}
export async function initCloud() {
  try{
    const response=await fetch('cloud-config.json');if(!response.ok)throw new Error('The sign-in configuration could not load. Reconnect and reload.');
    service=new StudyService(await response.json(),{prefix:'language-study-web:'+new URL('./',location.href).pathname,onChange:()=>document.dispatchEvent(new Event('study:change')),onStatus:updateStatus});
    await service.start();document.dispatchEvent(new Event('study:ready'));
  }catch(error){failure=error.message;updateStatus();document.dispatchEvent(new Event('study:ready'));}
}
export function notebookMounted(){editedQuestion=null;updatePreview();updateStatus();}
document.addEventListener('input',event=>{
  if(event.target.id!=='private-note'||!signedIn())return;
  try{ledger().put(normaliseItem({key:'note:'+currentCode,language:currentCode,kind:'note',data:{markdown:event.target.value}}));queueSync();updatePreview();}catch(e){message(e.message);}
});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.id==='sign-in-form'){
    event.preventDefault();const action=event.submitter?.value, data=new FormData(form), label=document.querySelector('#account-message');
    form.querySelectorAll('button').forEach(b=>b.disabled=true);label.textContent='Opening your account…';
    try{if(action==='signup'){const active=await service.signUp(data.get('email'),data.get('password'));if(!active)message('Confirm the email from Supabase, then sign in.');}else await service.signIn(data.get('email'),data.get('password'));form.reset();document.dispatchEvent(new Event('study:ready'));}
    catch(e){label.textContent=e.message;}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  if(form.id==='custom-question-form'){
    event.preventDefault();try{
      const data=Object.fromEntries(new FormData(form));const key=editedQuestion||`question:${currentCode}-U-${uuid()}`;
      ledger().put({key,language:currentCode,kind:'question',data});editedQuestion=null;form.reset();document.querySelector('#custom-questions').innerHTML=questionList(currentCode);queueSync();message('Your question is saved and available in Practice.');
    }catch(e){message(e.message);}
  }
});
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  try{
    if(b.hasAttribute('data-sync-now'))await ledger()?.sync();
    if(b.hasAttribute('data-signout')){if(ledger().status().pending)message('Unsynced edits stay in this device’s account backup. Sign back in to finish syncing.');await service.signOut();document.dispatchEvent(new Event('study:ready'));}
    if(b.hasAttribute('data-private-backup')){const url=URL.createObjectURL(new Blob([JSON.stringify(ledger().backup(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='language-study-private-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(b.dataset.resolve){ledger().resolve(b.dataset.record,b.dataset.resolve);queueSync();document.dispatchEvent(new Event('study:ready'));}
    if(b.dataset.editQuestion){const q=ledger().get(b.dataset.editQuestion);editedQuestion=q.key;const form=document.querySelector('#custom-question-form');for(const [name,value]of Object.entries(q.data))form.elements[name].value=value;form.scrollIntoView({block:'start'});form.elements.title.focus();}
    if(b.hasAttribute('data-cancel-question')){editedQuestion=null;document.querySelector('#custom-question-form').reset();}
    if(b.dataset.deleteRecord){const item=ledger().get(b.dataset.deleteRecord);ledger().put({...item,deleted:true});queueSync();document.dispatchEvent(new Event('study:ready'));}
  }catch(e){message(e.message);}
});
window.addEventListener('online',()=>ledger()?.sync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)ledger()?.sync();});

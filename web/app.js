import { sanitiseProgress, mergeProgress, progressEnvelope } from './progress.js';
import { initCloud, ledger, signedIn, savedAnswer, myQuestions, savePrivateAnswer, queueSync, renderNotebook, notebookMounted, refreshNotebook } from './cloud.js';
import { lookupDictionary } from './dictionary.js';
'use strict';
const LANGUAGES={ar:'Arabic',da:'Danish',nl:'Dutch',en:'English',fi:'Finnish',fr:'French',de:'German',ka:'Georgian',it:'Italian',ja:'Japanese',ko:'Korean',zh:'Mandarin Chinese',ru:'Russian',es:'Spanish',tr:'Turkish'};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>';
let course=null,code='fr',tab='start',wordPage=0,wordQuery='',wordPos='',onlySaved=false,practiceRule='',practiceType='',practiceReview=false,practiceIndex=0,inlineIndices={},noticeTimer,currentSound=null,pendingReadRule=null;
const siteBase = new URL('./', location.href);
const storageKey = 'sirosiu-language-study-v3:' + siteBase.pathname;
let progress = {}, storageProblem = false;
try { progress = sanitiseProgress(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { storageProblem = true; }
function state(c=code){
  if(signedIn())return {attempts:Object.fromEntries(ledger().items(c,'answer').filter(a=>a.data.mark).map(a=>[a.key.slice(7),a.data.mark])),words:ledger().items(c,'word').map(w=>w.key.slice(('word:'+c+':').length)).filter(id=>id.startsWith(c+'-V'))};
  return progress[c]||(progress[c]={attempts:{},words:[]});
}
function allQuestions(){return [...course.questions,...myQuestions(code)];}
function exerciseQuestion(section,index,prompt,answer){return {id:`${code}-E${section}-${index}`,type:'written',title:'Writing and reasoning',prompt,answer,native:'',translation:'',explanation:'Compare the idea and structure of your answer with this model. Other wording can be valid.',rule:null,section,custom:true};}
function findQuestion(id){const question=allQuestions().find(q=>q.id===id);if(question)return question;const m=id?.match(/-E(\d+)-(\d+)$/);if(m){const section=Number(m[1]),index=Number(m[2]),exercise=course.sections[section]?.exercises[index];if(exercise)return exerciseQuestion(section,index,...exercise);}return null;}
function persistForm(form,status='draft',mark){const q=findQuestion(form.dataset.qid);if(!q)return;const old=savedAnswer(q.id);savePrivateAnswer(code,q,String(new FormData(form).get('answer')||''),status,mark??old?.mark??'');}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(progress));return true}catch{notify('This browser could not save progress. Export a backup before closing the page.');return false}}
function exportProgress(){const blob=new Blob([JSON.stringify(progressEnvelope(progress),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='language-study-progress-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function importProgress(file) {
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('That file is too large. Choose a course progress backup smaller than 2 MB.');
    const incoming = sanitiseProgress(JSON.parse(await file.text()));
    progress = mergeProgress(progress, incoming);
    const persisted = save();
    if(course) render();
    notify(persisted ? 'Progress imported. Existing saved words are kept; imported question marks take priority.' : 'Progress imported for this session. Export a backup because browser storage is unavailable.');
  } catch(error) { notify(error instanceof SyntaxError ? 'That file is not valid JSON. Choose an exported progress backup.' : error.message); }
  finally { $('#progress-file').value = ''; }
}
function applyPlaybackSpeed(){const rate=Number($('#speech-rate').value);document.querySelectorAll('audio').forEach(a=>a.playbackRate=rate);if(currentSound)currentSound.playbackRate=rate}
function notify(message){$('#notice').textContent=message;$('#notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.remove('visible'),6500)}
function native(text,tag='div'){return `<${tag} class="native" lang="${code==='zh'?'zh-CN':code}" dir="${course.direction}">${esc(text)}</${tag}>`}
function listen(text,extra=''){const recorded=course.rules.some(r=>r.examples[0]?.native===text)||course.passages?.[0]?.native===text;return `<button class="listen" data-say="${attr(text)}" ${extra}>${icon} ${recorded?'Listen offline':'Listen'}</button>`}
function paragraphs(text){return String(text).split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('')}
function example(n,t){return `<div class="example">${native(n)}<p class="translation">${esc(t)}</p>${listen(n)}</div>`}
function intro(title,text){return `<h1>${esc(title)}</h1><p class="intro">${esc(text)}</p>`}
function track(path,label){return `<div class="audio-box"><p>${esc(label)} · spoken by a synthetic voice</p><audio controls preload="none" src="${attr(encodeURI(path))}"></audio></div>`}
function speak(text,wordId){
  if(currentSound){currentSound.pause();currentSound=null}
  window.speechSynthesis?.cancel();
  const ri=course.rules.findIndex(r=>r.examples[0]?.native===text);
  const passage=course.passages?.[0]?.native===text;
  if(ri>=0||passage){const path=ri>=0?`Audio/${code}/Rule ${String(ri+1).padStart(2,'0')}.mp3`:`Audio/${code}/Reading passage.mp3`;currentSound=new Audio(encodeURI(path));applyPlaybackSpeed();currentSound.onerror=()=>deviceSpeak(text);currentSound.play().catch(()=>deviceSpeak(text));return}
  const w=wordId&&course.words.find(x=>x.id===wordId);
  if(w?.audio){currentSound=new Audio(w.audio);applyPlaybackSpeed();currentSound.onerror=()=>deviceSpeak(text);currentSound.play().catch(()=>deviceSpeak(text));return}
  deviceSpeak(text);
}
function deviceSpeak(text){
  if(!('speechSynthesis' in window)){notify('Sentence playback is unavailable here. Use the recorded script and word tracks.');return}
  const model=code==='en'?$('#english-model').value:course.speech;
  const voices=speechSynthesis.getVoices();
  const voice=voices.find(v=>v.lang.toLowerCase()===model.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(code));
  if(!voice){notify(`No ${course.name} voice is available on this device. The recorded script and word tracks work offline.`);return}
  const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=model;utterance.rate=Number($('#speech-rate').value);utterance.onerror=()=>notify('Playback could not start. Try a recorded word track.');speechSynthesis.speak(utterance);
}
const courseCache = new Map();
let loadController, routeVersion = 0;
function updateDownloads() {
  document.querySelectorAll('[data-pdf]').forEach(a=>{a.href=encodeURI('Books/'+LANGUAGES[code]+'.pdf')});
  document.querySelectorAll('[data-obsidian]').forEach(a=>{a.href='downloads/'+code+'-obsidian.zip'});
  $('#offline-language').textContent = LANGUAGES[code];
  updateOfflineStatus();
}
async function loadLanguage(next, version){
  loadController?.abort();
  const selected=LANGUAGES[next]?next:'fr';
  code=selected;course=null;
  currentSound?.pause();window.speechSynthesis?.cancel();
  document.querySelectorAll('audio').forEach(a=>a.pause());
  $('#main').innerHTML='<p class="loading" role="status">Opening '+esc(LANGUAGES[selected])+'…</p>';
  $('#current-name').textContent=LANGUAGES[selected];$('#language-select').value=selected;
  updateDownloads();
  let data=courseCache.get(selected);
  if(!data){
    loadController=new AbortController();
    const response=await fetch('data/'+selected+'.json',{signal:loadController.signal});
    if(!response.ok)throw new Error('Course download failed');
    data=await response.json();
    if(data.code!==selected||!Array.isArray(data.questions)||!Array.isArray(data.words))throw new Error('Invalid course');
    courseCache.set(selected,data);
  }
  if(version!==routeVersion)return false;
  course=data;
  if(wordPos&&!course.words.some(w=>w.pos===wordPos))wordPos='';
  practiceRule='';practiceType='';
  document.querySelectorAll('#language-nav a').forEach(a=>a.setAttribute('aria-current',String(a.dataset.lang===code)));
  document.title=course.name+' · Language Study';wordPage=0;practiceIndex=0;inlineIndices={};render();
  try{localStorage.setItem(storageKey+':language',code)}catch{}
  return true;
}
function render(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.tab===tab)));
  dictionaryController?.abort();dictionaryResult=null;
  $('#main').innerHTML=({start:renderStart,grammar:renderGrammar,practice:renderPractice,words:renderWords,reading:renderReading,notebook:()=>renderNotebook(code)}[tab]||renderStart)();
  if(tab==='notebook')notebookMounted();
  applyPlaybackSpeed();
}
function renderStart(){
  const f=course.foundation;
  const letters=f.letters.map((l,i)=>`<div class="letter"><span class="symbol" lang="${code}" dir="${course.direction}">${esc(l.symbol)}</span><span class="letter-name">${esc(l.name)}${l.roman?' · '+esc(l.roman):''}</span>${l.katakana?'<span class="letter-extra">'+esc(l.katakana)+'</span>':''}${l.initial?'<span class="letter-extra" dir="rtl">'+[l.initial,l.medial,l.final].map(esc).join('　')+'</span>':''}<button class="listen letter-listen" data-letter="${i}" aria-label="Listen to ${attr(l.symbol)}: ${attr(l.audioLabel||l.name)}" aria-pressed="false">${icon}<span>${code==='zh'?'Hear example':'Hear letter'}</span></button>${code==='zh'?`<span class="letter-name">${esc(l.audioLabel)}</span>`:''}</div>`).join('');
  return intro('Start reading '+course.name+'.','Keep the writing system, sounds, first words and word-building rules together. Use this as a reference while your grammar grows.')+
    `<p class="small">Goal: ${code==='en'?'very advanced English with UK and US pronunciation.':['de','zh','fr','es','it'].includes(code)?'near-native communication and advanced reading.':'professional communication and reading.'}</p><details class="rule"><summary>How to use this course</summary><ol class="study-method"><li>Read one small rule and its translated examples.</li><li>Listen, then say the examples yourself.</li><li>Open practice under that rule and try a few questions.</li><li>Compare your answer, mark what needs another try, and return later.</li></ol></details>`+
    `<h2>${esc(f.alphabetName)}</h2><p class="small">${code==='ja'?'Hiragana with the matching katakana below each reading.':code==='ar'?'Isolated letter above; initial, medial and final connection forms below.':code==='zh'?'Pinyin sound reference. Each button plays a labelled syllable example; initials need a vowel to be heard clearly. Learn characters alongside it.':'Letter forms with their names for spelling aloud.'} Play each letter separately. These recordings use synthetic voices.${code==='en'?' Choose US or UK in Audio options.':''}</p><div class="letter-grid ${code==='ar'?'arabic':''}">${letters}</div>`+
    track(`Audio/${code}/Script and first phrases.mp3`,code==='zh'?'Tone contrasts and first phrases':code==='ko'?'Core letters and first phrases':'Letter reference and first phrases')+
    (code==='en'?track('Audio/en/UK script and first phrases.mp3','UK reference model'):'')+
    `<h2>How the sounds work</h2>${f.notes.map(([title,text])=>`<h3>${esc(title)}</h3><p>${esc(text)}</p>`).join('')}`+
    `<h2>How to build words</h2>${f.building.map(([title,text])=>`<h3>${esc(title)}</h3><p>${esc(text)}</p>`).join('')}`+
    `<h2>Say something useful</h2>${f.phrases.map(([n,t])=>example(n,t)).join('')}`+
    `<details class="section"><summary>Grammar terms in plain English</summary>${(course.grammarTerms||[]).map(([t,d])=>`<h3>${esc(t)}</h3><p>${esc(d)}</p>`).join('')}</details><div class="button-row"><button class="primary" data-tab="grammar">Start a grammar lesson</button><button class="secondary" data-tab="words">Explore the word bank</button></div>`;
}
function renderGrammar(){
  let html=intro('Learn a rule. Use it here.','Each section keeps explanations, examples, practice and answers together. Open one topic and stay with it for a few questions.');
  html+=course.sections.map((s,i)=>`<details class="section" ${i===0?'open':''}><summary>${esc(s.title)}</summary><div class="section-body"><p class="small">${esc(s.level)}</p>${paragraphs(s.explanation)}${s.examples.map(([n,t,note])=>example(n,t)+`<p class="small">${esc(note)}</p>`).join('')}${course.rules.filter(r=>r.section===i).map(ruleHtml).join('')}<details class="rule"><summary>Writing and reasoning practice</summary><div class="rule-body">${s.exercises.map(([q,a],j)=>`<details class="rule" id="exercise-${i}-${j}"><summary>${esc(q)}</summary>${questionHtml(exerciseQuestion(i,j,q,a),0,1,`exercise-${i}-${j}`)}</details>`).join('')}</div></details></div></details>`).join('');
  if(course.dialects.length)html+='<h2>Spoken Arabic, kept separate</h2><p class="small">MSA above; Egyptian, Levantine and Gulf below. Do not mix the systems while practising one pattern.</p>'+course.dialects.map(d=>`<details class="section"><summary>${esc(d.name.replace('Arabic - ',''))}</summary><div class="section-body">${paragraphs(d.intro)}${track('Audio/ar/'+d.name.replace('Arabic - ','')+' examples.mp3','Dialect example guide; synthetic speech may not reproduce every local feature')}${d.units.map(u=>`<h3>${esc(u.title)}</h3>${paragraphs(u.explanation)}${u.examples.map(([n,t,note])=>example(n,t)+`<p class="small">${esc(note)}</p>`).join('')}${u.exercises.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}`).join('')}</div></details>`).join('');
  return html;
}
function ruleHtml(r){const ri=course.rules.indexOf(r);return `<details class="rule" id="rule-${ri}"><summary>${esc(r.title)} <span class="small">· ${r.questionCount} questions</span></summary><div class="rule-body"><p>${esc(r.explanation)}</p>${r.examples.map(e=>example(e.native,e.translation)).join('')}${r.questionCount?`<button class="secondary" data-inline-rule="${ri}">Practise this rule here</button><div class="inline-practice" id="inline-${ri}"></div>`:'<p class="small">Use the reference examples above for this rule; the mixed bank covers the other available sentence patterns.</p>'}</div></details>`}
function practicePool(rule=practiceRule){return allQuestions().filter(q=>(rule===''||rule==='mine'&&q.custom||q.rule===Number(rule))&&(!practiceType||q.type===practiceType)&&(!practiceReview||state().attempts[q.id]==='review'))}
function renderPractice(){
  const s=state(),attempted=Object.keys(s.attempts).length,review=Object.values(s.attempts).filter(x=>x==='review').length;
  const pool=practicePool();if(practiceIndex>=pool.length)practiceIndex=0;
  return intro('A little practice, often.','Choose a rule or a question type. Try your answer before opening the model; translation and explanation tasks can have more than one valid answer.')+
    `<p class="progress-summary">${attempted} of ${allQuestions().length} questions marked · ${review} to revisit</p><p class="small">${signedIn()?'Your written answers save automatically and sync with Obsidian.':'Sign in in My notebook to save written answers and sync with Obsidian. You can try the public questions here.'}</p><div class="filters"><label>Grammar rule<select id="practice-rule"><option value="">Mix all rules</option><option value="mine" ${practiceRule==='mine'?'selected':''}>My added questions</option>${course.rules.map((r,i)=>`<option value="${i}" ${String(i)===practiceRule?'selected':''}>${esc(r.title)} (${r.questionCount})</option>`).join('')}</select></label><label>Question type<select id="practice-type"><option value="">Mix all types</option>${Object.entries({...course.typeNames,written:'Written practice'}).map(([t,n])=>`<option value="${t}" ${practiceType===t?'selected':''}>${esc(n)}</option>`).join('')}</select></label><label>Study set<select id="practice-set"><option value="all" ${!practiceReview?'selected':''}>All questions</option><option value="review" ${practiceReview?'selected':''}>Marked for another practice</option></select></label></div>`+
    (pool.length?`<div id="main-question">${questionHtml(pool[practiceIndex],practiceIndex,pool.length,'main')}</div>`:'<div class="empty"><p>No questions match these filters. Choose All questions, mix the rules or mix the question types. Mark a model with “Practise again later” to add it to your review set.</p></div>');
}
function questionHtml(q,index,total,context){
  const saved=savedAnswer(q.id),value=saved?.answer||'';
  const meta=`<div class="question-head"><span>${esc(q.id)} · ${esc(q.title)}</span><span>${index+1} / ${total}</span></div><h2 class="question-title">${esc(course.typeNames[q.type]||'Written practice')}</h2>`;
  const marked=esc(q.before)+'<mark>'+esc(q.key)+'</mark>'+esc(q.after);
  let stimulus='';
  if(q.custom&&q.type!=='translate')stimulus=`<p>${esc(q.prompt)}</p>${q.native?native(q.native):''}${q.translation?`<p class="translation">${esc(q.translation)}</p>`:''}`;
  else if(q.type==='translate')stimulus=`<p class="small">Write this in ${esc(course.name)}.</p><p class="native">${esc(q.translation||q.prompt)}</p><p class="small">${esc(q.translationLanguage||'English')} meaning supplied.</p>`;
  else if(q.type==='order')stimulus=`<p>Put the words or phrase chunks in a natural order. Click a chunk to add it, or type the sentence yourself.</p><p class="translation">${esc(q.translation)}</p><div class="chunk-box">${q.chunks.map(c=>`<button class="chunk" data-chunk="${attr(c)}" type="button">${esc(c)}</button>`).join('')}</div>`;
  else if(q.type==='edit')stimulus=`<p>Replace the highlighted change to restore the intended meaning and form.</p><div class="native" lang="${code}" dir="${course.direction}">${esc(q.before)}<mark>${esc(q.changed)}</mark>${esc(q.after)}</div><p class="translation">${esc(q.translation)}</p>`;
  else if(q.type==='explain')stimulus=`<p>Explain how the highlighted form works. State the rule and use this example to illustrate it.</p><div class="native" lang="${code}" dir="${course.direction}">${marked}</div><p class="translation">${esc(q.translation)}</p>`;
  else stimulus=`<div class="native" lang="${code}" dir="${course.direction}">${esc(q.before)}<mark>____</mark>${esc(q.after)}</div><p class="translation">${esc(q.translation)}</p><p class="small">Use the wording of the example that fits this meaning. Other open translations may be possible.</p>`;
  const input=q.type==='choice'?`<fieldset class="options"><legend class="small">Choose a form for the gap</legend>${q.options.map(o=>`<label class="option"><input type="radio" name="answer" value="${attr(o)}" ${value===o?'checked':''}><span lang="${code}" dir="${course.direction}">${esc(o)}</span></label>`).join('')}</fieldset>`:['order','translate','explain','written'].includes(q.type)?`<label class="small">Your answer<textarea name="answer" maxlength="20000" autocomplete="off">${esc(value)}</textarea></label>`:`<label class="small">Your answer<br><input type="text" name="answer" maxlength="20000" value="${attr(value)}" autocomplete="off" spellcheck="false"></label>`;
  return `<article class="question" data-context="${context}">${meta}${stimulus}<form class="question-form" data-qid="${q.id}">${input}<div class="button-row"><button class="primary" type="submit">${['order','translate','explain','written'].includes(q.type)?'Compare my answer':'Check my answer'}</button><button class="text-button" type="button" data-reveal="${q.id}">Show the model</button></div></form><div class="feedback-slot">${saved?.status==='submitted'?feedback(q,value,false):''}</div><div class="button-row">${context.startsWith('exercise-')?'':`<button class="secondary" data-previous="${context}" ${index===0?'disabled':''}>Previous</button><button class="secondary" data-next="${context}" ${index===total-1?'disabled':''}>Next question</button>`}${q.rule!==null?`<button class="text-button" data-read-rule="${q.rule}">Read this rule</button>`:''}</div></article>`;
}
function feedback(q,response,revealed){
  const auto=['cloze','choice','edit'].includes(q.type),tidy=s=>String(s).normalize('NFC').trim().replace(/\s+/g,' ');
  const correct=auto&&tidy(response)===tidy(q.answer);
  const result=revealed?'Model answer':auto?(correct?'That matches the model.':'Compare the form below.'):'Compare your answer with the model.';
  return `<div class="feedback"><p class="result ${auto&&!correct&&!revealed?'try-again':''}">${result}</p>${q.type==='explain'||q.type==='written'?'<p>'+esc(q.answer)+'</p>':native(q.answer)}${q.native?`<p class="small">Complete example</p>${native(q.native)}<p class="translation">${esc(q.translation)}</p>`:''}<h3>Why this form works</h3><p>${esc(q.explanation)}</p><p class="small">A form can have several uses. Read the complete example and the reference lesson; this is a model wording, not the only possible translation.</p>${q.native?listen(q.native):''}<div class="button-row"><button class="secondary" data-mark="correct" data-mark-id="${q.id}">I can use this</button><button class="secondary" data-mark="review" data-mark-id="${q.id}">Practise again later</button>${q.source?`<a href="${attr(q.source)}" target="_blank" rel="noopener">Sentence source</a>`:''}</div></div>`;
}
function filteredWords(){const query=wordQuery.toLowerCase();return course.words.filter(w=>(!query||(w.word+' '+w.meaning+' '+w.roman).toLowerCase().includes(query))&&(!wordPos||w.pos===wordPos)&&(!onlySaved||state().words.includes(w.id)))}
function wordListHtml(){
  const list=filteredWords();if(wordPage*10>=list.length)wordPage=0;
  return `<p class="small">${list.length} words${onlySaved?' in your saved list':''}</p><div class="word-list">${list.slice(wordPage*10,wordPage*10+10).map(w=>`<details class="word-entry"><summary><span><span class="native" lang="${code}" dir="${course.direction}">${esc(w.word)}</span><span class="pronunciation">${esc(w.roman||w.ipa||w.pos)}${w.roman&&w.ipa?' · '+esc(w.ipa):''}</span>${state().words.includes(w.id)?'<span class="saved-label">Saved</span>':''}</span><span class="meaning">${esc(w.meaning)}</span></summary><div class="word-detail"><p class="small">${esc(w.pos)}${w.tags.length?' · '+esc(w.tags.join(', ')):''}${w.otherMeanings.length?' · Other meanings: '+esc(w.otherMeanings.join('; ')):''}</p>${w.romanSource?'<p class="small">'+esc(w.romanSource)+'</p>':''}${w.examples.map(e=>example(e.native,e.english)).join('')}<div class="button-row">${listen(w.word,`data-word-id="${w.id}"`)}<button class="text-button" data-save-word="${w.id}">${state().words.includes(w.id)?'Remove from saved words':'Save this word'}</button><a href="${attr(w.source)}" target="_blank" rel="noopener">Dictionary entry</a></div><p class="small">Offline recording: ${esc(w.audioTrack.split('/').pop().replace('.mp3',''))}. Choose that group in the player above.</p></div></details>`).join('')}</div>`+(list.length?`<div class="pagination"><button class="secondary" data-word-page="-1" ${wordPage===0?'disabled':''}>Previous words</button><span>${wordPage*10+1}–${Math.min(wordPage*10+10,list.length)} / ${list.length}</span><button class="secondary" data-word-page="1" ${(wordPage+1)*10>=list.length?'disabled':''}>More words</button></div>`:'<p class="empty">No matching words. Try a shorter search or clear the filters.</p>');
}
let dictionaryController=null,dictionaryResult=null;
function renderWords(){
  return intro('Words, with room to explore.','Search the full available dictionary for this language, then use the thousand-word study bank below for regular practice.')+
    `<h2>Dictionary</h2><p class="small">Look up any native word or base form in Wiktionary. Available entries include definitions, inflections and pronunciation; some have recordings. Coverage varies by language. New lookups need internet.</p><form id="dictionary-form" class="dictionary-form"><label class="small" for="dictionary-query">Look up a ${esc(course.name)} word</label><div class="button-row"><input id="dictionary-query" name="word" maxlength="200" required autocomplete="off" placeholder="Type a word in ${attr(course.name)}"><button class="primary" type="submit">Look up word</button></div></form><div id="dictionary-status" role="status"></div><div id="dictionary-result" class="dictionary-result"></div><h2>My course word bank</h2><p class="small">1,000 useful and frequent entries with English meanings, examples and offline word tracks.</p>`+
    `<label class="small" for="word-search">Search a word or its English meaning</label><div><input id="word-search" type="search" value="${attr(wordQuery)}" placeholder="Try book, work, time…"></div><div class="filters"><label>Word class<select id="word-pos"><option value="">All word classes</option>${[...new Set(course.words.map(w=>w.pos))].sort().map(p=>`<option ${p===wordPos?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>Study list<select id="word-saved"><option value="all" ${!onlySaved?'selected':''}>All words</option><option value="saved" ${onlySaved?'selected':''}>My saved words</option></select></label></div>`+
    `<div class="audio-box"><p>Offline word tracks · 50 words per track, in the numbered word-bank order. Synthetic pronunciation; compare a dictionary recording where available.</p><label class="small" for="word-track">Choose a word group</label><br><select id="word-track">${Array.from({length:20},(_,i)=>`<option value="${i}">Words ${i*50+1}–${i*50+50}</option>`).join('')}</select><audio id="word-player" controls preload="none" src="${attr(encodeURI('Audio/'+code+'/Words 0001-0050.mp3'))}"></audio></div><div id="word-results">${wordListHtml()}</div>`;
}
function renderReading(){
  return intro('Read it. Then make it yours.','Work with complete translated sentences. Read the target language first, open the meaning, then say the sentence again without looking.')+
    `<ol class="study-method"><li>Find the main predicate and the participants.</li><li>Explain one ending, particle or connector.</li><li>Read the sentence aloud; compare a recording when available.</li><li>Change one detail. Check whether another word must change too.</li></ol><h2>First conversations</h2>${course.foundation.phrases.map(([n,t])=>example(n,t)).join('')}<h2>Connected reading</h2>${(course.passages||[]).map(p=>`<h3>${esc(p.title)}</h3>${native(p.native,'p')}<details><summary>${p.guide?'Open the English reading guide':'Open the English meaning'}</summary><p>${esc(p.translation||p.guide)}</p></details>${listen(p.native)}`).join('')}<h2>Translated reading practice</h2>${course.readingSamples.map(s=>`<div class="example">${native(s.native)}<details><summary>Open the ${code==='en'?'Hindi':'English'} meaning</summary><p class="translation">${esc(s.translation)}</p></details>${listen(s.native)} <a class="small" href="${attr(s.source)}" target="_blank" rel="noopener">Source</a></div>`).join('')}<h2>Writing for real situations</h2><p>Write a short introduction, a request for information, a polite disagreement and a paragraph explaining an idea. Use the professional grammar section for model structures. Keep a first draft, underline uncertain forms, and revise after checking examples.</p><div class="button-row"><button class="primary" data-tab="grammar">Open professional and advanced lessons</button><button class="secondary" data-tab="practice">Try mixed practice</button></div>`;
}
function showInline(ri){const pool=course.questions.filter(q=>q.rule===ri);const i=inlineIndices[ri]||0;const el=$('#inline-'+ri);if(el&&pool.length)el.innerHTML=questionHtml(pool[i],i,pool.length,'inline-'+ri)}
function advance(context,amount){
  if(context==='main'){const pool=practicePool();practiceIndex=Math.max(0,Math.min(pool.length-1,practiceIndex+amount));$('#main-question').innerHTML=questionHtml(pool[practiceIndex],practiceIndex,pool.length,'main')}
  else{const ri=Number(context.replace('inline-',''));const pool=course.questions.filter(q=>q.rule===ri);inlineIndices[ri]=Math.max(0,Math.min(pool.length-1,(inlineIndices[ri]||0)+amount));showInline(ri)}
}
document.addEventListener('submit',async e=>{
  if(e.target.id==='dictionary-form'){
    e.preventDefault();dictionaryController?.abort();const controller=new AbortController();dictionaryController=controller;
    const query=new FormData(e.target).get('word'),selectedCode=code,status=$('#dictionary-status'),target=$('#dictionary-result');status.textContent='Looking up the dictionary entry…';target.replaceChildren();dictionaryResult=null;
    try{const result=await lookupDictionary(selectedCode,query,controller.signal);if(controller.signal.aborted||code!==selectedCode||tab!=='words')return;dictionaryResult=result;status.textContent=result.cached?'Opened a cached dictionary entry.':'Entry from Wiktionary · CC BY-SA 4.0.';target.innerHTML=`<div class="button-row"><a href="${attr(result.source)}" target="_blank" rel="noopener">Open source and revision history</a><button class="secondary" data-save-dictionary>Save word to my notebook</button></div><div class="dictionary-definition">${result.html}</div>`;}
    catch(error){if(error.name!=='AbortError'&&!controller.signal.aborted)status.textContent=error.message;}
    return;
  }
  if(!e.target.matches('.question-form'))return;e.preventDefault();const q=findQuestion(e.target.dataset.qid);const response=new FormData(e.target).get('answer')||'';if(!response.trim()){notify('Try an answer first, or choose “Show the model”.');return}persistForm(e.target,'submitted');e.target.closest('.question').querySelector('.feedback-slot').innerHTML=feedback(q,response,false);
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-export-progress')){exportProgress();return}
  if(b.hasAttribute('data-retry')){route();return}
  if(b.dataset.tab){location.hash=code+'/'+b.dataset.tab;return}
  if(b.dataset.letter!==undefined){
    const l=course.foundation.letters[Number(b.dataset.letter)];if(!l)return;
    currentSound?.pause();window.speechSynthesis?.cancel();document.querySelectorAll('audio').forEach(a=>a.pause());document.querySelectorAll('[data-letter]').forEach(a=>a.setAttribute('aria-pressed','false'));
    const sound=new Audio(code==='en'&&$('#english-model').value==='en-GB'?l.audioUK:l.audio);currentSound=sound;applyPlaybackSpeed();b.setAttribute('aria-pressed','true');
    const stopped=()=>b.setAttribute('aria-pressed','false');sound.onended=stopped;sound.onpause=stopped;sound.onerror=()=>{stopped();notify('This letter recording could not load. Reconnect or refresh the language’s offline copy.');};sound.play().catch(()=>{stopped();notify('Playback could not start. Try the letter again.');});return;
  }
  if(b.hasAttribute('data-save-dictionary')){if(!dictionaryResult)return;if(!signedIn()){notify('Sign in in My notebook to save dictionary words and sync them with Obsidian.');return;}try{ledger().put({key:`word:${code}:${encodeURIComponent(dictionaryResult.word)}`,language:code,kind:'word',data:{word:dictionaryResult.word,meaning:dictionaryResult.meaning,source:dictionaryResult.source}});queueSync();notify('Word saved to your notebook and Obsidian sync queue.');}catch(error){notify(error.message);}return;}
  if(b.dataset.say){speak(b.dataset.say,b.dataset.wordId);return}
  if(b.dataset.inlineRule!==undefined){showInline(Number(b.dataset.inlineRule));return}
  if(b.dataset.next){advance(b.dataset.next,1);return}if(b.dataset.previous){advance(b.dataset.previous,-1);return}
  if(b.dataset.reveal){const q=findQuestion(b.dataset.reveal);b.closest('.question').querySelector('.feedback-slot').innerHTML=feedback(q,'',true);return}
  if(b.dataset.mark){if(signedIn())persistForm(b.closest('.question').querySelector('form'),'submitted',b.dataset.mark);else state().attempts[b.dataset.markId]=b.dataset.mark;const persisted=signedIn()||save();const summary=$('.progress-summary');if(summary)summary.textContent=Object.keys(state().attempts).length+' of '+allQuestions().length+' questions marked · '+Object.values(state().attempts).filter(x=>x==='review').length+' to revisit';if(persisted)notify(b.dataset.mark==='review'?'Saved for another practice session.':'Marked as a form you can use.');if(practiceReview&&b.dataset.mark==='correct'&&b.closest('#main-question'))render();return}
  if(b.dataset.chunk){const text=b.closest('.question').querySelector('textarea');text.value+=(text.value&&code!=='zh'&&code!=='ja'?' ':'')+b.dataset.chunk;persistForm(text.closest('form'));text.focus();return}
  if(b.dataset.readRule!==undefined){pendingReadRule=Number(b.dataset.readRule);const hash='#'+code+'/grammar';if(location.hash===hash)route();else location.hash=hash;return}
  if(b.dataset.saveWord){const s=state();if(signedIn()){const w=course.words.find(w=>w.id===b.dataset.saveWord);ledger().put({key:`word:${code}:${w.id}`,language:code,kind:'word',data:{word:w.word,meaning:w.meaning,source:w.source||''},deleted:s.words.includes(w.id)});queueSync();}else{s.words=s.words.includes(b.dataset.saveWord)?s.words.filter(w=>w!==b.dataset.saveWord):[...s.words,b.dataset.saveWord];save();}$('#word-results').innerHTML=wordListHtml();return}
  if(b.dataset.wordPage){wordPage+=Number(b.dataset.wordPage);$('#word-results').innerHTML=wordListHtml();$('#word-results').scrollIntoView({block:'start',behavior:'instant'});return}
});
document.addEventListener('input',e=>{if(e.target.closest('.question-form'))persistForm(e.target.closest('form'));if(e.target.id==='word-search'){wordQuery=e.target.value;wordPage=0;$('#word-results').innerHTML=wordListHtml()}});
document.addEventListener('change',e=>{
  if(e.target.id==='progress-file'){importProgress(e.target.files[0]);return}
  if(e.target.id==='language-select')location.hash=e.target.value+'/'+tab;
  if(e.target.id==='practice-rule'){practiceRule=e.target.value;practiceIndex=0;render()}
  if(e.target.id==='practice-type'){practiceType=e.target.value;practiceIndex=0;render()}
  if(e.target.id==='practice-set'){practiceReview=e.target.value==='review';practiceIndex=0;render()}
  if(e.target.id==='speech-rate')applyPlaybackSpeed();
  if(e.target.id==='word-pos'){wordPos=e.target.value;wordPage=0;$('#word-results').innerHTML=wordListHtml()}
  if(e.target.id==='word-saved'){onlySaved=e.target.value==='saved';wordPage=0;$('#word-results').innerHTML=wordListHtml()}
  if(e.target.id==='word-track'){const n=Number(e.target.value);$('#word-player').src=encodeURI(`Audio/${code}/Words ${String(n*50+1).padStart(4,'0')}-${String(n*50+50).padStart(4,'0')}.mp3`)}
});
$('#audio-settings').addEventListener('click',()=>{$('#sound-settings').hidden=!$('#sound-settings').hidden;$('#audio-settings').setAttribute('aria-expanded',String(!$('#sound-settings').hidden))});

$('#export-progress').addEventListener('click',exportProgress);
document.addEventListener('play',e=>{if(e.target instanceof HTMLAudioElement){e.target.playbackRate=Number($('#speech-rate').value);document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause()});currentSound?.pause();window.speechSynthesis?.cancel()}},true);
$('#language-select').innerHTML=Object.entries(LANGUAGES).map(([c,n])=>`<option value="${c}">${esc(n)}</option>`).join('');
$('#language-nav').innerHTML=Object.entries(LANGUAGES).map(([c,n])=>`<a href="#${c}/start" data-lang="${c}">${esc(n)}</a>`).join('');
async function route(){
  const version=++routeVersion;
  const bits=location.hash.replace(/^#/,'').split('/');
  let remembered='fr';try{remembered=localStorage.getItem(storageKey+':language')||'fr'}catch{}
  const next=LANGUAGES[bits[0]]?bits[0]:LANGUAGES[remembered]?remembered:'fr';
  tab=['start','grammar','practice','words','reading','notebook'].includes(bits[1])?bits[1]:'start';
  try{
    if(!course||code!==next){if(!await loadLanguage(next,version))return}else render();
    if(version!==routeVersion)return;
    if(bits[2]&&tab==='practice'){
      practiceRule='';practiceType='';practiceReview=false;
      const target=allQuestions().findIndex(q=>q.id===bits[2]);
      if(target>=0){practiceIndex=target;render();}else notify('That private question is unavailable. Sign in to its account or open My notebook.');
    }
    const exerciseTarget=bits[2]&&tab==='grammar'?findQuestion(bits[2]):null;
    const ri=pendingReadRule;pendingReadRule=null;
    requestAnimationFrame(()=>{if(exerciseTarget?.type==='written'){const el=$(`#exercise-${exerciseTarget.section}-${exerciseTarget.id.split('-').at(-1)}`);if(el){for(let node=el;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;el.scrollIntoView({block:'start',behavior:'instant'});return;}}if(ri!==null&&tab==='grammar'){const el=$('#rule-'+ri);if(el){el.open=true;el.closest('.section').open=true;el.scrollIntoView({block:'start',behavior:'instant'});return}}window.scrollTo({top:0,left:0,behavior:'instant'})});
  }catch(error){
    if(version!==routeVersion||error.name==='AbortError')return;
    $('#main').innerHTML='<h1>'+esc(LANGUAGES[next])+' could not open.</h1><p>Connect to the internet and try again. For offline study, first save this language in Study tools while you are online.</p><button class="primary" data-retry>Try again</button>';
  }
}
$('.skip').addEventListener('click',event=>{event.preventDefault();$('#main').focus();$('#main').scrollIntoView({block:'start'})});
$('#study-tools-toggle').addEventListener('click',()=>{const tools=$('#study-tools');tools.open=!tools.open;if(tools.open)tools.scrollIntoView({block:'nearest'})});
$('#study-tools').addEventListener('toggle',()=>$('#study-tools-toggle').setAttribute('aria-expanded',String($('#study-tools').open)));
$('#import-progress').addEventListener('click',()=>$('#progress-file').click());
$('#copy-local-progress').addEventListener('click',()=>{
  if(!signedIn()){notify('Sign in in My notebook first, then copy this language’s local marks.');return;}
  const local=progress[code];if(!local){notify('There are no local marks for this language.');return;}
  for(const [id,mark]of Object.entries(local.attempts)){const q=findQuestion(id);if(q&&!ledger().get('answer:'+id))savePrivateAnswer(code,q,'','submitted',mark);}
  for(const id of local.words){const w=course.words.find(w=>w.id===id);if(w&&!ledger().get(`word:${code}:${id}`))ledger().put({key:`word:${code}:${id}`,language:code,kind:'word',data:{word:w.word,meaning:w.meaning,source:w.source||''}});}
  queueSync();notify('Local marks copied. Existing account records were kept.');if(tab==='practice')render();
});
window.addEventListener('hashchange',route);
document.addEventListener('study:notice',e=>notify(e.detail));
document.addEventListener('study:ready',()=>{if(course)render();});
document.addEventListener('study:change',()=>{
  if(!course)return;
  // Do not replace an editor underneath the person typing in it.
  if(tab==='notebook'){
    refreshNotebook(code);
    return;
  }
  document.querySelectorAll('.question-form').forEach(form=>{
    if(form.contains(document.activeElement))return;
    const data=savedAnswer(form.dataset.qid);if(!data)return;
    form.querySelectorAll('[name="answer"]').forEach(input=>{if(input.type==='radio')input.checked=input.value===data.answer;else input.value=data.answer;});
    const q=findQuestion(form.dataset.qid);if(q&&data.status==='submitted')form.closest('.question').querySelector('.feedback-slot').innerHTML=feedback(q,data.answer,false);
  });
});
initCloud();
if(storageProblem)notify('Saved progress could not be read. You can import a backup in Study tools.');

let registration, offlinePacks, savingCode=null, savedCodes=[], offlineUnavailable=null, offlineError=null;
const offlineLabel = $('#offline-status');
const offlineButton = $('#save-offline');
function updateOfflineStatus(){
  if(savingCode){offlineButton.disabled=true;return}
  offlineButton.disabled=!registration;
  offlineButton.textContent=savedCodes.includes(code)?'Refresh offline copy':'Save this language offline';
  if(!registration){offlineLabel.textContent=offlineUnavailable||(window.isSecureContext?'Preparing offline study…':'Offline study needs an HTTPS website or localhost.');return}
  if(offlineError?.code===code){offlineLabel.textContent=offlineError.message;return}
  const pack=offlinePacks?.[code];
  offlineLabel.textContent=savedCodes.includes(code)?LANGUAGES[code]+' is saved on this device. Your browser may clear it if storage runs low.':pack?'Includes lessons, PDF and recorded audio · about '+Math.ceil(pack.bytes/1024/1024)+' MB. Dictionary recordings still need internet.':'Save the lessons, PDF and recorded audio on this device.';
}
function workerMessage(worker,message,onProgress){
  return new Promise((resolve,reject)=>{
    const channel=new MessageChannel();
    let timer=setTimeout(()=>{channel.port1.close();reject(new Error('Offline saving timed out. Connect to the internet and try again.'))},120000);
    channel.port1.onmessage=event=>{
      const data=event.data;
      if(data.type==='progress'){clearTimeout(timer);timer=setTimeout(()=>{channel.port1.close();reject(new Error('Offline saving timed out. Try again.'))},120000);onProgress?.(data);return}
      clearTimeout(timer);channel.port1.close();data.error?reject(new Error(data.error)):resolve(data);
    };
    worker.postMessage(message,[channel.port2]);
  });
}
async function refreshSaved(){
  if(!registration?.active)return;
  try{savedCodes=(await workerMessage(registration.active,{type:'STATUS'})).codes;updateOfflineStatus()}catch{}
}
async function setupOffline(){
  if(!('serviceWorker' in navigator)||!window.isSecureContext){offlineUnavailable='Offline saving is unavailable in this browser. Use the PDF or Obsidian download.';updateOfflineStatus();return}
  try{
    registration=await navigator.serviceWorker.register('sw.js',{scope:'./'});
    await navigator.serviceWorker.ready;
    const response=await fetch('offline-packs.json');if(response.ok)offlinePacks=await response.json();
    await refreshSaved();updateOfflineStatus();
    const showUpdate=()=>{$('#update-site').hidden=false};
    if(registration.waiting)showUpdate();
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate()})});
  }catch{registration=null;offlineButton.disabled=true;offlineUnavailable='Offline saving could not start. Reconnect and reload, or download the PDF and Obsidian notes.';updateOfflineStatus()}
}
offlineButton.addEventListener('click',async()=>{
  if(!registration?.active||savingCode)return;
  const selected=code;savingCode=selected;offlineError=null;offlineButton.disabled=true;
  $('#offline-progress').hidden=false;$('#offline-progress').removeAttribute('value');
  offlineLabel.textContent='Saving '+LANGUAGES[selected]+' on this device…';
  try{
    navigator.storage?.persist?.().catch(()=>{});
    await workerMessage(registration.active,{type:'CACHE_LANGUAGE',code:selected},data=>{
      $('#offline-progress').max=data.total;$('#offline-progress').value=data.done;
      offlineLabel.textContent='Saving '+LANGUAGES[selected]+' · '+data.done+' of '+data.total+' files';
    });
    notify(LANGUAGES[selected]+' is ready for offline study on this device.');
  }catch(error){offlineError={code:selected,message:error.message};notify(error.message);offlineLabel.textContent=error.message}
  finally{savingCode=null;$('#offline-progress').hidden=true;await refreshSaved();updateOfflineStatus()}
});
let reloading=false;
$('#update-site').addEventListener('click',()=>{if(registration?.waiting){reloading=true;registration.waiting.postMessage({type:'ACTIVATE'})}else location.reload()});
navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(reloading)location.reload()});
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install-site').hidden=false});
$('#install-site').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('#install-site').hidden=true}});
setupOffline();
route();

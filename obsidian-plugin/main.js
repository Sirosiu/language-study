import { Plugin, PluginSettingTab, Setting, Modal, Notice, TFile, MarkdownView, normalizePath, requestUrl } from 'obsidian';
import { StudyService } from '../shared/study-service.js';
import { LANGUAGES, sameContent, answerRecord, customQuestion, uuid } from '../shared/study-model.js';
import { PRIVATE_START, PRIVATE_END, parsePrivateMarkdown, replacePrivateMarkdown } from '../shared/study-markdown.js';
import defaultConfig from '../web/cloud-config.json';

const DEFAULTS={...defaultConfig,folder:'Language Study',website:'https://sirosiu.github.io/language-study/'};
class PracticeModal extends Modal {
  constructor(plugin,code,id){super(plugin.app);this.plugin=plugin;this.code=code||'fr';this.id=id||this.code+'-Q0001';this.version=0;}
  onOpen(){
    this.contentEl.addClass('ls-question');this.contentEl.createEl('h2',{text:'Answer a course question'});
    this.contentEl.createEl('p',{text:'Choose a question ID from your course note. Your answer saves here and on the website, even if you start in Obsidian.'});
    const languageLabel=this.contentEl.createEl('label',{text:'Language'});this.language=languageLabel.createEl('select');
    for(const [code,name]of Object.entries(LANGUAGES))this.language.createEl('option',{value:code,text:name});this.language.value=this.code;
    const idLabel=this.contentEl.createEl('label',{text:'Question ID'});this.idInput=idLabel.createEl('input',{value:this.id});
    const load=this.contentEl.createEl('button',{text:'Open question'});this.status=this.contentEl.createEl('p',{cls:'ls-status'});this.body=this.contentEl.createDiv();
    load.onclick=()=>this.load();this.language.onchange=()=>{this.idInput.value=this.language.value+'-Q0001';this.load();};this.load();
  }
  async load(){
    const version=++this.version,code=this.language.value,id=this.idInput.value.trim();this.status.setText('Opening the question…');this.body.empty();
    try{
      const q=await this.plugin.getQuestion(code,id);if(version!==this.version)return;
      this.status.setText(q.id+' · '+q.type);this.body.createEl('h3',{text:q.title||'Course practice'});
      const stimulus=q.type==='translate'?q.translation:q.type==='order'?'Arrange: '+q.chunks.join(' / '):q.type==='edit'?q.before+'【'+q.changed+'】'+q.after:q.type==='explain'?q.before+'【'+q.key+'】'+q.after:q.custom?q.prompt:q.before+'____'+q.after;
      this.body.createEl('p',{text:stimulus});if(q.type!=='translate'&&q.translation)this.body.createEl('p',{text:q.translation});if(q.type==='choice')this.body.createEl('p',{text:'Choices: '+q.options.join(' / ')});
      const old=this.plugin.service.ledger.get('answer:'+q.id)?.data;
      const answerLabel=this.body.createEl('label',{text:'Your answer'}),answer=answerLabel.createEl('textarea');answer.value=old?.answer||'';
      const markLabel=this.body.createEl('label',{text:'Review choice'}),mark=markLabel.createEl('select');
      for(const [value,text]of [['','No review mark yet'],['correct','I can use this'],['review','Practise again later']])mark.createEl('option',{value,text});mark.value=old?.mark||'';
      let submitted=old?.status==='submitted';
      const save=()=>{try{this.plugin.service.ledger.put(answerRecord(code,q,answer.value,submitted?'submitted':'draft',mark.value));this.plugin.scheduleSync();this.status.setText(q.id+' · saved on this device; syncing when connected');}catch(e){this.status.setText(e.message);}};
      answer.oninput=()=>{submitted=false;save();};mark.onchange=save;
      const compare=this.body.createEl('button',{text:'Compare my answer',cls:'mod-cta'}),model=this.body.createEl('details');model.createEl('summary',{text:'Model answer and explanation'});model.createEl('p',{text:q.answer});model.createEl('p',{text:q.explanation||'Compare the meaning and structure; open answers may have more than one valid wording.'});
      compare.onclick=()=>{submitted=true;save();model.open=true;};
    }catch(e){if(version===this.version)this.status.setText(e.message);}
  }
  onClose(){this.version++;this.contentEl.empty();}
}
class LoginModal extends Modal {
  constructor(plugin){super(plugin.app);this.plugin=plugin;}
  onOpen(){
    this.contentEl.addClass('ls-login');this.contentEl.createEl('h2',{text:'Open your private language study'});
    this.contentEl.createEl('p',{text:'Use the same email and password as the website. This device’s session stays outside your Syncthing vault.'});
    const emailLabel=this.contentEl.createEl('label',{text:'Email'}),email=emailLabel.createEl('input',{type:'email'});email.autocomplete='username';
    const passwordLabel=this.contentEl.createEl('label',{text:'Password'}),password=passwordLabel.createEl('input',{type:'password'});password.autocomplete='current-password';
    const status=this.contentEl.createEl('p',{cls:'ls-status'}),actions=this.contentEl.createDiv('ls-actions');
    const signIn=actions.createEl('button',{text:'Sign in',cls:'mod-cta'});
    const submit=async()=>{signIn.disabled=true;try{await this.plugin.service.signIn(email.value.trim(),password.value);password.value='';new Notice('Language Study signed in on this device.');this.close();this.plugin.refreshAll();}catch(e){status.setText(e.message);}finally{signIn.disabled=false;}};
    signIn.onclick=submit;password.onkeydown=e=>{if(e.key==='Enter')submit();};
    actions.createEl('a',{text:'Create an account on the website',href:this.plugin.settings.website+'#fr/notebook'});
  }
  onClose(){this.contentEl.empty();}
}
class QuestionModal extends Modal {
  constructor(plugin){super(plugin.app);this.plugin=plugin;}
  onOpen(){
    this.contentEl.addClass('ls-question');this.contentEl.createEl('h2',{text:'Add my question'});
    const controls={};const label=this.contentEl.createEl('label',{text:'Language'});controls.language=label.createEl('select');
    for(const [code,name]of Object.entries(LANGUAGES))controls.language.createEl('option',{value:code,text:name});
    const active=this.app.workspace.getActiveFile();const selected=this.plugin.codeFor(active?.path);if(selected)controls.language.value=selected;
    const typeLabel=this.contentEl.createEl('label',{text:'Question type'});controls.type=typeLabel.createEl('select');
    for(const [value,text]of [['translate','Translation'],['explain','Explain a rule'],['written','Written practice']])controls.type.createEl('option',{value,text});
    for(const [name,title]of [['title','Title'],['prompt','Prompt'],['native','Native sentence (optional)'],['translation','Translation (optional)'],['answer','Model answer'],['explanation','Explanation (optional)']]){
      const l=this.contentEl.createEl('label',{text:title});controls[name]=l.createEl(name==='title'?'input':'textarea');
    }
    const status=this.contentEl.createEl('p');const button=this.contentEl.createEl('button',{text:'Save my question',cls:'mod-cta'});
    button.onclick=()=>{try{const code=controls.language.value;const data=Object.fromEntries(Object.entries(controls).filter(([key])=>key!=='language').map(([key,el])=>[key,el.value]));this.plugin.service.ledger.put({key:`question:${code}-U-${uuid()}`,language:code,kind:'question',data});this.plugin.scheduleSync();this.plugin.refreshAll();this.close();new Notice('Question added to Obsidian and the website sync queue.');}catch(e){status.setText(e.message);}};
  }
  onClose(){this.contentEl.empty();}
}
class ConflictModal extends Modal {
  constructor(plugin){super(plugin.app);this.plugin=plugin;}
  onOpen(){this.draw();}
  draw(){
    this.contentEl.empty();this.contentEl.addClass('ls-conflicts');this.contentEl.createEl('h2',{text:'Choose between simultaneous edits'});
    const ledger=this.plugin.service.ledger;
    const conflicts=Object.entries(ledger.conflicts);
    if(!conflicts.length)this.contentEl.createEl('p',{text:'No conflicts. Your edits can sync normally.'});
    for(const [key,c]of conflicts){
      this.contentEl.createEl('h3',{text:key});this.contentEl.createEl('h4',{text:'This device'});this.contentEl.createEl('pre',{text:JSON.stringify(ledger.get(key).data,null,2)});
      this.contentEl.createEl('h4',{text:'Cloud'});this.contentEl.createEl('pre',{text:JSON.stringify(c.remote?.data||null,null,2)});
      const actions=this.contentEl.createDiv('ls-actions');
      for(const [choice,text]of [['local','Keep this device’s version'],['remote','Use the cloud version']])actions.createEl('button',{text}).onclick=()=>{ledger.resolve(key,choice);this.plugin.scheduleSync();this.plugin.refreshAll();this.draw();};
    }
  }
  onClose(){this.contentEl.empty();}
}
class StudySettings extends PluginSettingTab {
  constructor(app,plugin){super(app,plugin);this.plugin=plugin;}
  display(){
    const el=this.containerEl;el.empty();el.createEl('h2',{text:'Language Study sync'});
    el.createEl('p',{text:'The public project URL/key and course folder sync with Syncthing. Login tokens and pending edits stay in this device’s local storage.'});
    for(const [key,name]of [['url','Supabase project URL'],['key','Publishable or anon key'],['folder','Course folder'],['website','Website URL']])new Setting(el).setName(name).addText(input=>input.setValue(this.plugin.settings[key]).onChange(async value=>{this.plugin.settings[key]=value.trim();await this.plugin.saveData(this.plugin.settings);}));
    new Setting(el).setName('Apply connection settings').addButton(b=>b.setButtonText('Reconnect').onClick(async()=>{await this.plugin.connect();this.display();}));
    el.createEl('p',{text:this.plugin.service?.ledger.user?'Signed in as '+this.plugin.service.ledger.user.email:'Signed out on this device.'});
    new Setting(el).setName('Account').addButton(b=>b.setButtonText('Sign in').onClick(()=>new LoginModal(this.plugin).open())).addButton(b=>b.setButtonText('Sign out').onClick(async()=>{await this.plugin.signOut();this.display();}));
    new Setting(el).setName('One main note for each language').setDesc('Install the public course notes in the selected folder. Existing notes are kept. This can take a minute.').addButton(b=>b.setButtonText('Install course notes').onClick(async()=>{b.setDisabled(true);try{await this.plugin.installCourse();}catch(e){new Notice(e.message,10000);}finally{b.setDisabled(false);}}));
    new Setting(el).setName('Sync and conflicts').addButton(b=>b.setButtonText('Sync now').onClick(()=>this.plugin.syncNow())).addButton(b=>b.setButtonText('Review conflicts').onClick(()=>new ConflictModal(this.plugin).open()));
    new Setting(el).setName('Private backup').setDesc('Export your private records to a JSON file inside this vault. Keep it private.').addButton(b=>b.setButtonText('Export backup').onClick(()=>this.plugin.exportBackup()));
  }
}
export default class LanguageStudyPlugin extends Plugin {
  async onload(){
    this.settings={...DEFAULTS,...await this.loadData()};this.jobs=Promise.resolve();this.timers=new Map();this.renderScheduled=false;this.mirror={};
    // localStorage belongs to this Obsidian installation, including on iOS/Android.
    this.devicePrefix=`language-study-obsidian:${this.app.appId||this.app.vault.getName()}`;
    this.statusEl=this.addStatusBarItem();
    this.addSettingTab(new StudySettings(this.app,this));
    this.addCommand({id:'sign-in',name:'Sign in on this device',callback:()=>new LoginModal(this).open()});
    this.addCommand({id:'sync-now',name:'Sync now',callback:()=>this.syncNow()});
    this.addCommand({id:'answer-course-question',name:'Answer a course question',callback:()=>{
      if(!this.service?.ledger.user){new Notice('Sign in to Language Study first.');return;}
      const file=this.app.workspace.getActiveFile(),code=this.codeFor(file?.path)||'fr',view=this.app.workspace.getActiveViewOfType(MarkdownView),editor=view?.editor;
      const before=editor?editor.getValue().split('\n').slice(0,editor.getCursor().line+1).join('\n'):'';
      const id=[...before.matchAll(new RegExp(`\\b${code}-(?:Q[0-9]{4}|U-[0-9a-f-]{36}|E[0-9]{1,3}-[0-9]{1,3})\\b`,'g'))].at(-1)?.[0];
      new PracticeModal(this,code,id).open();
    }});
    this.addCommand({id:'add-question',name:'Add my question',callback:()=>{if(!this.service?.ledger.user){new Notice('Sign in to Language Study first.');return;}new QuestionModal(this).open();}});
    this.addCommand({id:'review-conflicts',name:'Review simultaneous edits',callback:()=>new ConflictModal(this).open()});
    this.addCommand({id:'install-course',name:'Install consolidated course notes',callback:()=>this.installCourse().catch(e=>new Notice(e.message))});
    this.addCommand({id:'export-backup',name:'Export private backup',callback:()=>this.exportBackup()});
    this.registerEvent(this.app.vault.on('modify',file=>{if(!this.codeFor(file.path)||!this.service?.ledger.user)return;clearTimeout(this.timers.get(file.path));this.timers.set(file.path,setTimeout(()=>this.enqueue(()=>this.refreshFile(file)),1000));}));
    this.registerDomEvent(window,'online',()=>this.syncNow());
    this.registerDomEvent(document,'visibilitychange',()=>{if(!document.hidden)this.syncNow();});
    this.app.workspace.onLayoutReady(()=>this.connect());
  }
  async connect(){
    this.service?.close();
    try{
      this.service=new StudyService(this.settings,{storage:localStorage,prefix:this.devicePrefix,onChange:()=>this.refreshAll(),onStatus:s=>{this.statusEl.setText(!s.signedIn?'Language Study: signed out':s.conflicts?`Language Study: ${s.conflicts} conflicts`:s.error?'Language Study: waiting to sync':s.pending?`Language Study: ${s.pending} edits pending`:'Language Study: synced');this.statusEl.title=s.error||'Open Language Study settings to sync or review conflicts.';}});
      await this.service.start();this.loadMirror();this.refreshAll();
    }catch(e){new Notice('Language Study: '+e.message,10000);}
  }
  mirrorKey(){return `${this.devicePrefix}:mirror:${new URL(this.settings.url).hostname}:${this.service.ledger.user?.id}`;}
  loadMirror(){try{this.mirror=JSON.parse(localStorage.getItem(this.mirrorKey())||'{}');}catch{this.mirror={};}}
  codeFor(path){return Object.keys(LANGUAGES).find(code=>path===normalizePath(`${this.settings.folder}/${LANGUAGES[code]}.md`));}
  async getQuestion(code,id){
    const custom=this.service.ledger.get('question:'+id);if(custom&&!custom.deleted&&custom.language===code)return customQuestion(custom);
    this.courseCache ||= {};
    if(!this.courseCache[code]){
      const file=this.app.vault.getAbstractFileByPath(normalizePath(`${this.settings.folder}/Resources/Course/${code}.json`));
      this.courseCache[code]=file instanceof TFile?JSON.parse(await this.app.vault.read(file)):(await requestUrl({url:new URL(`data/${code}.json`,this.settings.website).href})).json;
    }
    const course=this.courseCache[code],q=course.questions.find(q=>q.id===id);if(q)return q;
    const match=id.match(new RegExp(`^${code}-E([0-9]{1,3})-([0-9]{1,3})$`)),exercise=match&&course.sections[Number(match[1])]?.exercises[Number(match[2])];
    if(exercise)return {id,type:'written',title:'Writing and reasoning',prompt:exercise[0],answer:exercise[1],translation:'',custom:true};
    throw new Error('Question not found. Copy its full ID from the course, for example '+code+'-Q0001.');
  }
  enqueue(job){this.jobs=this.jobs.then(job).catch(e=>new Notice('Language Study: '+e.message,10000));return this.jobs;}
  refreshAll(){
    this.lastRender={};
    if(!this.service?.ledger.user||this.renderScheduled)return;
    if(this.currentOwner!==this.service.ledger.user.id){this.currentOwner=this.service.ledger.user.id;this.loadMirror();}
    this.renderScheduled=true;setTimeout(()=>{this.renderScheduled=false;this.enqueue(async()=>{for(const code of Object.keys(LANGUAGES)){const file=this.app.vault.getAbstractFileByPath(normalizePath(`${this.settings.folder}/${LANGUAGES[code]}.md`));if(file instanceof TFile)await this.refreshFile(file);}});},300);
  }
  async refreshFile(file){
    if(!this.service?.ledger.user)return;
    const code=this.codeFor(file.path);if(!code)return;const ledger=this.service.ledger,owner=ledger.user.id;
    let renderedItems,changed=false;
    const existing=await this.app.vault.read(file);
    if(this.lastRenderOwner===owner&&this.lastRender?.[file.path]===existing)return;
    await this.app.vault.process(file,text=>{
      if(ledger.user?.id!==owner)return text;
      const taggedOwner=text.match(/<!-- language-study:owner ([0-9a-f-]+) -->/);
      if(taggedOwner&&taggedOwner[1]!==owner)throw new Error('This note belongs to a different account. Choose another course folder in Language Study settings.');
      const hasMarkers=text.includes(PRIVATE_START)||text.includes(PRIVATE_END);
      const parsed=hasMarkers?parsePrivateMarkdown(text,code):[];
      const before=this.mirror[file.path]||{};
      for(const item of parsed){
        if(sameContent(item,before[item.key])||sameContent(item,ledger.get(item.key)))continue;
        // Stale Syncthing files become visible conflicts rather than replacing newer cloud edits.
        ledger.put(item,item.revision);
        changed=true;
      }
      renderedItems=ledger.items(code,null,true);
      let next=replacePrivateMarkdown(text,code,renderedItems);
      if(!taggedOwner)next=next.replace(PRIVATE_START,`<!-- language-study:owner ${owner} -->\n${PRIVATE_START}`);
      this.lastRender ||= {};this.lastRender[file.path]=next;this.lastRenderOwner=owner;
      return next;
    });
    if(renderedItems){this.mirror[file.path]=Object.fromEntries(renderedItems.map(i=>[i.key,i]));localStorage.setItem(this.mirrorKey(),JSON.stringify(this.mirror));}
    if(changed)this.scheduleSync();
  }
  scheduleSync(){clearTimeout(this.syncTimer);this.syncTimer=setTimeout(()=>this.service?.ledger.sync(),1000);}
  async syncNow(){if(!this.service?.ledger.user){new Notice('Sign in to Language Study on this device first.');return;}await this.enqueue(async()=>{for(const code of Object.keys(LANGUAGES)){const f=this.app.vault.getAbstractFileByPath(normalizePath(`${this.settings.folder}/${LANGUAGES[code]}.md`));if(f instanceof TFile)await this.refreshFile(f);}});await this.service.ledger.sync();this.refreshAll();}
  async ensureFolder(folder){const parts=normalizePath(folder).split('/');let current='';for(const p of parts){current=current?current+'/'+p:p;if(!this.app.vault.getAbstractFileByPath(current))await this.app.vault.createFolder(current);}}
  async installCourse(){
    if(!this.settings.folder||this.settings.folder.includes('..'))throw new Error('Choose a course folder inside your vault.');
    await this.ensureFolder(this.settings.folder);new Notice('Installing the 15 consolidated language notes…');
    const website=new URL(this.settings.website);if(website.protocol!=='https:')throw new Error('Use an HTTPS course website.');
    for(const [code,name]of Object.entries(LANGUAGES)){
      const path=normalizePath(`${this.settings.folder}/${name}.md`);
      if(!this.app.vault.getAbstractFileByPath(path)){
        const response=await requestUrl({url:new URL(`Notes/${code}.md`,website).href});
        const note=response.text.replace(/!\[\[Resources\/([^\]]+)\]\]/g,(_match,resource)=>`[Open recording or PDF](${new URL(resource.replace(/^PDFs\//,'Books/'),website).href})`);
        await this.app.vault.create(path,note);
      }
      const coursePath=normalizePath(`${this.settings.folder}/Resources/Course/${code}.json`);
      if(!this.app.vault.getAbstractFileByPath(coursePath)){await this.ensureFolder(`${this.settings.folder}/Resources/Course`);await this.app.vault.create(coursePath,(await requestUrl({url:new URL(`data/${code}.json`,website).href})).text);}
    }
    const index=normalizePath(`${this.settings.folder}/Start Here.md`);if(!this.app.vault.getAbstractFileByPath(index))await this.app.vault.create(index,`# Language Study\n\n${Object.values(LANGUAGES).map(name=>`- [[${name}]]`).join('\n')}\n\nSign in using Language Study settings. Your notebook, answers and added questions appear at the end of each language note. Use the website for individual audio and dictionary lookup.\n`);
    const sources=normalizePath(`${this.settings.folder}/Sources and licenses.md`);if(!this.app.vault.getAbstractFileByPath(sources))await this.app.vault.create(sources,(await requestUrl({url:new URL('sources.md',website).href})).text);
    this.refreshAll();new Notice('Language notes installed. Existing notes were kept.');
  }
  async exportBackup(){if(!this.service?.ledger.user){new Notice('Sign in before exporting private records.');return;}await this.ensureFolder(this.settings.folder);const path=normalizePath(`${this.settings.folder}/Private backup ${new Date().toISOString().replace(/[:.]/g,'-')}.json`);await this.app.vault.create(path,JSON.stringify(this.service.ledger.backup(),null,2));new Notice('Private backup saved in the course folder.');}
  async signOut(){if(this.service?.ledger.status().pending)new Notice('Pending edits stay in this device’s account backup. Sign back in to finish syncing.');await this.service?.signOut();this.mirror={};}
  onunload(){clearTimeout(this.syncTimer);for(const timer of this.timers.values())clearTimeout(timer);this.service?.close();}
}

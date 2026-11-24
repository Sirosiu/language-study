export const LANGUAGES = Object.freeze({ar:'Arabic',da:'Danish',nl:'Dutch',en:'English',fi:'Finnish',fr:'French',de:'German',ka:'Georgian',it:'Italian',ja:'Japanese',ko:'Korean',zh:'Mandarin Chinese',ru:'Russian',es:'Spanish',tr:'Turkish'});
export function uuid(source=globalThis.crypto){
  if(source.randomUUID)return source.randomUUID();
  const bytes=source.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, limit, name) => {
  if (typeof value !== 'string' || value.length > limit) throw new Error(`Invalid ${name}.`);
  return value.replace(/\r\n?/g,'\n').normalize('NFC').trim();
};
export function questionId(id, code) {
  return typeof id === 'string' && (new RegExp(`^${code}-Q(?:0[0-9]{3}|1000)$`).test(id) && !id.endsWith('0000') || new RegExp(`^${code}-U-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`).test(id) || new RegExp(`^${code}-E[0-9]{1,3}-[0-9]{1,3}$`).test(id));
}
export function normaliseItem(raw) {
  if (!plain(raw) || !Object.hasOwn(LANGUAGES,raw.language) || !plain(raw.data)) throw new Error('Invalid study record.');
  const { key, language: code, kind } = raw;
  if (typeof key !== 'string' || key.length > 512) throw new Error('Invalid record key.');
  let data;
  if (kind === 'answer') {
    if (!key.startsWith('answer:') || !questionId(key.slice(7),code)) throw new Error('Invalid question identifier.');
    const d=raw.data;
    if (!['draft','submitted'].includes(d.status) || !['','correct','review'].includes(d.mark)) throw new Error('Invalid answer state.');
    data={answer:text(d.answer,20000,'answer'),status:d.status,mark:d.mark,prompt:text(d.prompt||'',12000,'prompt'),translation:text(d.translation||'',12000,'translation'),modelAnswer:text(d.modelAnswer||'',20000,'model answer'),type:text(d.type||'',30,'question type')};
  } else if (kind === 'note') {
    if (key !== 'note:'+code) throw new Error('Invalid note identifier.');
    data={markdown:text(raw.data.markdown,512000,'notebook')};
  } else if (kind === 'question') {
    if (!key.startsWith('question:') || !questionId(key.slice(9),code) || !key.slice(9).includes('-U-')) throw new Error('Invalid custom question identifier.');
    const d=raw.data;
    if (!['translate','explain','written'].includes(d.type)) throw new Error('Choose translation, explanation or written practice.');
    data={type:d.type,title:text(d.title||'My question',300,'title'),prompt:text(d.prompt||'',12000,'prompt'),native:text(d.native||'',12000,'sentence'),translation:text(d.translation||'',12000,'translation'),answer:text(d.answer||'',20000,'model answer'),explanation:text(d.explanation||'',20000,'explanation')};
    if (!data.answer || !(data.prompt||data.translation||data.native)) throw new Error('A question needs a prompt and model answer.');
  } else if (kind === 'word') {
    if (!key.startsWith('word:'+code+':') || !/^word:[a-z]{2}:[A-Za-z0-9%_.!~*'()\-]+$/.test(key)) throw new Error('Invalid word identifier.');
    data={word:text(raw.data.word,200,'word'),meaning:text(raw.data.meaning||'',12000,'meaning'),source:text(raw.data.source||'',2000,'word source')};
    if(data.source && !/^https:\/\//.test(data.source)) throw new Error('Invalid dictionary source.');
  } else throw new Error('Unknown study record type.');
  const revision=Number(raw.revision||0);
  if (!Number.isSafeInteger(revision) || revision<0) throw new Error('Invalid record revision.');
  return {key,language:code,kind,data,revision,deleted:raw.deleted===true,origin:typeof raw.origin==='string'?raw.origin:'',updated_at:typeof raw.updated_at==='string'?raw.updated_at:''};
}
export const sameContent = (a,b) => Boolean(a&&b) && a.deleted===b.deleted && JSON.stringify(a.data)===JSON.stringify(b.data);
export function answerRecord(code,q,answer,status='draft',mark='') {
  return normaliseItem({key:'answer:'+q.id,language:code,kind:'answer',data:{answer,status,mark,prompt:q.type==='translate'?q.translation:q.prompt||q.native||'',translation:q.translation||'',modelAnswer:q.answer||'',type:q.type||'written'}});
}
export function customQuestion(item) {
  const d=item.data,id=item.key.slice(9);
  return {id,...d,custom:true,rule:null,section:null,native:d.native||d.answer,translation:d.translation||d.prompt,translationLanguage:item.language==='en'?'English':'English',title:d.title,before:'',key:'',after:'',options:[],chunks:[],source:''};
}

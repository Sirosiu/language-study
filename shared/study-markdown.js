import { LANGUAGES, normaliseItem } from './study-model.js';

export const PRIVATE_START = '<!-- language-study:private -->';
export const PRIVATE_END = '<!-- /language-study:private -->';
const fields = { note: ['markdown'], answer: ['answer'], question: ['type','title','prompt','native','translation','answer','explanation'], word: ['word','meaning','source'] };
const fence = value => '~'.repeat(Math.max(4, ...[...String(value).matchAll(/~+/g)].map(m => m[0].length + 1)));
function field(name, value) {
  const f = fence(value); return `${f}ls-${name}\n${value}\n${f}`;
}
export function itemMarkdown(raw) {
  const item = normaliseItem(raw);
  const meta = { key: item.key, language: item.language, kind: item.kind, revision: item.revision, data: item.kind === 'answer' ? { ...item.data, answer: '' } : {} };
  let html = `<!-- ls:item ${JSON.stringify(meta)} -->\n`;
  if (item.kind === 'note') {
    // A length-prefixed notebook lets ordinary Markdown remain readable/editable.
    // The parser uses its end token, chosen to be absent from the user's content.
    let token = 'notebook-end'; while (item.data.markdown.includes(`<!-- ls:${token} -->`)) token += '-';
    html += `## My notebook\n\n<!-- ls:notebook ${token} -->\n${item.data.markdown}\n<!-- ls:${token} -->\n`;
  } else {
    html += `### ${item.kind === 'answer' ? 'Answer' : item.kind === 'question' ? 'My question' : 'Saved word'} · ${item.key.split(':').slice(1).join(':')}\n\n`;
    if (item.kind === 'answer') {
      html += `**Prompt**\n\n${field('prompt-reference',item.data.prompt)}\n\n**Translation**\n\n${field('translation-reference',item.data.translation)}\n\n**Model answer**\n\n${field('model-reference',item.data.modelAnswer)}\n\n`;
    }
    for (const name of fields[item.kind]) html += `**${name === 'answer' ? 'Your answer' : name.charAt(0).toUpperCase()+name.slice(1)}**\n\n${field(name,item.data[name])}\n\n`;
  }
  if (item.kind === 'answer') html += `- [${item.data.status === 'submitted'?'x':' '}] Submitted\n- [${item.data.mark==='correct'?'x':' '}] I can use this\n- [${item.data.mark==='review'?'x':' '}] Practise again later\n`;
  html += `- [${item.deleted?'x':' '}] Delete this synced item\n<!-- ls:/item -->`;
  return html;
}
export function privateMarkdown(code, items) {
  const active = items.filter(i => i.language === code).sort((a,b) => ({note:0,question:1,answer:2,word:3}[a.kind]-{note:0,question:1,answer:2,word:3}[b.kind] || a.key.localeCompare(b.key)));
  if (!active.some(i=>i.kind==='note')) active.unshift(normaliseItem({key:'note:'+code,language:code,kind:'note',data:{markdown:''}}));
  return `${PRIVATE_START}\n\n# My ${LANGUAGES[code]} study\n\nEdit your notebook as Markdown. Edit answers and question fields inside their fences; keep the markers and fences. Tick Submitted after answering, and choose a review mark. Add questions with the Language Study command. Tick Delete to remove an item from both apps. Removing a whole block does not delete cloud work.\n\n${active.map(itemMarkdown).join('\n\n')}\n\n${PRIVATE_END}`;
}
export function parsePrivateMarkdown(text, code) {
  const start=text.indexOf(PRIVATE_START), end=text.lastIndexOf(PRIVATE_END);
  if(start<0 || end<start) throw new Error('The private study markers are missing. Restore them before syncing.');
  const lines=text.slice(start+PRIVATE_START.length,end).replace(/\r\n?/g,'\n').split('\n');
  const items=[]; let i=0;
  while(i<lines.length) {
    const match=lines[i].match(/^<!-- ls:item (.+) -->$/);
    if(!match){i++;continue;}
    const meta=JSON.parse(match[1]);
    if(meta.language!==code) throw new Error('An item belongs to another language.');
    const data={...meta.data}; let deleted=false, closed=false; i++;
    while(i<lines.length) {
      const line=lines[i];
      if(line==='<!-- ls:/item -->'){closed=true;i++;break;}
      const notebook=line.match(/^<!-- ls:notebook ([a-z-]+) -->$/);
      if(notebook){
        const closing=`<!-- ls:${notebook[1]} -->`, content=[]; i++;
        while(i<lines.length&&lines[i]!==closing)content.push(lines[i++]);
        if(i===lines.length)throw new Error('The notebook end marker is missing.');
        data.markdown=content.join('\n');i++;continue;
      }
      const block=line.match(/^(~{4,})ls-([a-z-]+)$/);
      if(block){
        const content=[];i++;while(i<lines.length&&lines[i]!==block[1])content.push(lines[i++]);
        if(i===lines.length)throw new Error('An answer or question fence is missing.');
        if(fields[meta.kind]?.includes(block[2]))data[block[2]]=content.join('\n');
        i++;continue;
      }
      if(/^- \[[ xX]\] Submitted$/.test(line))data.status=/\[[xX]\]/.test(line)?'submitted':'draft';
      if(/^- \[[xX]\] I can use this$/.test(line))data.mark='correct';
      if(/^- \[[xX]\] Practise again later$/.test(line))data.mark='review';
      if(/^- \[ \] I can use this$/.test(line))data.mark='';
      if(/^- \[[xX]\] Delete this synced item$/.test(line))deleted=true;
      i++;
    }
    if(!closed)throw new Error('A study item end marker is missing.');
    const item=normaliseItem({...meta,data,deleted});
    if(items.some(x=>x.key===item.key))throw new Error('A question ID is duplicated. Keep one block per ID.');
    items.push(item);
  }
  return items;
}
export function replacePrivateMarkdown(text, code, items) {
  const content=privateMarkdown(code,items), start=text.indexOf(PRIVATE_START), end=text.lastIndexOf(PRIVATE_END);
  if(start<0&&end<0)return `${text.trimEnd()}\n\n---\n\n${content}\n`;
  if(start<0||end<start)throw new Error('The private study markers are damaged. Restore them before syncing.');
  return text.slice(0,start)+content+text.slice(end+PRIVATE_END.length);
}

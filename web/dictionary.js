import DOMPurify from 'dompurify';

const names={ar:'Arabic',da:'Danish',nl:'Dutch',en:'English',fi:'Finnish',fr:'French',de:'German',ka:'Georgian',it:'Italian',ja:'Japanese',ko:'Korean',zh:'Chinese',ru:'Russian',es:'Spanish',tr:'Turkish'};
const API='https://en.wiktionary.org/w/api.php';
export function cleanDictionaryHtml(html, base='https://en.wiktionary.org/') {
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('script,style,form,input,button,img,iframe,.toc,.mw-editsection,.noprint,.NavToggle,.audiometa').forEach(el=>el.remove());
  doc.querySelectorAll('[href],[src]').forEach(el=>{
    for(const attr of ['href','src']) {
      if(!el.hasAttribute(attr))continue;
      try {
        const url=new URL(el.getAttribute(attr),base);
        const safe=url.protocol==='https:'&&(attr==='src'?url.hostname==='upload.wikimedia.org':['en.wiktionary.org','commons.wikimedia.org'].includes(url.hostname));
        if(safe)el.setAttribute(attr,url.href);else el.removeAttribute(attr);
      } catch {el.removeAttribute(attr);}
    }
    if(el.tagName==='A'){el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');}
  });
  doc.querySelectorAll('audio').forEach(a=>{a.setAttribute('controls','');a.setAttribute('preload','none');});
  return DOMPurify.sanitize(doc.body.innerHTML, {
    ALLOWED_TAGS:['h2','h3','h4','h5','p','ul','ol','li','dl','dt','dd','strong','b','em','i','span','a','audio','source','br','table','tbody','thead','tr','td','th','sup','sub'],
    ALLOWED_ATTR:['lang','dir','href','target','rel','src','type','controls','preload','colspan','rowspan'],
    ALLOW_DATA_ATTR:false,
  });
}
function languageSection(html, name) {
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('.toc,.mw-editsection').forEach(el=>el.remove());
  const root=doc.querySelector('.mw-parser-output')||doc.body;
  const heading=[...root.querySelectorAll('h2')].find(h=>h.id===name||h.querySelector(`[id="${name}"]`)||h.textContent.trim()===name);
  if(!heading)throw new Error(`The ${name} entry could not be displayed. Open its source or try again.`);
  let first=heading;while(first.parentElement!==root)first=first.parentElement;
  const result=doc.createElement('div');
  for(let node=first;node;node=node.nextElementSibling){
    if(node!==first&&(node.matches('h2')||node.querySelector('h2')))break;
    result.append(node.cloneNode(true));
  }
  return result.innerHTML;
}
async function request(params,signal) {
  const url=new URL(API);url.search=new URLSearchParams({action:'parse',format:'json',origin:'*',...params});
  const response=await fetch(url,{signal});if(!response.ok)throw new Error('Wiktionary is unavailable. Try again or open the source link.');
  const data=await response.json();if(data.error)throw new Error(data.error.code==='missingtitle'?'This word has no Wiktionary entry yet. Try its base form or check the spelling.':data.error.info);
  return data.parse;
}
export async function lookupDictionary(code, query, signal) {
  const word=query.normalize('NFC').trim();if(!word||word.length>200)throw new Error('Enter a word of up to 200 characters.');
  const cacheKey=`language-study:dictionary:v2:${code}:${word}`;
  let cached;try{cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null');}catch{}
  if(cached?.html)return {...cached,html:cleanDictionaryHtml(cached.html),cached:true};
  const toc=await request({page:word,prop:'tocdata',redirects:'1'},signal);
  const section=toc.tocdata?.sections?.find(s=>s.hLevel===2&&s.line===names[code]);
  if(!section)throw new Error(`This entry has no ${names[code]} section. Try the native spelling or a base form.`);
  // Parse the whole source before extracting its language section. Partial parses
  // lose Wiktionary's page context and can break pronunciation/etymology templates.
  const parsed=await request({page:toc.title,prop:'text'},signal);
  const source=`https://en.wiktionary.org/wiki/${encodeURIComponent(toc.title)}#${encodeURIComponent(names[code])}`;
  const html=cleanDictionaryHtml(languageSection(parsed.text['*'],names[code]),source);
  const doc=new DOMParser().parseFromString(html,'text/html');
  const meaning=[...doc.querySelectorAll('ol > li')].slice(0,12).map(li=>li.textContent.trim()).join('\n').slice(0,12000);
  const result={word:toc.title,html,meaning,source};
  try{
    const keys=Object.keys(sessionStorage).filter(k=>k.startsWith('language-study:dictionary:'));
    while(keys.length>=30)sessionStorage.removeItem(keys.shift());sessionStorage.setItem(cacheKey,JSON.stringify(result));
  }catch{}
  return result;
}

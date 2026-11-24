import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { CODES } from '../web/progress.js';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const json = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const exists = async file => {assert((await stat(path.join(root, file))).isFile(), file);};
const manifest = await json('data/manifest.json');
assert.deepEqual(manifest.map(l => l.code).sort(), [...CODES].sort());
const audio = await json('data/audio-manifest.json');
assert.equal(audio.length, 1116);
for (const item of audio) {assert.equal((await stat(path.join(root, item.path))).size, item.bytes);}
const packs = await json('offline-packs.json');
function zipEntries(buffer) {
  const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
  assert(end>=0,'ZIP central directory missing');
  const count=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16);const names=[];
  for(let i=0;i<count;i++) {
    assert.equal(buffer.readUInt32LE(offset),0x02014b50);
    const length=buffer.readUInt16LE(offset+28),extra=buffer.readUInt16LE(offset+30),comment=buffer.readUInt16LE(offset+32);
    names.push(buffer.toString('utf8',offset+46,offset+46+length));offset+=46+length+extra+comment;
  }
  return names;
}
for (const language of manifest) {
  const c = await json(`data/${language.code}.json`);
  assert.equal(c.code, language.code);assert.equal(c.name, language.name);
  assert.equal(c.questions.length,1000);assert.equal(c.words.length,1000);
  assert.equal(new Set(c.questions.map(q=>q.id)).size,1000);
  assert.equal(new Set(c.words.map(w=>w.id)).size,1000);
  for (let i=0;i<1000;i++) {
    assert.equal(c.questions[i].id,`${c.code}-Q${String(i+1).padStart(4,'0')}`);
    assert.equal(c.words[i].id,`${c.code}-V${String(i+1).padStart(4,'0')}`);
    const q=c.questions[i];assert(c.rules[q.rule]);assert(c.typeNames[q.type]);assert(q.answer && q.native && q.translation);
    assert(c.words[i].word && c.words[i].meaning);await exists(c.words[i].audioTrack);
  }
  c.rules.forEach((rule,i)=>assert.equal(rule.questionCount,c.questions.filter(q=>q.rule===i).length));
  for (const type of ['cloze','choice','edit','order','translate','explain']) assert(c.questions.some(q=>q.type===type));
  assert(c.foundation.letters.length && c.foundation.building.length && c.sections.length);
  for(const letter of c.foundation.letters){assert(letter.audio&&letter.audioLabel);await exists(letter.audio);if(c.code==='en')await exists(letter.audioUK);}
  await exists(`Notes/${c.code}.md`);
  const names=zipEntries(await readFile(path.join(root,`downloads/${c.code}-obsidian.zip`)));
  assert(names.some(n=>n.endsWith('Start Here.md')));assert(names.some(n=>n.endsWith(`${c.name}.md`)));
  assert(names.some(n=>n.endsWith(`${c.name}.pdf`)));
  assert.equal(names.filter(n=>n.endsWith('.mp3')).length,audio.filter(a=>a.path.startsWith(`Audio/${c.code}/`)).length);
  for(const file of packs[c.code].files)await exists(file);
}
let total=0,largest={size:0,path:''};
async function walk(dir){for(const name of await readdir(dir)){const file=path.join(dir,name),s=await stat(file);if(s.isDirectory())await walk(file);else{assert(s.size<100*1024*1024,`${file} exceeds GitHub's file limit`);total+=s.size;if(s.size>largest.size)largest={size:s.size,path:path.relative(root,file)};}}}
await walk(root);assert(total<1024*1024*1024,'Site exceeds GitHub Pages size limit');
const index=await readFile(path.join(root,'index.html'),'utf8');
for(const match of index.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^https?:/.test(match[1]))await exists(decodeURI(match[1]));
assert(!(await readFile(path.join(root,'sw.js'),'utf8')).includes('__BUILD_VERSION__'));
await exists('cloud-config.json');await exists('downloads/sirosiu-language-study-plugin.zip');await exists('sync-setup.html');
console.log(`Validated 15,000 questions, 15,000 words, ${audio.length} recordings, 15 PDFs and 15 complete Obsidian vaults.`);
console.log(`Site: ${(total/1024/1024).toFixed(1)} MB; largest file: ${(largest.size/1024/1024).toFixed(1)} MB (${largest.path}).`);

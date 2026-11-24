import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
const base=new URL('../web/',import.meta.url);
const languages=JSON.parse(await readFile(new URL('data/manifest.json',base),'utf8'));
for(const l of languages){
  const course=JSON.parse(await readFile(new URL(`data/${l.code}.json`,base),'utf8'));
  const file=new URL(`downloads/${l.code}-obsidian.zip`,base), entries=unzipSync(await readFile(file));
  let note=strFromU8(entries[`${l.name}/${l.name}.md`]);
  const block=`<!-- individual-letter-audio -->\n## Hear each letter separately\n\n${l.code==='zh'?'These recordings demonstrate labelled pinyin syllables, including tone contrasts. They are syllable examples, not English-style letter names.':'Play each letter’s own synthetic recording. English has separate US and UK models.'}\n\n${course.foundation.letters.map(letter=>`### ${letter.symbol} · ${letter.audioLabel}\n\n![[Resources/${letter.audio}]]${letter.audioUK?`\n\nUK: ![[Resources/${letter.audioUK}]]`:''}`).join('\n\n')}\n<!-- /individual-letter-audio -->`;
  note=note.replace(/\n?<!-- individual-letter-audio -->[\s\S]*?<!-- \/individual-letter-audio -->\n?/,'');
  note+=`\n\n${block}\n`;
  entries[`${l.name}/${l.name}.md`]=strToU8(note);
  for(const letter of course.foundation.letters)for(const audio of [letter.audio,letter.audioUK].filter(Boolean))entries[`${l.name}/Resources/${audio}`]=new Uint8Array(await readFile(new URL(audio,base)));
  await writeFile(file,zipSync(entries,{level:1}));
  console.log(`Packaged ${l.name}: ${course.foundation.letters.length} letter buttons and recordings.`);
}

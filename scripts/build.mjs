import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild-wasm';
import { unzipSync, zipSync, strToU8 } from 'fflate';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'dist');
await mkdir(out, { recursive: true });
const copyOptions = { recursive: true, preserveTimestamps: true, filter: async (source, target) => {
  const from = await stat(source);
  if (from.isDirectory()) return true;
  try { const to = await stat(target); return from.size !== to.size || from.mtimeMs > to.mtimeMs; } catch { return true; }
}};
await cp(path.join(root, 'web'), out, copyOptions);
await cp(path.join(root, 'provenance'), path.join(out, 'provenance'), copyOptions);
const generated = new Set(['.nojekyll','sources.html','downloads.html','offline-packs.json','build.json']);
async function prune(directory) {
  for (const name of await readdir(directory)) {
    const file=path.join(directory,name), relative=path.relative(out,file);
    if ((await stat(file)).isDirectory()) { await prune(file); continue; }
    if (generated.has(relative)) continue;
    const source=relative.startsWith('provenance'+path.sep)?path.join(root,relative):path.join(root,'web',relative);
    try { await stat(source); } catch { await rm(file); }
  }
}
await prune(out);
await build({entryPoints:[path.join(root,'web/cloud.js'),path.join(root,'web/dictionary.js')],outdir:out,bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
const pluginBuild=await build({entryPoints:[path.join(root,'obsidian-plugin/main.js')],bundle:true,format:'cjs',platform:'browser',target:'es2022',external:['obsidian'],write:false,footer:{js:'module.exports = module.exports.default;'},legalComments:'eof'});
const pluginFiles={};
for(const file of ['manifest.json','styles.css'])pluginFiles[`sirosiu-language-study/${file}`]=new Uint8Array(await readFile(path.join(root,'obsidian-plugin',file)));
pluginFiles['sirosiu-language-study/main.js']=pluginBuild.outputFiles[0].contents;
pluginFiles['sirosiu-language-study/README.md']=strToU8(await readFile(path.join(root,'docs/sync-setup.md'),'utf8'));
await writeFile(path.join(out,'downloads/sirosiu-language-study-plugin.zip'),zipSync(pluginFiles,{level:6}));
await mkdir(path.join(out,'Notes'),{recursive:true});
await writeFile(path.join(out, '.nojekyll'), '');
const manifest = JSON.parse(await readFile(path.join(out, 'data/manifest.json'), 'utf8'));
const audio = JSON.parse(await readFile(path.join(out, 'data/audio-manifest.json'), 'utf8'));
const packs = {};
for (const language of manifest) {
  const noteZip=unzipSync(await readFile(path.join(out,`downloads/${language.code}-obsidian.zip`)));
  await writeFile(path.join(out,`Notes/${language.code}.md`),noteZip[`${language.name}/${language.name}.md`]);
  const files = [`data/${language.code}.json`, `Books/${language.name}.pdf`, ...audio.filter(a => a.path.startsWith(`Audio/${language.code}/`)).map(a => a.path)];
  const bytes = (await Promise.all(files.map(file => stat(path.join(out, file))))).reduce((sum, file) => sum + file.size, 0);
  packs[language.code] = { name: language.name, files, bytes };
}
await writeFile(path.join(out, 'offline-packs.json'), JSON.stringify(packs, null, 2));
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function documentPage(title, html) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#183b32"><title>${escape(title)} · Language Study</title><link rel="icon" href="assets/icon.svg"><link rel="stylesheet" href="style.css"></head><body><main class="document-page"><nav><a href="index.html">Back to the course</a></nav><h1>${escape(title)}</h1>${html}</main></body></html>`;
}
// The source notice uses a deliberately small Markdown subset, with escaped text.
function inlineMarkdown(text) {
  return escape(text).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
const sources = (await readFile(path.join(out, 'sources.md'), 'utf8')).split(/\n\s*\n/).filter(part => !part.startsWith('# ')).map(part => `<p>${inlineMarkdown(part)}</p>`).join('\n');
const provenanceFiles = (await readdir(path.join(out, 'provenance'))).filter(name => /LICENSE|README|source\.json|voices\.json|records\.zip/.test(name)).sort();
await writeFile(path.join(out, 'sources.html'), documentPage('Sources & licenses', sources + `<h2>Retained attribution records</h2><p>Corpus notices, source manifests and selected raw dictionary records are included for attribution and comparison.</p><ul>${provenanceFiles.map(name => `<li><a href="provenance/${encodeURIComponent(name)}">${escape(name)}</a></li>`).join('')}</ul><p><a href="assets/fonts-noto-core-license.txt">Noto font license</a> · <a href="assets/fonts-noto-cjk-license.txt">Noto CJK font notices</a></p>`));
const links = [];
for (const language of manifest) {
  const zip = `downloads/${language.code}-obsidian.zip`;
  const size = Math.ceil((await stat(path.join(out, zip))).size / 1024 / 1024);
  links.push(`<li><h2>${escape(language.name)}</h2><a href="Books/${encodeURIComponent(language.name)}.pdf">PDF book</a> · <a href="${zip}" download>Obsidian vault with audio (${size} MB)</a> · <a href="index.html#${language.code}/start">Interactive course</a></li>`);
}
await writeFile(path.join(out, 'downloads.html'), documentPage('Keep a copy for yourself.', '<p>Each language has one complete Obsidian vault with its PDF and recorded audio. Unzip the download, then open the extracted folder as a vault in Obsidian.</p><p>To use the website offline, open Study tools inside the course and save a language on that device.</p><ul class="download-list">' + links.join('') + '</ul>'));
const setupSource=await readFile(path.join(root,'docs/sync-setup.md'),'utf8');
await writeFile(path.join(out,'sync-setup.html'),documentPage('Connect your private study.',setupSource.split(/\n\s*\n/).map(p=>p.startsWith('## ')?`<h2>${inlineMarkdown(p.slice(3))}</h2>`:p.startsWith('# ')?'':`<p>${inlineMarkdown(p).replace(/\n/g,'<br>')}</p>`).join('\n')));
const shell = ['index.html','app.js','cloud.js','cloud-config.json','dictionary.js','progress.js','style.css','manifest.webmanifest','sources.html','downloads.html','sync-setup.html','offline-packs.json', ...(await readdir(path.join(out, 'assets'))).map(name => 'assets/' + name)];
const hash = createHash('sha256');
for (const file of [...shell, ...Object.keys(packs).map(code => `data/${code}.json`)]) hash.update(await readFile(path.join(out, file)));
// Include audio metadata so a recording refresh also changes the cache version.
hash.update(JSON.stringify(audio));
for (const file of Object.values(packs).flatMap(pack => pack.files).filter(file => !file.startsWith('data/'))) hash.update(await readFile(path.join(out, file)));
const workerTemplate = await readFile(path.join(root, 'web/sw.js'), 'utf8');
hash.update(workerTemplate);
const version = hash.digest('hex').slice(0, 16);
const worker = workerTemplate.replace('__BUILD_VERSION__', version).replace('__SHELL_FILES__', JSON.stringify(shell));
await writeFile(path.join(out, 'sw.js'), worker);
await writeFile(path.join(out, 'build.json'), JSON.stringify({ version, languages: manifest.length, audioFiles: audio.length }, null, 2));
console.log(`Built dist/: ${manifest.length} languages, ${audio.length} recordings; version ${version}.`);

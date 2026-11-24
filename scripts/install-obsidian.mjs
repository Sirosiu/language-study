// Additive local install. Public course notes/resources are kept out of Git secrets.
import { mkdir, readFile, writeFile, copyFile, stat, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
const root=fileURLToPath(new URL('../',import.meta.url)), vault=process.argv[2];
if(!vault||!path.isAbsolute(vault))throw new Error('Pass the absolute path of your existing Obsidian vault.');
if(!(await stat(path.join(vault,'.obsidian'))).isDirectory())throw new Error('This folder is not an Obsidian vault.');
const exists=async file=>{try{await stat(file);return true;}catch{return false;}};
const config=JSON.parse(await readFile(path.join(root,'web/cloud-config.json'),'utf8'));
const pluginFolder=path.join(vault,'.obsidian/plugins/sirosiu-language-study');
if(await exists(pluginFolder))await cp(pluginFolder,path.join(vault,'.obsidian/language-study-plugin-backups',new Date().toISOString().replace(/[:.]/g,'-')),{recursive:true});
await mkdir(pluginFolder,{recursive:true});
const plugin=unzipSync(await readFile(path.join(root,'dist/downloads/sirosiu-language-study-plugin.zip')));
for(const [name,bytes]of Object.entries(plugin))await writeFile(path.join(pluginFolder,path.basename(name)),bytes);
const settings=path.join(pluginFolder,'data.json');
if(!await exists(settings))await writeFile(settings,JSON.stringify({...config,folder:'Language Study',website:'https://sirosiu.github.io/language-study/'},null,2));
const courseFolder=path.join(vault,'Language Study');await mkdir(courseFolder,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(root,'web/data/manifest.json'),'utf8'));
for(const language of manifest){
  const data=path.join(courseFolder,`Resources/Course/${language.code}.json`);if(!await exists(data)){await mkdir(path.dirname(data),{recursive:true});await copyFile(path.join(root,`web/data/${language.code}.json`),data);}
  const zip=unzipSync(await readFile(path.join(root,`web/downloads/${language.code}-obsidian.zip`)));
  for(const [name,bytes]of Object.entries(zip)){
    const relative=name.slice(language.name.length+1);
    if(!relative||relative.includes('..')||path.isAbsolute(relative))continue;
    const target=path.join(courseFolder,relative);
    if(relative==='Start Here.md')continue;
    if(await exists(target))continue;
    await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);
  }
}
const index=path.join(courseFolder,'Start Here.md');if(!await exists(index))await writeFile(index,`# Language Study\n\n${manifest.map(l=>`- [[${l.name}]]`).join('\n')}\n\nOpen Settings → Sirosiu Language Study and sign in on this device. Website answers, your notebook, saved words and added questions appear in each language note’s private study section.\n\n[Website](https://sirosiu.github.io/language-study/) · [Sync setup](https://sirosiu.github.io/language-study/sync-setup.html)\n`);
const help=path.join(courseFolder,'Website and Obsidian sync.md');if(!await exists(help))await copyFile(path.join(root,'docs/sync-setup.md'),help);
const enabledFile=path.join(vault,'.obsidian/community-plugins.json');
const enabled=await exists(enabledFile)?JSON.parse(await readFile(enabledFile,'utf8')):[];
if(!Array.isArray(enabled))throw new Error('The community plugin list is invalid; plugin files were installed, but the enabled list was not changed.');
if(!enabled.includes('sirosiu-language-study')){enabled.push('sirosiu-language-study');await writeFile(enabledFile,JSON.stringify(enabled,null,2));}
console.log(`Installed the plugin, 15 consolidated notes, PDFs and all recorded audio in ${courseFolder}. Existing course notes/resources were kept. No credentials or auth sessions were written into the vault.`);

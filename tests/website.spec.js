import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { offlineServer } from './offline-server.mjs';
const codes=['ar','da','nl','en','fi','fr','de','ka','it','ja','ko','zh','ru','es','tr'];
async function open(page,hash='fr/start'){await page.goto('./#'+hash);await expect(page.locator('h1')).toBeVisible();}
async function tools(page){await page.locator('#study-tools-toggle').click();await expect(page.locator('#study-tools')).toHaveAttribute('open','');}

test('all 15 languages load under a repository path, with downloads',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page);
  for(const code of codes){
    await page.goto('./#'+code+'/start');await expect(page.locator('h1')).toContainText('Start reading');
    await expect(page.locator('.letter')).not.toHaveCount(0);
    await expect(page.locator('#language-select')).toHaveValue(code);
    await expect(page.locator('[data-obsidian]').first()).toHaveAttribute('href',`downloads/${code}-obsidian.zip`);
    const href=await page.locator('#print-guide').getAttribute('href');expect((await page.request.head(href)).status()).toBe(200);
  }
  expect(errors).toEqual([]);
});

test('rapid switching, keyboard skip and delayed request leave the selected language visible',async({page})=>{
  await page.route('**/data/ja.json',async route=>{await new Promise(resolve=>setTimeout(resolve,250));await route.continue();});
  await open(page);
  await page.evaluate(()=>{location.hash='ja/start'});
  await page.waitForTimeout(50);
  await page.evaluate(()=>{location.hash='ar/start'});
  await expect(page.locator('h1')).toContainText('Arabic');await page.waitForTimeout(400);
  await expect(page.locator('h1')).toContainText('Arabic');
  await page.locator('.skip').focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#ar\/start$/);await expect(page.locator('#main')).toBeFocused();
});

test('inline practice, question types, saved review and word search work',async({page})=>{
  await open(page,'fr/grammar');
  const rule=page.locator('#rule-0');await rule.locator('summary').first().click();
  await rule.locator('[data-inline-rule]').click();
  await rule.locator('[data-reveal]').click();await expect(rule.locator('.feedback')).toContainText('Why this form works');
  await rule.locator('[data-mark="review"]').click();
  await page.locator('.tabs [data-tab="practice"]').click();await expect(page.locator('#practice-set')).toBeVisible();
  await page.locator('#practice-set').selectOption('review');await expect(page.locator('.question-head')).toContainText('1 / 1');
  await page.locator('[data-reveal]').click();await page.locator('[data-mark="correct"]').click();await expect(page.locator('.empty')).toBeVisible();
  await page.locator('#practice-set').selectOption('all');
  for(const type of ['choice','edit','order','translate','explain','cloze']){await page.locator('#practice-type').selectOption(type);await page.locator('[data-reveal]').click();await expect(page.locator('.feedback')).toBeVisible();}
  await page.locator('.tabs [data-tab="words"]').click();await expect(page.locator('#word-search')).toBeVisible();
  await page.locator('.word-entry summary').first().click();await page.locator('[data-save-word]').first().click();
  await page.locator('#word-saved').selectOption('saved');await expect(page.locator('.word-entry')).toHaveCount(1);
  await page.locator('#word-search').fill('zzzzzznothing');await expect(page.locator('#word-results')).toContainText('No matching words');
  await page.reload();await expect(page.locator('.word-entry')).toHaveCount(10);
  await page.locator('#word-saved').selectOption('saved');await expect(page.locator('.word-entry')).toHaveCount(1);
});

test('export and import transfer progress; malformed files do not corrupt saved progress',async({page,browser})=>{
  await open(page,'fr/practice');await page.locator('[data-reveal]').click();await page.locator('[data-mark="review"]').click();
  await tools(page);
  const download=page.waitForEvent('download');await page.locator('#study-tools [data-export-progress]').click();
  const file=await download;const content=await readFile(await file.path(),'utf8');expect(JSON.parse(content).progress.fr.attempts['fr-Q0001']).toBe('review');
  const otherDevice=await browser.newContext();const otherPage=await otherDevice.newPage();
  await otherPage.goto('http://127.0.0.1:4187/language-study/#fr/practice');
  await expect(otherPage.locator('.progress-summary')).toContainText('0 of 1000');
  await otherPage.locator('#progress-file').setInputFiles({name:'transferred.json',mimeType:'application/json',buffer:Buffer.from(content)});
  await expect(otherPage.locator('.progress-summary')).toContainText('1 of 1000');await otherDevice.close();

  const imported={schemaVersion:1,progress:{fr:{attempts:{'fr-Q0002':'correct'},words:['fr-V0001']}}};
  await page.locator('#progress-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await expect(page.locator('#notice')).toContainText('Progress imported');await expect(page.locator('.progress-summary')).toContainText('2 of 1000');
  await page.locator('#progress-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await expect(page.locator('#notice')).toContainText('not valid JSON');await expect(page.locator('.progress-summary')).toContainText('2 of 1000');
});

for(const size of [{width:320,height:740},{width:390,height:844},{width:768,height:1024},{width:844,height:390},{width:1440,height:960}]){
  test(`layout ${size.width}×${size.height} fits the viewport`,async({page})=>{
    await page.setViewportSize(size);await open(page,'zh/start');await tools(page);
    for(const tab of ['start','grammar','practice','words','reading']){
      await page.locator(`.tabs [data-tab="${tab}"]`).click();await expect(page.locator('h1')).toBeVisible();
      const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));expect(width.scroll).toBeLessThanOrEqual(width.view+1);
    }
    await page.screenshot({path:`test-results/${test.info().project.name}-${size.width}.png`,fullPage:true});
  });
}

test('failed course fetch presents a working retry',async({page})=>{
  // Block the SW so this tests the network error in the loader itself.
  await page.route('**/sw.js',r=>r.abort());await page.route('**/data/fi.json',r=>r.fulfill({status:503,body:'unavailable'}));
  await open(page,'fi/start');await expect(page.locator('h1')).toContainText('could not open');
  await page.unroute('**/data/fi.json');await page.locator('[data-retry]').click();await expect(page.locator('h1')).toContainText('Finnish');
});

test('offline pack includes lessons, PDF and range-seekable recorded audio',async({page,context,browserName})=>{
  const server=await offlineServer();
  const site=server?.url||'http://127.0.0.1:4187/language-study/';
  try {
  await page.goto(site+'#fr/start');await expect(page.locator('h1')).toBeVisible();await tools(page);await expect(page.locator('#save-offline')).toBeEnabled({timeout:30000});
  await page.locator('#save-offline').click();await expect(page.locator('#offline-status')).toContainText('is saved on this device',{timeout:60000});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});
  server.setBlocked(true);if(browserName!=='webkit')await context.setOffline(true);await page.reload();await expect(page.locator('h1')).toContainText('French');
  await page.locator('.tabs [data-tab="grammar"]').click();await expect(page.locator('#rule-0')).toBeVisible();
  const result=await page.evaluate(async()=>{
    const full=await fetch('Audio/fr/Rule%2001.mp3');const length=(await full.arrayBuffer()).byteLength;
    const r=await fetch('Audio/fr/Rule%2001.mp3',{headers:{Range:'bytes=0-99'}});
    const suffix=await fetch('Audio/fr/Rule%2001.mp3',{headers:{Range:'bytes=-50'}});
    const bad=await fetch('Audio/fr/Rule%2001.mp3',{headers:{Range:'bytes=999999999-'}});
    const pdf=await fetch('Books/French.pdf');
    return {status:r.status,range:r.headers.get('Content-Range'),bytes:(await r.arrayBuffer()).byteLength,length,suffix:suffix.status,suffixBytes:(await suffix.arrayBuffer()).byteLength,bad:bad.status,pdf:pdf.status};
  });
  expect(result).toMatchObject({status:206,bytes:100,suffix:206,suffixBytes:50,bad:416,pdf:200});expect(result.range).toBe(`bytes 0-99/${result.length}`);
  await page.locator('.tabs [data-tab="start"]').click();const audio=page.locator('audio').first();await audio.evaluate(a=>{a.load();return a.play()});await expect.poll(()=>audio.evaluate(a=>a.currentTime)).toBeGreaterThan(0);
  await page.goto(site+'#ja/start');await expect(page.locator('h1')).toContainText('could not open');
  server.setBlocked(false);if(browserName!=='webkit')await context.setOffline(false);await page.locator('[data-retry]').click();await expect(page.locator('h1')).toContainText('Japanese');
  } finally {if(server)await server.close()}
});


test('storage restrictions and oversized imports give useful recovery',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','QuotaExceededError')}});
  await open(page,'fr/practice');await page.locator('[data-reveal]').click();await page.locator('[data-mark="review"]').click();
  await expect(page.locator('#notice')).toContainText('could not save');
  await tools(page);await page.locator('#progress-file').setInputFiles({name:'too-big.json',mimeType:'application/json',buffer:Buffer.alloc(2*1024*1024+1,32)});
  await expect(page.locator('#notice')).toContainText('too large');await expect(page.locator('.progress-summary')).toContainText('1 of 1000');
});

test('200 percent magnification keeps content readable and keyboard controls reachable',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await open(page,'ar/practice');
  await page.evaluate(()=>{document.body.style.zoom='2'});await tools(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1441);
  await page.locator('#import-progress').focus();await expect(page.locator('#import-progress')).toBeFocused();
  await page.screenshot({path:`test-results/${test.info().project.name}-zoom.png`,fullPage:true});
});

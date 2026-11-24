import { chromium } from '@playwright/test';
const site=process.env.SITE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({channel:'chromium'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto(site+'#fr/grammar');await page.locator('h1').waitFor();
await page.locator('#rule-0 summary').first().click();await page.locator('#rule-0 [data-inline-rule]').click();await page.locator('#rule-0 [data-reveal]').click();
await page.locator('#rule-0').scrollIntoViewIfNeeded();await page.screenshot({path:'docs/desktop.png'});
await page.setViewportSize({width:390,height:844});await page.goto(site+'#ar/start');await page.locator('.letter-grid').waitFor();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'docs/mobile.png'});
await page.locator('#study-tools-toggle').click();await page.locator('#study-tools').scrollIntoViewIfNeeded();await page.screenshot({path:'docs/tools-mobile.png'});
console.log('metrics',await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,formFont:getComputedStyle(document.querySelector('#language-select')).fontSize,bodyFont:getComputedStyle(document.body).fontFamily,focus:getComputedStyle(document.querySelector('#study-tools-toggle')).outlineColor})));
function contrast(a,b){const channel=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4};const luminance=h=>[.2126,.7152,.0722].reduce((s,w,i)=>s+w*channel(parseInt(h.slice(1+i*2,3+i*2),16)),0);const aa=luminance(a),bb=luminance(b);return (Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05)}
console.log('contrast', {body:contrast('#183b32','#f8f6ef'),muted:contrast('#52675d','#f8f6ef'),tools:contrast('#52675d','#eaf0e5'),button:contrast('#ffffff','#356649')});
await browser.close();

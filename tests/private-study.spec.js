import { test, expect } from '@playwright/test';
// WebKit routes SW-owned fetches outside page.route; isolate API mocks from that layer.
// The separate offline suite keeps real service workers and severs HTTP connections.
test.use({ serviceWorkers: 'block' });
const project='rtytrxcqhcrrogsmjswk.supabase.co';
const owner={id:'00000000-0000-4000-8000-000000000099',email:'study-test@example.invalid',aud:'authenticated',role:'authenticated'};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:owner.id,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),aud:'authenticated',role:'authenticated'})}.test-signature`;
async function mockAccount(page,rows={}){
  await page.routeWebSocket(`**://${project}/**`,ws=>ws.close());
  await page.route(`https://${project}/**`,async route=>{
    const url=new URL(route.request().url());let body;
    if(url.pathname.includes('/auth/v1/token'))body={access_token:token,refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:owner};
    else if(url.pathname.includes('/auth/v1/user'))body=owner;
    else if(url.pathname.includes('/auth/v1/logout'))body={};
    else if(url.pathname.includes('/rest/v1/rpc/')){
      const p=route.request().postDataJSON(),old=rows[p.p_key];
      if(old&&JSON.stringify(old.data)===JSON.stringify(p.p_data)&&old.deleted===p.p_deleted)body={ok:true,item:old};
      else if((old?.revision||0)!==p.p_expected_revision)body={conflict:true,current:old||null};
      else {const row={user_id:owner.id,key:p.p_key,language:p.p_language,kind:p.p_kind,data:p.p_data,revision:(old?.revision||0)+1,deleted:p.p_deleted,origin:p.p_origin,updated_at:new Date().toISOString()};rows[p.p_key]=row;body={ok:true,item:row};}
    }else if(url.pathname.includes('/rest/v1/language_study_items'))body=Object.values(rows).sort((a,b)=>a.key.localeCompare(b.key));
    else body={};
    await route.fulfill({status:200,contentType:'application/json',headers:{'x-supabase-api-version':'2024-01-01'},body:JSON.stringify(body)});
  });return rows;
}
async function signin(page){await page.goto('./#fr/notebook');await expect(page.locator('#sign-in-form button').first()).toBeEnabled();await page.getByLabel('Email',{exact:true}).fill(owner.email);await page.getByLabel('Password',{exact:true}).fill('mocked-local-test');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#private-note')).toBeVisible();}
test('individual letter buttons play recordings and English respects the UK model',async({page})=>{
  await page.goto('./#fr/start');await expect(page.locator('[data-letter]')).toHaveCount(26);
  const fr=page.waitForResponse(r=>r.url().includes('/Audio/fr/Letters/001.mp3'));await page.locator('[data-letter="0"]').click();expect((await fr).ok()).toBe(true);
  await page.goto('./#en/start');await page.locator('#audio-settings').click();await page.locator('#english-model').selectOption('en-GB');
  const uk=page.waitForResponse(r=>r.url().includes('/Audio/en/Letters/001-UK.mp3'));await page.locator('[data-letter="0"]').click();expect((await uk).ok()).toBe(true);
  await page.goto('./#zh/start');await expect(page.locator('main')).toContainText('labelled syllable example');await expect(page.locator('[data-letter]').first()).toContainText('Hear example');
});
test('full dictionary lookup renders the selected language safely and reports missing entries',async({page})=>{
  await page.route('https://en.wiktionary.org/w/api.php**',route=>{
    const params=new URL(route.request().url()).searchParams;
    expect(params.has('section')).toBe(false);
    const body=params.get('page')==='missingword'?{error:{code:'missingtitle'}}:params.get('prop')==='tocdata'?{parse:{title:'bonjour',tocdata:{sections:[{hLevel:2,line:'English',index:'1'},{hLevel:2,line:'French',index:'9'}]}}}:{parse:{text:{'*':'<div class="mw-parser-output"><div class="toc"><h2>Contents</h2></div><div class="mw-heading mw-heading2"><h2 id="English">English</h2></div><ol><li>English-only meaning</li></ol><div class="mw-heading mw-heading2"><h2 id="French">French</h2></div><h3>Interjection</h3><ol><li>hello; good morning</li></ol><script>window.dictionaryUnsafe=true</script><img src="https://evil.invalid/pixel"><a href="javascript:alert(1)">unsafe</a><a href="/wiki/bonjour">Source word</a><a href="#Pronunciation">Pronunciation</a><h2>Italian</h2><ol><li>Italian-only meaning</li></ol></div>'}}};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('./#fr/words');await page.locator('#dictionary-query').fill('bonjour');await page.getByRole('button',{name:'Look up word'}).click();await expect(page.locator('#dictionary-result')).toContainText('hello; good morning');
  await expect(page.locator('#dictionary-result script,#dictionary-result img')).toHaveCount(0);await expect(page.locator('#dictionary-result a[href^="javascript"]')).toHaveCount(0);
  await expect(page.locator('#dictionary-result')).not.toContainText('Contents');await expect(page.locator('#dictionary-result')).not.toContainText('English-only meaning');await expect(page.locator('#dictionary-result')).not.toContainText('Italian-only meaning');
  await expect(page.getByRole('link',{name:'Pronunciation',exact:true})).toHaveAttribute('href','https://en.wiktionary.org/wiki/bonjour#Pronunciation');
  await page.locator('#dictionary-query').fill('missingword');await page.getByRole('button',{name:'Look up word'}).click();await expect(page.locator('#dictionary-status')).toContainText('no Wiktionary entry');
});
test('password changes validate confirmation, support reauthentication and keep passwords out of study storage',async({page})=>{
  const rows=await mockAccount(page),updates=[];
  await page.route(`https://${project}/auth/v1/user`,async route=>{
    if(route.request().method()==='PUT'){
      updates.push(route.request().postDataJSON());
      if(updates.length===1)return route.fulfill({status:401,contentType:'application/json',headers:{'x-supabase-api-version':'2024-01-01','access-control-expose-headers':'x-supabase-api-version'},body:JSON.stringify({code:'reauthentication_needed',msg:'Reauthenticate before changing your password.'})});
    }
    return route.fulfill({contentType:'application/json',body:JSON.stringify(owner)});
  });
  await page.setViewportSize({width:390,height:844});await signin(page);
  await page.locator('#account-password > summary').click();
  const form=page.locator('#change-password-form');
  await form.getByLabel('Current password',{exact:true}).fill('test-current-password');
  await form.getByLabel('New password',{exact:true}).fill('test-new-password');
  await form.getByLabel('Confirm new password',{exact:true}).fill('mismatched-password');
  await form.getByRole('button',{name:'Save new password'}).click();
  await expect(form.locator('#password-message')).toContainText('do not match');expect(updates).toHaveLength(0);
  await form.getByLabel('Confirm new password',{exact:true}).fill('test-new-password');
  await form.getByRole('button',{name:'Save new password'}).click();await expect(form.locator('#password-verification')).toBeVisible();
  const code=page.waitForRequest(r=>r.url().includes('/auth/v1/reauthenticate'));await form.getByRole('button',{name:'Send verification code'}).click();await code;
  await expect(form.locator('#password-message')).toContainText('Verification code sent');
  await form.getByLabel('Verification code').fill('12345678');await form.getByRole('button',{name:'Save new password'}).click();
  await expect(form.locator('#password-message')).toContainText('Your password is changed');
  expect(updates[1]).toMatchObject({current_password:'test-current-password',password:'test-new-password',nonce:'12345678'});
  await expect(form.getByLabel('New password',{exact:true})).toHaveValue('');
  expect(JSON.stringify(rows)).not.toContain('test-new-password');
  expect(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('test-new-password')||value.includes('test-current-password')))).toBe(false);
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));expect(size.scroll).toBeLessThanOrEqual(size.view+1);
  await form.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/password-${test.info().project.name}.png`});
});
test('reset emails return to the course and recovery links open the new password form',async({page})=>{
  await mockAccount(page);await page.goto('./#fr/notebook');
  await page.getByText('Forgot your password?',{exact:true}).click();
  const reset=page.locator('#reset-password-form');await reset.getByLabel('Account email').fill(owner.email);
  const recoveryRequest=page.waitForRequest(r=>r.url().includes('/auth/v1/recover'));
  await reset.getByRole('button',{name:'Send password reset email'}).click();const request=await recoveryRequest;
  expect(request.postDataJSON().email).toBe(owner.email);expect(new URL(request.url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:4187/language-study/');
  await expect(reset.locator('#reset-message')).toContainText('a reset link is on its way');
  // Arriving from Supabase's verification endpoint loads a new document.
  await page.goto('about:blank');await page.goto(`http://127.0.0.1:4187/language-study/#access_token=${token}&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery`);
  const form=page.locator('#change-password-form');await expect(form).toBeVisible();await expect(page.locator('#account-password > summary')).toHaveText('Choose a new password');
  await expect(form.getByLabel('Current password',{exact:true})).toBeHidden();await expect(page).toHaveURL(/#fr\/notebook$/);
  await form.getByLabel('New password',{exact:true}).fill('test-recovered-password');await form.getByLabel('Confirm new password',{exact:true}).fill('test-recovered-password');
  const update=page.waitForRequest(r=>r.url().includes('/auth/v1/user')&&r.method()==='PUT');await form.getByRole('button',{name:'Save new password'}).click();
  const attributes=(await update).postDataJSON();expect(attributes.password).toBe('test-recovered-password');expect(attributes).not.toHaveProperty('current_password');
  await expect(form.locator('#password-message')).toContainText('Your password is changed');await expect(form.getByLabel('Current password',{exact:true})).toBeVisible();
});
test('private notes, draft answers, added questions and grammar writing sync across two website devices',async({page,browser})=>{
  const rows=await mockAccount(page);await signin(page);await page.locator('#private-note').fill('# My French\n\nI am learning.');await page.getByRole('button',{name:'Sync now',exact:true}).click();
  await expect.poll(()=>rows['note:fr']?.data.markdown).toContain('I am learning.');
  await page.locator('.tabs [data-tab="practice"]').click();const id=await page.locator('.question-form').getAttribute('data-qid');await page.locator('[name="answer"]').fill('My saved draft');
  await page.locator('[data-next]').click();await page.locator('[data-previous]').click();await expect(page.locator('[name="answer"]')).toHaveValue('My saved draft');
  await page.locator('.tabs [data-tab="notebook"]').click();await page.locator('details.section').filter({has:page.locator('#custom-question-form')}).locator('summary').first().click();
  const form=page.locator('#custom-question-form');await form.locator('[name="title"]').fill('My own translation');await form.locator('[name="prompt"]').fill('Translate: I learn.');await form.locator('[name="answer"]').fill('J’apprends.');await form.getByRole('button',{name:'Save my question'}).click();await expect(page.locator('#custom-questions')).toContainText('My own translation');
  await page.getByRole('button',{name:'Sync now',exact:true}).click();await expect.poll(()=>Object.values(rows).filter(r=>r.kind==='question').length).toBe(1);
  const other=await browser.newContext({serviceWorkers:'block'});const otherPage=await other.newPage();await mockAccount(otherPage,rows);await signin(otherPage);
  await expect(otherPage.locator('#private-note')).toHaveValue('# My French\n\nI am learning.');await otherPage.goto('http://127.0.0.1:4187/language-study/#fr/practice/'+id);await expect(otherPage.locator('[name="answer"]')).toHaveValue('My saved draft');
  await otherPage.locator('.tabs [data-tab="practice"]').click();await otherPage.locator('#practice-rule').selectOption('mine');await expect(otherPage.locator('.question-head')).toContainText('My own translation');
  await otherPage.locator('[name="answer"]').fill('J’apprends.');await otherPage.locator('.question-form button[type="submit"]').click();
  await otherPage.goto('http://127.0.0.1:4187/language-study/#fr/grammar/fr-E0-0');const exercise=otherPage.locator('#exercise-0-0');await expect(exercise.locator('textarea')).toBeVisible();await exercise.locator('textarea').fill('My reasoning answer');await exercise.locator('button[type="submit"]').click();
  await otherPage.goto('http://127.0.0.1:4187/language-study/#fr/notebook');await otherPage.getByRole('button',{name:'Sync now',exact:true}).click();await expect.poll(()=>rows['answer:fr-E0-0']?.data.answer).toBe('My reasoning answer');
  await other.close();await page.getByRole('button',{name:'Sync now',exact:true}).click();await expect(page.locator('#private-answers')).toContainText('My reasoning answer');
  rows['note:fr']={...rows['note:fr'],revision:rows['note:fr'].revision+1,origin:'obsidian-test',data:{markdown:'Note edited in Obsidian'}};
  await page.getByRole('button',{name:'Sync now',exact:true}).click();await expect(page.locator('#private-note')).toHaveValue('Note edited in Obsidian');
  await page.getByRole('button',{name:'Sign out on this device'}).click();await expect(page.locator('#private-note')).toHaveCount(0);await expect(page.locator('#sign-in-form')).toBeVisible();
});
for(const width of [320,390,768,1440])test(`private notebook and dictionary fit ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await mockAccount(page);await signin(page);
  for(const tab of ['notebook','words']){await page.goto('./#ar/'+tab);await expect(page.locator('h1')).toBeVisible();const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));expect(size.scroll).toBeLessThanOrEqual(size.view+1);}
});

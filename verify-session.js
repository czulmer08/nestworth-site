/* Verify the login token persists to the device and is reused/expired correctly (stay-logged-in across app eviction). */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof saveTok==='function'&&typeof storedToken==='function'&&typeof clearTok==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) saveTok writes {t,e} with an expiry ~expires_in in the future; storedToken returns it while valid
  const r1=await page.evaluate(()=>{
    clearTok();
    saveTok({access_token:'AT-123',expires_in:3600});
    var raw=JSON.parse(localStorage.getItem('nw_tok'));
    var future=raw.e-(new Date()).getTime();
    return {got:storedToken(), token:raw.t, dstFuture:Math.round(future/1000)};
  });
  ck('saveTok persists token; storedToken returns it while valid', r1.got==='AT-123'&&r1.token==='AT-123'&&r1.dstFuture>3000&&r1.dstFuture<=3600, JSON.stringify(r1));

  // 2) a token within 90s of expiry (or past) is treated as NOT usable (forces a fresh grant)
  const r2=await page.evaluate(()=>{
    localStorage.setItem('nw_tok',JSON.stringify({t:'AT-OLD',e:(new Date()).getTime()+30000})); // 30s left
    var near=storedToken();
    localStorage.setItem('nw_tok',JSON.stringify({t:'AT-DEAD',e:(new Date()).getTime()-1000})); // expired
    var dead=storedToken();
    return {near:near, dead:dead};
  });
  ck('token expiring within 90s or already expired is NOT reused', r2.near===null&&r2.dead===null, JSON.stringify(r2));

  // 3) clearTok removes it; session-expiry and sign-out both drop the stored token
  const r3=await page.evaluate(()=>{
    saveTok({access_token:'AT-x',expires_in:3600}); clearTok();
    return {afterClear:localStorage.getItem('nw_tok')};
  });
  ck('clearTok removes the stored token', r3.afterClear===null, JSON.stringify(r3));

  // 4) the real token callback (_tokCb) persists on every grant
  const r4=await page.evaluate(()=>{
    clearTok();
    _tokCb({access_token:'AT-live',expires_in:3599});
    var raw=JSON.parse(localStorage.getItem('nw_tok')||'null');
    return {stored:raw&&raw.t, mem:accessToken};
  });
  ck('_tokCb persists the granted token (and sets it in memory)', r4.stored==='AT-live'&&r4.mem==='AT-live', JSON.stringify(r4));

  // 5) malformed stored value never throws — storedToken returns null
  const r5=await page.evaluate(()=>{
    localStorage.setItem('nw_tok','{not json');
    var a=storedToken();
    localStorage.setItem('nw_tok',JSON.stringify({t:'',e:0}));
    var b=storedToken();
    return {a:a,b:b};
  });
  ck('malformed / empty stored token is handled safely (null)', r5.a===null&&r5.b===null, JSON.stringify(r5));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

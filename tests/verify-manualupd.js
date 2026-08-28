const {chromium}=require('playwright');const http=require('http');const fs=require('fs');
const APP='/home/claude/nestworth-app/app.html';
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200);r.end("");});
(async()=>{await new Promise(r=>server.listen(0,r));const port=server.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const page=await b.newPage();
let navAttempt=null;
await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
await page.route('**/*',r=>{const u=r.request().url();
  if(u.includes('127.0.0.1')){
    // the app's reload is a same-origin navigation to ...app.html?v=<digits>; abort it so it can't destroy the context
    if(r.request().isNavigationRequest()&&/\?v=\d+/.test(u)){navAttempt=u;return r.abort();}
    return r.continue();
  }
  return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>typeof manualUpdateCheck==='function',{timeout:8000});
const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

// same version -> "latest", no navigation
const r1=await page.evaluate(async()=>{window.fetch=async()=>({ok:true,text:async()=>'var BUILD="'+BUILD+'";'});await manualUpdateCheck();return document.getElementById('updCheckMsg').textContent;});
ck('same version -> "latest version"', /latest version/.test(r1), r1);
ck('same version does NOT navigate', navAttempt===null, String(navAttempt));

// fetch error -> friendly message
const r2=await page.evaluate(async()=>{window.fetch=async()=>{throw new Error('net');};await manualUpdateCheck();return document.getElementById('updCheckMsg').textContent;});
ck('fetch error -> friendly message', /Couldn.t check/.test(r2), r2);

// settVer shows current build (check before the reload test)
const r3=await page.evaluate(()=>({settVer:(document.getElementById('settBuild')||{}).textContent||'', build:BUILD}));
ck('settings shows current build', r3.settVer.indexOf(r3.build)>=0, JSON.stringify(r3));

// newer version -> sets "updating" then attempts a cache-busted reload
const r4=await page.evaluate(async()=>{window.fetch=async()=>({ok:true,text:async()=>'var BUILD="99999999.1";'});await manualUpdateCheck();return document.getElementById('updCheckMsg').textContent;});
await page.waitForTimeout(700); // let the 400ms setTimeout reload fire (and get aborted by the route)
ck('newer version -> "updating" message', /updating/.test(r4), r4);
ck('newer version -> attempts cache-busted reload', /\?v=\d+/.test(navAttempt||''), String(navAttempt));

let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
console.log('\n'+pass+' passed, '+fail+' failed.');
await b.close();server.close();process.exit(fail?1:0);})();

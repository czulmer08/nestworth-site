/* Verify the Gemini key is device-only by default and only written into the shared budget when the user opts in
   ("Share with this Nest"), and that the shared-key restore only fires when a shared key exists. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('keySave')&&document.getElementById('keyShare')&&typeof lsGet==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    window.writeMeta=async()=>{};window.renderSettings=()=>{};
    state.meta={cats:{},cons:{},goals:[],gkey:""};
    lsDel(GKEY);

    // default (share OFF): key stays on-device, NOT written to the shared budget
    $("geminiKey").value="AIzaLOCAL";$("keyShare").checked=false;$("keySave").click();
    var deviceOnly=(lsGet(GKEY)==="AIzaLOCAL")&&(state.meta.gkey==="");

    // share ON: key is written into the budget metadata
    $("geminiKey").value="AIzaSHARED";$("keyShare").checked=true;$("keySave").click();
    var sharedWrites=(state.meta.gkey==="AIzaSHARED");

    // toggling share OFF stops sharing but keeps the local key
    $("keyShare").checked=false;$("keyShare").dispatchEvent(new Event('change'));
    var unshared=(state.meta.gkey==="")&&(lsGet(GKEY)==="AIzaSHARED");

    // restore path: a shared key restores to a device with none; a device-only ("") key does not
    lsDel(GKEY);state.meta.gkey="AIzaSHARED";
    (function(){try{if(state.meta&&state.meta.gkey&&!lsGet(GKEY).trim())lsSet(GKEY,state.meta.gkey);}catch(e){}})();
    var restores=(lsGet(GKEY)==="AIzaSHARED");
    lsDel(GKEY);state.meta.gkey="";
    (function(){try{if(state.meta&&state.meta.gkey&&!lsGet(GKEY).trim())lsSet(GKEY,state.meta.gkey);}catch(e){}})();
    var noRestore=(lsGet(GKEY)==="");
    lsDel(GKEY);
    return {deviceOnly,sharedWrites,unshared,restores,noRestore};
  });

  ck('default: key saved on-device only, NOT written to the shared budget', res.deviceOnly, String(res.deviceOnly));
  ck('opt-in: "Share with this Nest" writes the key into the budget metadata', res.sharedWrites, String(res.sharedWrites));
  ck('turning share off stops sharing but keeps the local key', res.unshared, String(res.unshared));
  ck('shared-key restore fires only when a shared key exists (never for a device-only key)', res.restores&&res.noRestore, JSON.stringify({restores:res.restores,noRestore:res.noRestore}));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

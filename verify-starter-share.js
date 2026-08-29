/* STARTER-COPY FAIL-CLOSED SECURITY TEST. The "Share a blank starter copy" flow makes a full copy of the household workbook,
   strips the private data, and grants anyone-with-link reader. The security property: sharing must be reached ONLY after every
   sanitation step succeeded AND an independent read-after-write verification confirmed the copy is empty. This drives the REAL
   shareStarterCopy() under fetch fault-injection at each stage and proves: (a) any sanitation/verification failure ⇒ the
   permissions call is NEVER made, and the unsafe copy is deleted; (b) even a SILENT clear failure (clear returns 200 but the
   data is still there) is caught by verification and blocks sharing; (c) the happy path shares exactly once, only after verify. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const src=fs.readFileSync(APP,'utf8');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(src);return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof shareStarterCopy==='function'&&typeof _verifyStarterSanitized==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  // Run shareStarterCopy once with a given fault ('' = happy path; 'leftover' = clears succeed but data remains). Returns the
  // ordered list of API call kinds actually issued to the "server".
  const scenario=await page.evaluate(async(FAULT)=>{
    accessToken='tok';sheetId='SRC';budgetName='Household';
    var calls=[],metaWritten=false;
    function kind(url,method){var u=decodeURIComponent(url);
      if(/\/copy\?/.test(u))return'copy';
      if(/\/permissions\?/.test(u))return'permission';
      if(method==='DELETE'&&/\/drive\/v3\/files\/[^/?]+$/.test(u))return'delete';
      if(/\?fields=sheets\.properties/.test(u))return'meta-info';
      if(/Account Ledger!A:A/.test(u))return'ledger-read';
      if(/:batchUpdate/.test(u))return'ledger-del';
      if(/values:batchClear/.test(u))return'nw-clear';
      if(/Account Ledger!A2:I/.test(u))return'verify-ledger';
      if(/Net Worth!A4:B23/.test(u))return'verify-asset';
      if(/Net Worth!A27:B36/.test(u))return'verify-debt';
      if(/NW History!A2:F400/.test(u))return'verify-hist';
      if(/NestWorth Meta!A2/.test(u))return (method==='PUT')?'meta-write':(metaWritten?'verify-meta':'meta-read');
      return'other';
    }
    function J(st,bd){return {ok:st>=200&&st<300,status:st,json:async function(){return bd;},text:async function(){return JSON.stringify(bd);}};}
    var realShare=navigator.share,realClip=navigator.clipboard;
    try{Object.defineProperty(navigator,'share',{configurable:true,value:async function(){}});}catch(e){}
    window.fetch=async function(url,opts){opts=opts||{};var k=kind(String(url),opts.method||'GET');calls.push(k);
      if(k==='meta-write')metaWritten=true;
      // inject the fault
      if(FAULT&&k===FAULT)return J(500,{error:'injected failure at '+k});
      // responses
      if(k==='copy')return J(200,{id:'COPY1'});
      if(k==='meta-info')return J(200,{sheets:[{properties:{title:'Account Ledger',sheetId:99}}]});
      if(k==='ledger-read')return J(200,{values:[['Year'],['2026'],['2026']]}); // header + 2 data rows
      if(k==='ledger-del'||k==='nw-clear'||k==='meta-write'||k==='delete')return J(200,{});
      if(k==='meta-read')return J(200,{values:[[JSON.stringify({goals:[{name:'Vacation'}],startCash:5000,nwUpdated:'2026-08-01',gkey:'AIzaSECRET',cats:{}})]]});
      // VERIFY reads — clean unless we're simulating a SILENT clear failure (data still present despite 200 clears)
      if(k==='verify-ledger')return J(200,{values:(FAULT==='leftover')?[['2026','8','2026-08-01','Payee','Groceries','',50,'','N']]:[]});
      if(k==='verify-asset')return J(200,{values:[]});
      if(k==='verify-debt')return J(200,{values:[]});
      if(k==='verify-hist')return J(200,{values:[]});
      if(k==='verify-meta')return J(200,{values:[[JSON.stringify({goals:[],startCash:0,nwUpdated:'',gkey:'',cats:{}})]]});
      return J(200,{});
    };
    try{await shareStarterCopy();}catch(e){}
    try{if(realShare)Object.defineProperty(navigator,'share',{configurable:true,value:realShare});}catch(e){}
    var count=function(kk){return calls.filter(function(c){return c===kk;}).length;};
    return {calls:calls,permission:count('permission'),del:count('delete'),
            permAfterVerify:(calls.indexOf('permission')<0)||(calls.indexOf('permission')>calls.lastIndexOf('verify-meta')&&calls.lastIndexOf('verify-meta')>=0),
            msg:(document.getElementById('budShareMsg')||{}).textContent||''};
  }, '');

  // HAPPY PATH
  ck('happy path shares exactly once', scenario.permission===1, JSON.stringify({perm:scenario.permission}));
  ck('happy path: the permission grant comes AFTER verification (last call is permission, following verify-meta)', scenario.permAfterVerify&&scenario.calls[scenario.calls.length-1]==='permission', scenario.calls.join(' > '));
  ck('happy path makes no cleanup delete', scenario.del===0, '');

  // FAULT-INJECTED STAGES — each must block sharing and (once a copy exists) delete it
  const faults=[
    ['copy',       false], // copy itself fails → nothing to delete
    ['ledger-del', true],
    ['nw-clear',   true],
    ['meta-write', true],
    ['verify-ledger', true], // a verification READ fails
    ['leftover',   true],    // clears returned 200 but data is STILL there → verification must catch it
  ];
  for(const [f,expectDelete] of faults){
    const r=await page.evaluate(async(FAULT)=>{
      accessToken='tok';sheetId='SRC';budgetName='Household';
      var calls=[],metaWritten=false;
      function kind(url,method){var u=decodeURIComponent(url);
        if(/\/copy\?/.test(u))return'copy';
        if(/\/permissions\?/.test(u))return'permission';
        if(method==='DELETE'&&/\/drive\/v3\/files\/[^/?]+$/.test(u))return'delete';
        if(/\?fields=sheets\.properties/.test(u))return'meta-info';
        if(/Account Ledger!A:A/.test(u))return'ledger-read';
        if(/:batchUpdate/.test(u))return'ledger-del';
        if(/values:batchClear/.test(u))return'nw-clear';
        if(/Account Ledger!A2:I/.test(u))return'verify-ledger';
        if(/Net Worth!A4:B23/.test(u))return'verify-asset';
        if(/Net Worth!A27:B36/.test(u))return'verify-debt';
        if(/NW History!A2:F400/.test(u))return'verify-hist';
        if(/NestWorth Meta!A2/.test(u))return (method==='PUT')?'meta-write':(metaWritten?'verify-meta':'meta-read');
        return'other';}
      function J(st,bd){return {ok:st>=200&&st<300,status:st,json:async function(){return bd;},text:async function(){return JSON.stringify(bd);}};}
      try{Object.defineProperty(navigator,'share',{configurable:true,value:async function(){}});}catch(e){}
      window.fetch=async function(url,opts){opts=opts||{};var k=kind(String(url),opts.method||'GET');calls.push(k);
        if(k==='meta-write')metaWritten=true;
        if(FAULT&&k===FAULT)return J(500,{error:'injected'});
        if(k==='copy')return J(200,{id:'COPY1'});
        if(k==='meta-info')return J(200,{sheets:[{properties:{title:'Account Ledger',sheetId:99}}]});
        if(k==='ledger-read')return J(200,{values:[['Year'],['2026'],['2026']]});
        if(k==='ledger-del'||k==='nw-clear'||k==='meta-write'||k==='delete')return J(200,{});
        if(k==='meta-read')return J(200,{values:[[JSON.stringify({goals:[{name:'V'}],startCash:5000,nwUpdated:'x',gkey:'AIzaSECRET'})]]});
        if(k==='verify-ledger')return J(200,{values:(FAULT==='leftover')?[['2026','8','d','p','Groceries','',50,'','N']]:[]});
        if(k==='verify-asset'||k==='verify-debt'||k==='verify-hist')return J(200,{values:[]});
        if(k==='verify-meta')return J(200,{values:[[JSON.stringify({goals:[],startCash:0,nwUpdated:'',gkey:''})]]});
        return J(200,{});
      };
      try{await shareStarterCopy();}catch(e){}
      var count=function(kk){return calls.filter(function(c){return c===kk;}).length;};
      return {perm:count('permission'),del:count('delete'),msg:(document.getElementById('budShareMsg')||{}).textContent||''};
    }, f);
    ck('fault ['+f+'] → NO sharing permission is ever granted', r.perm===0, JSON.stringify(r));
    if(expectDelete)ck('fault ['+f+'] → the unsafe copy is deleted (cleanup)', r.del===1, JSON.stringify(r));
    ck('fault ['+f+'] → user is told nothing was shared', /nothing was shared|Couldn.t safely/.test(r.msg), r.msg);
  }

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  SCOPE: proves the client fail-closes sharing on any sanitation/verification failure. Real Drive ACL semantics still need a live check.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

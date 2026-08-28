/* Verify P2 backup + erase friction: backupNest copies the workbook to Drive, and wipeData only erases after you type
   ERASE (offering a backup first). */
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
  await page.waitForFunction(()=>typeof backupNest==='function'&&typeof wipeData==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    window.sheetId='SHEET123';window.SHEET_NAME='My Budget';
    var apiCalls=[];window.api=async function(url,opts){apiCalls.push({url:url,body:opts&&opts.body});return {id:'copy1',name:'x'};};
    // 1) backupNest
    await backupNest();
    var copy=apiCalls.filter(function(c){return /\/files\/SHEET123\/copy/.test(c.url);})[0];
    var backupOk=!!copy && /backup/.test(copy.body||"") && /My Budget/.test(copy.body||"");

    // 2) wipeData aborts if you don't type ERASE
    var cleared=[];window.vBatchClear=async function(r){Array.prototype.push.apply(cleared,r);};
    window.writeMeta=async function(){};window.loadAll=async function(){};window.renderAll=function(){};
    window.askConfirm=async function(){return true;};
    window.askText=async function(){return "nope";};
    await wipeData();
    var abortedNoErase=(cleared.length===0);

    // 3) wipeData erases when you type ERASE
    cleared=[];window.vBatchClear=async function(r){Array.prototype.push.apply(cleared,r);};
    window.askText=async function(){return "ERASE";};
    await wipeData();
    var erased=cleared.some(function(x){return /Account Ledger'?!A2:I/.test(x);});
    return {backupOk,abortedNoErase,erased};
  });

  ck('backupNest copies the workbook to Drive with a dated name', res.backupOk, String(res.backupOk));
  ck('erase is cancelled unless you type ERASE', res.abortedNoErase, String(res.abortedNoErase));
  ck('typing ERASE proceeds with the erase', res.erased, String(res.erased));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* Verify atomic transaction append: vappend reserves each row with a unique nonce and verifies ownership, so a
   simultaneous write from another device can never overwrite an entry (the P0 data-integrity fix). */
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
  await page.waitForFunction(()=>typeof vappend==='function'&&typeof claimRows==='function'&&typeof appendedRow==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    // In-memory model of the ledger's column A shared by two "devices".
    var colA,injectRow=0,injected=false;
    function seed(){colA={1:'Year',2:2026,3:2026,4:2026,5:2026};injected=false;} // header + 4 existing transactions → first free is row 6
    window.ssBase=function(){return "x";};window.ensureLedgerTable=async function(){};window.api=async function(){return {ok:true,__apiAppendUsed:true};};
    window.vgetU=async function(rng){var m=rng.match(/!A(\d+)(?::A(\d+))?/);var s=+m[1],e=m[2]?+m[2]:s;var maxK=0;Object.keys(colA).forEach(function(k){if(+k>maxK)maxK=+k;});var end=Math.min(e,Math.max(maxK,s));var o=[];for(var r=s;r<=end;r++)o.push([colA[r]!=null?colA[r]:'']);return {values:o};};
    window.vBatchClear=async function(ranges){ranges.forEach(function(rg){var m=rg.match(/!A(\d+)/);if(m)delete colA[+m[1]];});};
    window.vBatchUpdate=async function(data){data.forEach(function(d){var m=d.range.match(/!A(\d+)/);var row=+m[1];var val=d.values[0][0];colA[row]=val;
      if(!injected&&injectRow&&row===injectRow&&String(val).indexOf('~clm')===0){injected=true;colA[injectRow]='FOREIGN';}});}; // a competing device lands on the same row right after us

    var LED="Account Ledger";
    // Scenario A — no contention: append lands on the first free row (6) and returns it
    seed();injectRow=0;
    var rA=await vappend(LED+"!A:I",[[2026,8,'2026-08-10','Me','Food','Publix',50,'','N']]);
    var landedA=appendedRow(rA);
    var untouchedA=(colA[2]===2026&&colA[3]===2026&&colA[4]===2026&&colA[5]===2026);
    var wroteA=(colA[6]===2026);

    // Scenario B — a competitor grabs row 6 the instant we reserve it: we must detect it and move to row 7, NOT overwrite
    seed();injectRow=6;
    var rB=await vappend(LED+"!A:I",[[2026,8,'2026-08-11','Me','Gas','Shell',40,'','N']]);
    var landedB=appendedRow(rB);
    var competitorSafe=(colA[6]==='FOREIGN');   // the other device's entry survived
    var ourWriteB=(colA[7]===2026);             // ours went to the next row
    return {landedA,untouchedA,wroteA,landedB,competitorSafe,ourWriteB};
  });

  ck('normal append lands on the first free row (6) and reports it', res.landedA===6&&res.wroteA&&res.untouchedA, JSON.stringify(res));
  ck('a simultaneous write on the same row is detected — ours moves to row 7', res.landedB===7&&res.ourWriteB, JSON.stringify({landed:res.landedB,ours:res.ourWriteB}));
  ck('the competing device\'s entry is never overwritten', res.competitorSafe, String(res.competitorSafe));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

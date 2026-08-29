/* Verify the debt-payoff reconciliation safeguard: if the balances were changed but the goal withdrawal never recorded,
   the next load completes it (once); if it did record, the marker is just cleared (no double write). Defense-in-depth. */
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
  await page.waitForFunction(()=>typeof reconcilePending==='function'&&typeof _pendKey==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    window.sheetId='TEST';var appended=[];window.vappend=async function(range,vals){appended.push(vals[0]);return {};};
    var Y=curYear(),M=curMonth();
    var marker={op:'debtpay',goal:'Car Fund',debt:'Auto Loan',applied:1500,cat:'Car Fund',date:Y+'-0'+M+'-15'};

    // CASE 1 — interrupted: balances changed, the withdrawal is NOT in the ledger yet → reconcile completes it
    state.rows=[[Y,M,Y+'-0'+M+'-01','Me','Deposit','Job',5000,'','N']]; // no Car Fund withdrawal present
    lsSet(_pendKey(),JSON.stringify(marker));appended=[];
    await reconcilePending();
    var repaired=appended.length===1&&appended[0][5]==='Car Fund'&&Math.abs((Number(appended[0][6])||0)+1500)<0.01;
    var clearedAfterRepair=!lsGet(_pendKey());
    var pushedToRows=state.rows.some(function(r){return (""+r[5]).toLowerCase()==='car fund'&&Math.abs((Number(r[6])||0)+1500)<0.01;});

    // CASE 2 — already completed: the withdrawal IS in the ledger → reconcile just clears the marker, no second append
    state.rows=[[Y,M,Y+'-0'+M+'-01','Me','Deposit','Job',5000,'','N'],[Y,M,Y+'-0'+M+'-15','','Car Fund','Car Fund',-1500,'Applied to Auto Loan','']];
    lsSet(_pendKey(),JSON.stringify(marker));appended=[];
    await reconcilePending();
    var noDouble=appended.length===0&&!lsGet(_pendKey());

    // CASE 3 — no marker: nothing happens
    lsDel(_pendKey());appended=[];
    await reconcilePending();
    var noop=appended.length===0;

    return {repaired,clearedAfterRepair,pushedToRows,noDouble,noop};
  });

  ck('interrupted payoff: the missing goal withdrawal (−$1,500) is appended', res.repaired, String(res.repaired));
  ck('marker is cleared after a successful repair', res.clearedAfterRepair, String(res.clearedAfterRepair));
  ck('the recovered row is reflected in local state immediately', res.pushedToRows, String(res.pushedToRows));
  ck('already-completed payoff: marker cleared, NO duplicate append', res.noDouble, String(res.noDouble));
  ck('no marker: reconcile is a no-op', res.noop, String(res.noop));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

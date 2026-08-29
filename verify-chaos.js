/* CHAOS / RECOVERY suite. Injects transport failures at the fetch layer so the REAL write paths (api / claimRows / vappend /
   vBatchUpdate / sweepStaleClaims) execute under adversity — not toy replacements. Proves: bounded retry on 429/5xx for
   idempotent ops; the non-idempotent append is NEVER retried; reservation FAILS CLOSED on a lost verification read; partial
   reservations are released; stale nonce markers are swept by age; an ambiguous write surfaces an error (never a silent
   success); 401 → session-expired, no stale-token retry.
   SCOPE: this is single-client fault injection. It does NOT — and cannot, in a local harness — prove true two-device
   simultaneous-write atomicity against live Google Sheets; that remains the documented client-only concurrency boundary. */
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
  await page.waitForFunction(()=>typeof api==='function'&&typeof claimRows==='function'&&typeof vappend==='function'&&typeof sweepStaleClaims==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const res=await page.evaluate(async()=>{
    accessToken='tok';sheetId='sid';
    // programmable fetch: window.__h(url,opts,call) → {status, body} | {net:true} (network error) | {commit:true,...} (records a write then errors)
    var LOG=[];var CALLS=0;var real=window.fetch;
    window.fetch=async function(url,opts){CALLS++;var h=window.__h;var rv=h?h(String(url),opts||{},CALLS):{status:200,body:{}};LOG.push({url:String(url),method:(opts&&opts.method)||'GET',rv:rv});
      if(rv&&rv.net)throw new Error('network down');
      var status=rv&&rv.status||200,body=(rv&&rv.body)||{};
      return {ok:status>=200&&status<300,status:status,json:async function(){return body;},text:async function(){return JSON.stringify(body);}};};
    function reset(h){window.__h=h;CALLS=0;LOG.length=0;}
    function countBy(re,method){return LOG.filter(function(l){return re.test(l.url)&&(!method||l.method===method);}).length;}
    function clears(){return LOG.filter(function(l){return /batchClear/.test(l.url);});}
    var R={};

    // 1) idempotent READ retries a 429 then succeeds
    reset(function(u,o,c){if(/\/values\//.test(u)&&c<3)return {status:429,body:{}};return {status:200,body:{values:[[1]]}};});
    try{var r1=await vgetU("'X'!A1");R.readRetry={ok:true,calls:countBy(/\/values\//),got:JSON.stringify(r1.values)};}catch(e){R.readRetry={ok:false,err:e.message};}

    // 2) idempotent batchUpdate retries a 503 then succeeds
    reset(function(u,o,c){if(/batchUpdate/.test(u)&&c<2)return {status:503,body:{}};return {status:200,body:{}};});
    try{await vBatchUpdate([{range:"'X'!A1",values:[["a"]]}]);R.writeRetry={ok:true,calls:countBy(/batchUpdate/)};}catch(e){R.writeRetry={ok:false,err:e.message};}

    // 3) non-idempotent APPEND is NEVER retried on 429 (would duplicate). Force the append path via a 403 on the reservation scan.
    reset(function(u,o,c){if(/append/.test(u))return {status:429,body:{}};if(/\/values\/[^:]*$/.test(u)&&/A1%3A/.test(u))return {status:403,body:{}};if(/\/values\//.test(u))return {status:403,body:{}};return {status:200,body:{}};});
    var appErr=null;try{await vappend("'Account Ledger'!A:I",[[2026,8,'2026-08-01','','x','',5,'','N']]);}catch(e){appErr=e.message;}
    R.appendNoRetry={threw:!!appErr,appendCalls:countBy(/append/,'POST')};

    // 4) reservation FAILS CLOSED: the verification read fails → claimRows returns null (never "assume ours")
    reset(function(u,o,c){if(/append/.test(u))return {status:200,body:{updates:{}}};
      if(/batchUpdate/.test(u))return {status:200,body:{}};                                  // nonce write "succeeds"
      if(/A1(%3A|:)/.test(u))return {status:200,body:{values:[[2026]]}};                       // scan read: one existing row
      if(/\/values\//.test(u))return {net:true};                                              // the verify re-read is lost
      return {status:200,body:{}};});
    var claimed=await claimRows('Account Ledger',1);
    R.failClosed={returnedNull:claimed===null};

    // 5) PARTIAL reservation release: row 1 confirmed, row 2's verify read is lost → row 1 must be released (batchClear)
    var vreads=0;
    reset(function(u,o,c){if(/batchUpdate/.test(u))return {status:200,body:{}};
      if(/A1(%3A|:)/.test(u))return {status:200,body:{values:[[2026]]}};                       // scan: row 1 occupied → claim row 2, then row 3...
      if(/\/values\/'Account/.test(u)&&/!A\d/.test(u)){vreads++;if(vreads===1){var m=decodeURIComponent(u).match(/!A(\d+)/);return {status:200,body:{values:[["~READBACK"]]}};} return {net:true};} // 1st verify OK (we spoof match below), 2nd lost
      return {status:200,body:{}};});
    // spoof: make the confirm compare succeed on the 1st verify by returning the nonce. We can't know the nonce, so instead
    // assert the WEAKER but real property: on the lost 2nd verify, claimRows bails to null AND issues a batchClear for what it held.
    reset(function(u,o,c){if(/batchUpdate/.test(u)){window.__lastNonce=(o&&o.body&&(JSON.parse(o.body).data||[])[0].values[0][0]);return {status:200,body:{}};}
      if(/batchClear/.test(u))return {status:200,body:{}};
      if(/A1(%3A|:)/.test(u))return {status:200,body:{values:[[2026]]}};
      if(/\/values\/'Account/.test(u)&&/!A\d/.test(u)){vreads++;if(vreads===1)return {status:200,body:{values:[[window.__lastNonce]]}};return {net:true};}
      return {status:200,body:{}};});
    vreads=0;var claimed2=await claimRows('Account Ledger',2);
    R.partialRelease={returnedNull:claimed2===null,clearedAfterPartial:clears().length>0};

    // 6) stale nonce sweep: an OLD ~clm marker is cleared; a FRESH one is left
    var oldTs=(Date.now()-600000).toString(36),newTs=Date.now().toString(36);
    reset(function(u,o,c){if(/A1(%3A|:)/.test(u))return {status:200,body:{values:[[2026],["~clm"+oldTs+"~aaaa-0"],[2027],["~clm"+newTs+"~bbbb-0"]]}};if(/batchClear/.test(u))return {status:200,body:{}};return {status:200,body:{}};});
    var swept=await sweepStaleClaims('Account Ledger',300000);
    R.staleSweep={sweptCount:swept,clearCalls:countBy(/batchClear/)};

    // 7) AMBIGUOUS write: append commits server-side but the response is lost → api throws (never a silent success)
    var committed=false;
    reset(function(u,o,c){if(/append/.test(u)){committed=true;return {net:true};}if(/\/values\//.test(u))return {status:403,body:{}};return {status:200,body:{}};});
    var ambErr=null;try{await vappend("'Account Ledger'!A:I",[[2026,8,'2026-08-02','','y','',7,'','N']]);}catch(e){ambErr=e.message;}
    R.ambiguous={serverCommitted:committed,clientThrew:!!ambErr};

    // 8) 401 → session expired, no stale-token retry
    var expired=false;window.sessionExpired=function(){expired=true;};window.getToken=function(){return Promise.reject(new Error('no silent refresh'));};
    reset(function(u,o,c){return {status:401,body:{}};});
    var e401=null;try{await vgetU("'X'!A1");}catch(e){e401=e.message;}
    R.session401={expiredCalled:expired,threw:!!e401};

    // 9) duplicate-tap guard (idempotency at the app layer): a same-source/amount/month deposit is detected
    var dupOk=false;try{curYear=function(){return 2026;};state.rows=[[2026,8,'2026-08-01','Denzell','Deposit','',2000,'','N']];dupOk=(typeof hasDupDeposit==='function')&&hasDupDeposit('Denzell',2000,2026,8)===true&&hasDupDeposit('Denzell',2000,2026,7)===false;}catch(e){dupOk='ERR:'+e.message;}
    R.dupTap={ok:dupOk===true};

    window.fetch=real;
    return R;
  });

  const R=res;
  ck('idempotent READ retries a transient 429 and succeeds (3 attempts)', R.readRetry.ok&&R.readRetry.calls===3, JSON.stringify(R.readRetry));
  ck('idempotent batchUpdate retries a transient 503 and succeeds (2 attempts)', R.writeRetry.ok&&R.writeRetry.calls===2, JSON.stringify(R.writeRetry));
  ck('non-idempotent APPEND is NEVER retried on 429 (exactly 1 attempt, then throws)', R.appendNoRetry.threw&&R.appendNoRetry.appendCalls===1, JSON.stringify(R.appendNoRetry));
  ck('reservation FAILS CLOSED on a lost verification read (claimRows → null → append fallback)', R.failClosed.returnedNull, JSON.stringify(R.failClosed));
  ck('partial reservation is RELEASED on a later failure (batchClear issued, returns null)', R.partialRelease.returnedNull&&R.partialRelease.clearedAfterPartial, JSON.stringify(R.partialRelease));
  ck('stale nonce sweep clears exactly the aged marker (1 of 2)', R.staleSweep.sweptCount===1, JSON.stringify(R.staleSweep));
  ck('AMBIGUOUS write surfaces an error, never a silent success (server committed, client threw)', R.ambiguous.serverCommitted&&R.ambiguous.clientThrew, JSON.stringify(R.ambiguous));
  ck('401 → session expired, no stale-token retry', R.session401.expiredCalled&&R.session401.threw, JSON.stringify(R.session401));
  ck('duplicate-tap guard detects a repeat deposit (app-layer idempotency)', R.dupTap.ok, JSON.stringify(R.dupTap));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  SCOPE: single-client fault injection through the real write paths. Does NOT prove live two-device write atomicity.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

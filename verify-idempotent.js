/* TRANSACTION-ID IDEMPOTENCY (prototype). Proves the durable-id layer retires the AMBIGUOUS-WRITE duplicate: the row carries
   a durable id in a technical column J, a localStorage marker is written first, and reconcilePendingTxns() reads column J on
   the next load to decide — exactly, by id — whether an interrupted append landed (clear) or not (re-append with the same id).
   Driven through the REAL idempotentAppend / reconcilePendingTxns against a simulated Sheets backend at the fetch layer.
   SCOPE: single-client reconciliation of an interrupted own write. Still not live two-device atomicity. */
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
  await page.waitForFunction(()=>typeof idempotentAppend==='function'&&typeof reconcilePendingTxns==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const res=await page.evaluate(async()=>{
    accessToken='tok';sheetId='sid';_ledgerTxnColOk=false;
    try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('nw_txn_')===0)localStorage.removeItem(k);});}catch(e){}
    var SHEET=[];      // committed rows, each a 10-wide array (col J = index 9 = txn id)
    var APPENDS=0;     // count of append CALLS reaching the "server"
    function jset(){var s={};SHEET.forEach(function(r){if(r[9])s[(""+r[9]).trim()]=1;});return s;}
    var real=window.fetch;
    window.fetch=async function(url,opts){url=String(url);opts=opts||{};
      if(/\?fields=sheets/.test(url))return respond(200,{sheets:[{properties:{title:'Account Ledger',sheetId:1,gridProperties:{columnCount:10}}}]}); // grid already has col J
      if(/:append/.test(url)){APPENDS++;var body=JSON.parse(opts.body||'{}');(body.values||[]).forEach(function(r){SHEET.push(r.slice());}); // COMMIT server-side
        if(window.__ambiguous){throw new Error('network dropped after commit');} // the ambiguous case: committed, but the client never hears back
        return respond(200,{updates:{updatedRange:"'Account Ledger'!A"+SHEET.length}});}
      if(/\/values\/[^:?]*J2:J/.test(decodeURIComponent(url)))return respond(200,{values:SHEET.map(function(r){return [r[9]||''];})}); // reconcile reads column J
      if(/\/values\/[^:?]*A1(%3A|:)A/.test(url))return respond(403,{}); // force claimRows → null → append fallback (keeps the test deterministic)
      if(/batchUpdate|batchClear/.test(url))return respond(200,{});
      return respond(200,{});
      function respond(st,bd){return {ok:st>=200&&st<300,status:st,json:async function(){return bd;},text:async function(){return JSON.stringify(bd);}};}
    };
    function markers(){var n=0;try{for(var i=0;i<localStorage.length;i++){if((localStorage.key(i)||'').indexOf('nw_txn_')===0)n++;}}catch(e){}return n;}
    var dvals=function(a){return [2026,8,'2026-08-01','Denzell','Deposit','',a,'','N'];};
    var R={};

    // 1) NORMAL append: row+id committed to J, marker cleared
    window.__ambiguous=false;APPENDS=0;
    var r1=await idempotentAppend(dvals(100));
    R.normal={appends:APPENDS,idInSheet:!!jset()[r1.id],markers:markers(),rows:SHEET.length};

    // 2) AMBIGUOUS: server commits, client throws → marker REMAINS, row IS in the sheet
    window.__ambiguous=true;APPENDS=0;var ambId=null,threw=false;
    try{var r2=await idempotentAppend(dvals(200));ambId=r2.id;}catch(e){threw=true;}
    // recover the pending id from the marker
    try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('nw_txn_')===0){ambId=JSON.parse(localStorage.getItem(k)).id;}}}catch(e){}
    R.ambiguous={threw:threw,markers:markers(),committedRow:!!(ambId&&jset()[ambId]),appends:APPENDS};

    // 3) RECONCILE finds the id in column J → clears the marker, NO re-append (no duplicate)
    window.__ambiguous=false;APPENDS=0;var rowsBefore=SHEET.length;
    await reconcilePendingTxns();
    R.reconcileLanded={markersAfter:markers(),reAppends:APPENDS,rowsUnchanged:SHEET.length===rowsBefore,dupCount:SHEET.filter(function(r){return r[9]===ambId;}).length};

    // 4) RECONCILE when the write NEVER landed → re-append exactly once with the same id
    var lostId="NW-lostwrite01";
    try{localStorage.setItem('nw_txn_'+lostId,JSON.stringify({id:lostId,v:dvals(300),ts:Date.now(),sid:'sid'}));}catch(e){}
    APPENDS=0;var rb2=SHEET.length;
    await reconcilePendingTxns();
    R.reconcileLost={reAppends:APPENDS,nowInSheet:!!jset()[lostId],markersAfter:markers(),dupCount:SHEET.filter(function(r){return r[9]===lostId;}).length,rowsDelta:SHEET.length-rb2};

    window.fetch=real;
    return R;
  });

  const R=res;
  ck('normal append commits the row+id to column J and clears the pending marker', R.normal.appends===1&&R.normal.idInSheet&&R.normal.markers===0, JSON.stringify(R.normal));
  ck('ambiguous write (commit then lost response): marker REMAINS, row is in the sheet', R.ambiguous.threw&&R.ambiguous.markers===1&&R.ambiguous.committedRow, JSON.stringify(R.ambiguous));
  ck('reconcile finds the id in J → clears marker, does NOT re-append (no duplicate)', R.reconcileLanded.markersAfter===0&&R.reconcileLanded.reAppends===0&&R.reconcileLanded.dupCount===1, JSON.stringify(R.reconcileLanded));
  ck('reconcile when the write never landed → re-appends exactly once with the same id', R.reconcileLost.reAppends===1&&R.reconcileLost.nowInSheet&&R.reconcileLost.markersAfter===0&&R.reconcileLost.dupCount===1&&R.reconcileLost.rowsDelta===1, JSON.stringify(R.reconcileLost));
  ck('INVARIANT: every id appears at most once (no duplicate across the whole flow)', R.reconcileLanded.dupCount<=1&&R.reconcileLost.dupCount<=1, '');

  // PERSIST-IDEMP-002 — if the durable pending marker can't be stored, idempotentAppend must FAIL CLOSED: throw and perform NO
  // write (a write with no recovery record is exactly the ambiguous-duplicate risk this path exists to remove).
  const idemp002=await page.evaluate(async()=>{
    accessToken='tok';sheetId='sid';_ledgerTxnColOk=false;
    var APPENDS=0,real=window.fetch;
    window.fetch=async function(url){url=String(url);
      if(/\?fields=sheets/.test(url))return J(200,{sheets:[{properties:{title:'Account Ledger',sheetId:1,gridProperties:{columnCount:10}}}]});
      if(/:append/.test(url)){APPENDS++;return J(200,{updates:{}});}
      return J(200,{});
      function J(s,b){return {ok:s>=200&&s<300,status:s,json:async function(){return b;},text:async function(){return JSON.stringify(b);}};}
    };
    var origSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(){throw new Error("storage blocked (private mode / quota)");}; // simulate unavailable storage
    var threw=false,msg="";
    try{await idempotentAppend([2026,8,"2026-08-01","Src","Deposit","",100,"","N"]);}catch(e){threw=true;msg=(e&&e.message)||"";}
    Storage.prototype.setItem=origSet;window.fetch=real;
    return {threw:threw,appends:APPENDS,msg:msg};
  });
  ck('PERSIST-IDEMP-002: marker-storage failure FAILS CLOSED — throws and performs NO write', idemp002.threw===true&&idemp002.appends===0, JSON.stringify(idemp002));
  ck('PERSIST-IDEMP-002: the error tells the user nothing was added', /Nothing was added|couldn.t establish a safe recovery/i.test(idemp002.msg), idemp002.msg);

  // Multi-row idempotent append (goal-move batches): each row gets its own durable id in one append, markers cleared on success.
  const multi=await page.evaluate(async()=>{
    accessToken='tok';sheetId='sid';_ledgerTxnColOk=false;
    try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('nw_txn_')===0)localStorage.removeItem(k);});}catch(e){}
    var SHEET=[],APPENDS=0,real=window.fetch;
    window.fetch=async function(url,opts){url=String(url);opts=opts||{};
      if(/\?fields=sheets/.test(url))return J(200,{sheets:[{properties:{title:'Account Ledger',sheetId:1,gridProperties:{columnCount:10}}}]});
      if(/:append/.test(url)){APPENDS++;var body=JSON.parse(opts.body||'{}');(body.values||[]).forEach(function(r){SHEET.push(r.slice());});return J(200,{updates:{}});}
      return J(200,{});
      function J(s,b){return {ok:s>=200&&s<300,status:s,json:async function(){return b;},text:async function(){return JSON.stringify(b);}};}
    };
    function markers(){var n=0;for(var i=0;i<localStorage.length;i++){if((localStorage.key(i)||'').indexOf('nw_txn_')===0)n++;}return n;}
    var rows=[[2026,8,'2026-08-01','','Travel','Vacation',100,'',''],[2026,8,'2026-08-01','','Car','Car',200,'',''],[2026,8,'2026-08-01','','Home','Home',300,'','']];
    var r=await idempotentAppendRows(rows);
    var jset={};SHEET.forEach(function(x){if(x[9])jset[x[9]]=1;});
    window.fetch=real;
    return {ids:r.ids.length,appends:APPENDS,rows:SHEET.length,allIn:r.ids.every(function(id){return jset[id];}),markers:markers(),uniqueIds:(new Set(r.ids)).size};
  });
  ck('multi-row idempotent append: N rows in ONE append, each a distinct durable id, all markers cleared', multi.ids===3&&multi.appends===1&&multi.rows===3&&multi.allIn&&multi.markers===0&&multi.uniqueIds===3, JSON.stringify(multi));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  SCOPE: single-client reconciliation of an interrupted own write. Not live two-device atomicity.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

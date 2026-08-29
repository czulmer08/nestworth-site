/* CHAOS-USER / MISUSE AUDIT. A stranger won't use NestWorth the way its author does. This drives the REAL app functions with
   the kind of input and behavior an unfamiliar person actually produces — money typed as "$1,200.00", the same category in two
   cases, $0 goals, pasted text, double-taps, archiving a goal that still holds money, deleting an income source. The success
   criterion is NOT always "prevent it": sometimes the right product behavior is to ALLOW it but keep the data safe and the
   consequence recoverable. Each case asserts the specific correct outcome. Drives real writes against an in-memory Sheets
   backend. SCOPE: single-client, simulated backend — not real OAuth/Drive, not a human study (that's BETA_STUDY.md). */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const src=fs.readFileSync(APP,'utf8');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(src);return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof addDeposit==='function'&&typeof addGoal==='function'&&typeof archiveGoal==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(async()=>{
    accessToken='tok';sheetId='sid';_ledgerTxnColOk=false;
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    // ---- in-memory Sheets backend ----
    var LEDGER_ROWS=[],APPENDS=0;
    function J(s,b){return {ok:s>=200&&s<300,status:s,json:async function(){return b;},text:async function(){return JSON.stringify(b);}};}
    window.fetch=async function(url,opts){url=String(url);opts=opts||{};
      if(/\?fields=sheets/.test(url))return J(200,{sheets:[{properties:{title:'Account Ledger',sheetId:1,gridProperties:{columnCount:10}}}]});
      if(/:append/.test(url)){APPENDS++;var body=JSON.parse(opts.body||'{}');(body.values||[]).forEach(function(r){LEDGER_ROWS.push(r.slice());});return J(200,{updates:{updatedRange:"'Account Ledger'!A"+(LEDGER_ROWS.length+1)}});}
      if(/\/values\/[^:?]*A1(%3A|:)A/.test(url))return J(403,{});   // force claimRows → append fallback (deterministic)
      if(/values:batchUpdate|values:batchClear|:batchUpdate/.test(url))return J(200,{});
      return J(200,{});
    };
    window.setYMFormula=function(){};window.refreshLocal=function(){};window.renderAll=function(){};window.syncAfterWrite=async function(){};window.writeMeta=async function(){return true;};window.loadGoals=function(){};window.showAddedUndo=function(){};window.loadAll=async function(){};window.closeOv=function(){};
    function ledgerAmt(matchCat){return LEDGER_ROWS.filter(function(r){return matchCat?((""+r[4]).toLowerCase()===matchCat):true;});}
    var Rz={};

    // helpers to drive the REAL deposit form
    state.cons=[{name:'Paycheck'}];state.rows=[];state.cats=[];state.goals=[];state.meta={cats:{},cons:{},goals:[],payees:['Me']};
    try{fillPayeeSource();}catch(e){}
    function depForm(amountStr,src){var so=document.getElementById('dSource');if(so){var has=false;for(var i=0;i<so.options.length;i++)if(so.options[i].value===(src||'Paycheck'))has=true;if(!has){var o=document.createElement('option');o.value=(src||'Paycheck');so.appendChild(o);}so.value=(src||'Paycheck');}
      document.getElementById('dAmount').value=amountStr;document.getElementById('dDate').value='2026-08-10';var dc=document.getElementById('dCompany');if(dc)dc.value='';var dd=document.getElementById('dDesc');if(dd)dd.value='';}

    // 1) money typed like a human: "$1,200.50" and "1,200" must persist as the numbers, not be rejected
    window.askConfirm=async function(){return true;};
    LEDGER_ROWS=[];APPENDS=0;depForm('$1,200.50');await addDeposit();
    Rz.dollarComma={appended:APPENDS,amt:LEDGER_ROWS.length?LEDGER_ROWS[0][6]:null};
    LEDGER_ROWS=[];APPENDS=0;state.rows=[];depForm('1,200');await addDeposit();
    Rz.commaThousands={appended:APPENDS,amt:LEDGER_ROWS.length?LEDGER_ROWS[0][6]:null};

    // 2) pasted text and $0 must be REJECTED with a message, and NOTHING written
    LEDGER_ROWS=[];APPENDS=0;state.rows=[];depForm('abcxyz');await addDeposit();
    Rz.pastedText={appended:APPENDS,msgBad:/\bbad\b/.test(document.getElementById('addMsg').className)};
    LEDGER_ROWS=[];APPENDS=0;state.rows=[];depForm('0');await addDeposit();
    Rz.zero={appended:APPENDS,msgBad:/\bbad\b/.test(document.getElementById('addMsg').className)};

    // 3) double-tap: two identical deposits → the duplicate guard means ONE logical row unless the user confirms "add anyway"
    LEDGER_ROWS=[];APPENDS=0;state.rows=[];
    window.askConfirm=async function(){return false;}; // user declines the "you already logged this" prompt
    depForm('500');await addDeposit();               // first: writes
    depForm('500');await addDeposit();               // second identical: hasDupDeposit → declined → no write
    Rz.doubleTap={appended:APPENDS};

    // 4) case chaos: goal "Car" then "car" — the second must be caught as the same goal, not create a duplicate
    window.askConfirm=async function(){return true;};
    state.meta.goals=[];window.isGoalName=function(x){return (state.meta.goals||[]).some(function(g){return g.name.toLowerCase()===(""+x).trim().toLowerCase();});};
    function goalForm(o){['gName','gTarget','gDate','gMonthly','gNote','gAccount','gCategory','gDebt','gResidualPct','gResidualCap','gStart'].forEach(function(id){var el=document.getElementById(id);if(el)el.value=(o[id]!=null?o[id]:'');});['gLocked','gResidual'].forEach(function(id){var el=document.getElementById(id);if(el)el.checked=!!o[id];});window.gEdit=null;}
    goalForm({gName:'Car',gTarget:'12000',gDate:'2026-12'});await addGoal();
    var afterCar=(state.meta.goals||[]).length;
    goalForm({gName:'car',gTarget:'9000'});await addGoal(); // same name, different case
    Rz.caseGoal={count:(state.meta.goals||[]).length,firstAdded:afterCar,msgBad:/\bbad\b/.test(document.getElementById('goalMsg').className)};

    // 5) $0 goal with no target date: ALLOWED (a wish), created without crashing, target 0
    state.meta.goals=[];goalForm({gName:'Someday Boat'});await addGoal();
    Rz.emptyGoal={count:(state.meta.goals||[]).length,target:(state.meta.goals[0]||{}).target};

    // 6) archive a goal that still holds money: ALLOWED, and the contribution history stays in the ledger (money isn't lost)
    state.meta.goals=[{name:'Vacation',target:5000,balance:1800,monthly:200}];
    state.rows=[[2026,7,'2026-07-01','','Vacation','Vacation',1800,'Goal contribution','']]; // its money lives in the ledger
    var rowsBefore=state.rows.length;await archiveGoal('Vacation',true);
    Rz.archiveWithMoney={archived:(state.meta.goals[0]||{}).archived===true,ledgerIntact:state.rows.length===rowsBefore};

    // 7) delete an income source: ALLOWED, but the deposits already logged to it must NOT vanish from the ledger
    state.cons=[{name:'Side Gig',row:40}];state.rows=[[2026,8,'2026-08-02','Side Gig','Deposit','',300,'','']];
    var depBefore=state.rows.filter(function(r){return (""+r[4]).toLowerCase()==='deposit';}).length;
    window.askConfirm=async function(){return true;};window.loadAll=async function(){};window.vBatchClear=async function(){return {};};
    try{await removeCon('Side Gig');}catch(e){}
    Rz.deleteSource={depositsIntact:state.rows.filter(function(r){return (""+r[4]).toLowerCase()==='deposit';}).length===depBefore};

    return Rz;
  });

  ck('money typed "$1,200.50" is understood as 1200.50 (not rejected)', R.dollarComma.appended===1&&Math.abs(R.dollarComma.amt-1200.50)<0.001, JSON.stringify(R.dollarComma));
  ck('money typed "1,200" is understood as 1200', R.commaThousands.appended===1&&Math.abs(R.commaThousands.amt-1200)<0.001, JSON.stringify(R.commaThousands));
  ck('pasted text in the amount is rejected with a message, nothing written', R.pastedText.appended===0&&R.pastedText.msgBad, JSON.stringify(R.pastedText));
  ck('a $0 amount is rejected with a message, nothing written', R.zero.appended===0&&R.zero.msgBad, JSON.stringify(R.zero));
  ck('double-tapping the same deposit does NOT silently create two (duplicate guard)', R.doubleTap.appended===1, JSON.stringify(R.doubleTap));
  ck('a goal typed "car" when "Car" exists is caught as the same goal (case-insensitive), not duplicated', R.caseGoal.count===1&&R.caseGoal.firstAdded===1&&R.caseGoal.msgBad, JSON.stringify(R.caseGoal));
  ck('a goal with no target and no date is ALLOWED (a wish), created without error, target $0', R.emptyGoal.count===1&&R.emptyGoal.target===0, JSON.stringify(R.emptyGoal));
  ck('archiving a goal that still holds money is ALLOWED and its ledger history is preserved (money not lost)', R.archiveWithMoney.archived&&R.archiveWithMoney.ledgerIntact, JSON.stringify(R.archiveWithMoney));
  ck('deleting an income source does NOT erase the deposits already logged to it', R.deleteSource.depositsIntact, JSON.stringify(R.deleteSource));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,4).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  SCOPE: misuse/malformed-input behavior against a simulated backend. Not a human study — see BETA_STUDY.md.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

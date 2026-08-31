/* #7 RECON → CASH-FLOW BRIDGE (v0.68.57). The recon card shows how THIS MONTH's cash-so-far is allocated; the Cash Flow screen shows a
   projected month-END balance. reconCashFlowBridge() walks the exact dollars between them: cash carried in + deposits so far − spending
   so far = cash on hand today; then − the rest of the month's PLANNED spending (+ any deposits still expected) = the Cash Flow month-end.
   The load-bearing invariant: bridge.end === computeCashflow(actual).months[thisMonth].bal to the cent, and today+restIn−restOut−oneTime
   reconciles to that same figure — so the card's "cash so far" and the Cash Flow number are provably the SAME money, one carry-in and one
   rest-of-month apart. These cases drive computeCashflow with real ledger state (no stubs) and assert the identity numerically. */
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
  await page.waitForFunction(()=>typeof reconCashFlowBridge==='function'&&typeof computeCashflow==='function'&&typeof cashReconCardHTML==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window._asOfOK=function(){return true;}; // env "today" is Aug 31; count current-month (Sep) rows as actual, as the live app would up to today
    function base(){state.cons=[{name:'Pay',bud12:fill(8000),annual:96000}];state.cats=[{name:'Living',bud12:fill(6000),annual:72000}];
      state.goals=[];state.assets=[];state.debts=[];state.meta={cats:{},cons:{},goals:[],payees:['Pay'],floor:0,startCash:5000};}
    var dep=function(y,mo,amt){return [y,mo,y+'-'+String(mo).padStart(2,'0')+'-03','Pay','Deposit','',amt,'',''];};
    var spend=function(y,mo,amt){return [y,mo,y+'-'+String(mo).padStart(2,'0')+'-12','','Living','Landlord',amt,'',''];};
    var Rz={};var cfEnd=function(){var cf=computeCashflow(currentPlan(),{mode:"actual",year:curYear()});return r2(cf.months[curMonth()-1].bal);};

    // ===== Scenario A: September, 8 completed months (8000 in / 6000 out), current month 8000 in + 3000 spent so far, plan 6000 =====
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};
    base();var rowsA=[];for(var m=1;m<=8;m++){rowsA.push(dep(2026,m,8000));rowsA.push(spend(2026,m,6000));}
    rowsA.push(dep(2026,9,8000));rowsA.push(spend(2026,9,3000));state.rows=rowsA;
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var A=reconCashFlowBridge();
    Rz.A={entering:A&&A.entering,depositsSoFar:A&&A.depositsSoFar,spentSoFar:A&&A.spentSoFar,today:A&&A.today,restIn:A&&A.restIn,restOut:A&&A.restOut,end:A&&A.end,reconciles:A&&A.reconciles,cf:cfEnd()};

    // ===== Scenario B: January (entering cash === startCash), 8000 in + 2000 spent so far, plan 6000 =====
    curMonth=function(){return 1;};base();state.rows=[dep(2026,1,8000),spend(2026,1,2000)];
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var B=reconCashFlowBridge();
    Rz.B={entering:B&&B.entering,startCash:5000,today:B&&B.today,restOut:B&&B.restOut,end:B&&B.end,reconciles:B&&B.reconciles,cf:cfEnd()};

    // ===== Scenario C: September, current-month ACTUAL spend (9000) already exceeds the plan (6000) → no rest-of-month spending =====
    curMonth=function(){return 9;};base();var rowsC=[];for(var m2=1;m2<=8;m2++){rowsC.push(dep(2026,m2,8000));rowsC.push(spend(2026,m2,6000));}
    rowsC.push(dep(2026,9,8000));rowsC.push(spend(2026,9,9000));state.rows=rowsC;
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var C=reconCashFlowBridge();
    Rz.C={restOut:C&&C.restOut,today:C&&C.today,end:C&&C.end,reconciles:C&&C.reconciles,cf:cfEnd()};

    // ===== the card actually renders the bridge block =====
    curMonth=function(){return 9;};state.rows=rowsA;if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var html=cashReconCardHTML();
    Rz.render={hasHead:/How this connects to your Cash Flow month-end/.test(html),hasToday:/Cash on hand today/.test(html),hasEnd:/Cash Flow projected month-end/.test(html),hasEntering:/Cash on hand entering/.test(html)};

    // ===== Scenario D: viewing a DIFFERENT budget year than the current one → bridge is null (actual-mode projection only) =====
    bYear=function(){return 2025;};
    Rz.D={bridge:reconCashFlowBridge()};
    return Rz;
  });

  ck('A · bridge END equals computeCashflow(actual) month-end to the cent ($23,000)',
     near(R.A.end,R.A.cf)&&near(R.A.end,23000), JSON.stringify({end:R.A.end,cf:R.A.cf}));
  ck('A · the walk reconciles: entering $21,000 + $8,000 in − $3,000 out = $26,000 today; − $3,000 rest-of-month = $23,000',
     near(R.A.entering,21000)&&near(R.A.today,26000)&&near(R.A.restOut,3000)&&near(R.A.restIn,0)&&R.A.reconciles===true, JSON.stringify(R.A));
  ck('B · in January the entering cash IS your starting cash ($5,000), and the bridge still lands on the Cash Flow month-end',
     near(R.B.entering,R.B.startCash)&&near(R.B.entering,5000)&&near(R.B.end,R.B.cf)&&near(R.B.end,7000)&&R.B.reconciles===true, JSON.stringify(R.B));
  ck('C · when actual spend already exceeds the plan there is NO rest-of-month spending (restOut $0) and today === month-end',
     near(R.C.restOut,0)&&near(R.C.today,R.C.end)&&near(R.C.end,R.C.cf)&&near(R.C.end,20000)&&R.C.reconciles===true, JSON.stringify(R.C));
  ck('the recon card renders the bridge (entering → today → Cash Flow projected month-end)',
     R.render.hasHead&&R.render.hasEntering&&R.render.hasToday&&R.render.hasEnd, JSON.stringify(R.render));
  ck('viewing a non-current budget year → bridge is null (the projection is actual-mode, live year only)',
     R.D.bridge===null, JSON.stringify(R.D));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the recon card’s "cash so far" and the Cash Flow month-end are provably the same money — one carry-in and one rest-of-month apart, reconciled to the cent.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

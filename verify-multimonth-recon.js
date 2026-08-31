/* #6 FLOOR-AWARE MULTI-MONTH RECONCILIATION (v0.68.59). monthlyCashReconciliation() is single-month; multiMonthReconciliation() rolls
   the SAME repair→build→residual→reserves hierarchy forward across the rest of the year, carrying the contingency pool month-to-month,
   and caps cumulative discretionary set-asides (build + residual, never the deficit REPAIR) at goalSafeToMove().safeToGoal — the ONE
   floor source — so surplus the Nest Egg Floor needs is reported as floorHeld reserves. These cases drive the REAL forward hierarchy on
   real planned income/expense arrays; the two hard-to-construct leaves (_contingencyEntering, goalSafeToMove — each with its own suite:
   verify-contingency-*, verify-goal-safe) are stubbed to inject a known entering deficit and a known floor headroom, isolating exactly
   the new logic. Load-bearing invariants: per-month max(0,preSurplus) === repair+build+residual+reserves, and pool carries by repair+build. */
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
  await page.waitForFunction(()=>typeof multiMonthReconciliation==='function'&&typeof monthlyCashReconciliation==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 1;};todayISO=function(){return '2026-01-15';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    function build(){
      // income $6,000/mo, expense $5,000/mo, no fixed goals → preSurplus $1,000/mo; residualPool = (72000−60000)/12 = $1,000/mo
      state.cons=[{name:'Pay',bud12:fill(6000),annual:72000}];
      state.cats=[{name:'Living',bud12:fill(5000),annual:60000}];
      state.goals=[];state.assets=[];state.debts=[];state.rows=[];
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:2000,startCash:8000,prefs:{},contingencyTarget:500};
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    // Inject an overspent contingency ENTERING the horizon (−$900) and a LARGE floor headroom (no cap) ---------------------------
    window._contingencyEntering=function(){return -900;};
    window.goalSafeToMove=function(){return {safeToGoal:100000,forwardLow:5000,forwardLowMonth:12,floor:2000,breach:false,currentProjected:8000};};
    build();
    var U=multiMonthReconciliation();
    var idOK=true;U.months.forEach(function(mm){if(mm.preSurplus>0.005&&!near(Math.max(0,mm.preSurplus),mm.repair+mm.build+mm.residual+mm.reserves))idOK=false;});
    var poolOK=true,prev=U.enteringPool;U.months.forEach(function(mm){if(!near(mm.poolAfter,prev+mm.repair+mm.build))poolOK=false;prev=mm.poolAfter;});
    var feb=U.months[1],mar=U.months[2],apr=U.months[3];
    Rz.unconstrained={idOK:idOK,poolOK:poolOK,reconciles:U.reconciles,repairedMonth:U.repairedMonth,targetMonth:U.targetMonth,
      totalRepair:U.totalRepair,floorHeld:U.floorHeld,endingPool:U.endingPool,
      febRepair:feb&&feb.repair,febBuild:feb&&feb.build,marBuild:mar&&mar.build,marResidual:mar&&mar.residual,aprResidual:apr&&apr.residual,
      months:U.months.length};
    // Same, but a SMALL floor headroom ($300) → discretionary set-asides capped, surplus held for the floor ----------------------
    window.goalSafeToMove=function(){return {safeToGoal:300,forwardLow:2000,forwardLowMonth:8,floor:2000,breach:false,currentProjected:8000};};
    build();
    var Cn=multiMonthReconciliation();
    var idOK2=true;Cn.months.forEach(function(mm){if(mm.preSurplus>0.005&&!near(Math.max(0,mm.preSurplus),mm.repair+mm.build+mm.residual+mm.reserves))idOK2=false;});
    Rz.constrained={idOK:idOK2,reconciles:Cn.reconciles,totalRepair:Cn.totalRepair,
      disc:r2(Cn.totalBuild+Cn.totalResidual),headroom:Cn.headroom,floorHeld:Cn.floorHeld,endingPool:Cn.endingPool,target:Cn.target,targetMonth:Cn.targetMonth};
    // bYear ≠ curYear → null (the forward path is actual-mode, live year only) --------------------------------------------------
    bYear=function(){return 2025;};
    Rz.wrongYear=multiMonthReconciliation();
    bYear=function(){return 2026;};
    return Rz;
  });

  var u=R.unconstrained,c=R.constrained;
  ck('per-month identity holds: max(0,preSurplus) === repair + build + residual + reserves (every month)',
     u.idOK&&u.reconciles===true, JSON.stringify({idOK:u.idOK,reconciles:u.reconciles}));
  ck('the contingency pool carries forward exactly: pool_m === pool_(m-1) + repair + build',
     u.poolOK, 'poolOK='+u.poolOK);
  ck('an overspent contingency (−$900) is repaired first: Feb repairs the full $900, then $100 builds toward the $500 target',
     near(u.febRepair,900)&&near(u.febBuild,100)&&near(u.totalRepair,900), JSON.stringify(u));
  ck('the deficit is back to $0 in Feb and the $500 target is reached in Mar (repairedMonth 2, targetMonth 3), ending pool $500',
     u.repairedMonth===2&&u.targetMonth===3&&near(u.endingPool,500), JSON.stringify({rep:u.repairedMonth,tgt:u.targetMonth,end:u.endingPool}));
  ck('once repaired & built, residual funding absorbs the surplus (Mar $600 partial, Apr full $1,000), no floor holding',
     near(u.marBuild,400)&&near(u.marResidual,600)&&near(u.aprResidual,1000)&&near(u.floorHeld,0), JSON.stringify(u));
  ck('FLOOR-AWARE: with only $300 of floor-safe headroom, cumulative build+residual is capped at $300 and the rest is floorHeld',
     c.idOK&&near(c.disc,300)&&near(c.headroom,300)&&c.floorHeld>0.005, JSON.stringify(c));
  ck('FLOOR-AWARE: the deficit REPAIR is never capped ($900 still repaired), but the target can’t be built under the floor (pool < $500)',
     near(c.totalRepair,900)&&c.endingPool<c.target-0.005&&c.targetMonth===0, JSON.stringify(c));
  ck('viewing a non-current budget year → null (forward reconciliation is actual-mode, live year only)',
     R.wrongYear===null, JSON.stringify({wrongYear:R.wrongYear}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the surplus hierarchy rolls forward month-by-month, repairing the contingency then building/residual-funding — capped by the Nest Egg Floor, reconciled to the cent each month.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

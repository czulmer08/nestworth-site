/* SURPLUS ALLOCATION / monthly cash reconciliation (model-level gap found in real use: "I got a big July deposit — where did the
   surplus go?"). NestWorth modelled expense-COVERAGE (where an overage comes from) but not the INVERSE: when actual income exceeds
   what the month required, where does the surplus go? monthlyCashReconciliation() is the authoritative helper. Hierarchy:
     actual income → actual consumption → protected fixed/linked goal commitments → REPAIR the ENTERING contingency deficit →
     residual (% of leftover) goals → unallocated reserves.
   Exact identity (CASH-ALLOC-012): income + reserveDraw === consumption + protectedGoals + contingencyRepair + residualFunding + unallocated.
   KEY: only the deficit ENTERING the month is repairable — the current month's own buffer overspend is already in `consumption`,
   so repairing the current end-of-month deficit would double-count it. */
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
  await page.waitForFunction(()=>typeof monthlyCashReconciliation==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    var realMAT=monthActualTotals, realIE=actualIE; // keep the canonical ones for the real-row cases
    // stubbed reconciliation: control income/consumption/protected/entering/residualPlanned directly for exact arithmetic
    var recon=function(income,consumption,agf,agc,entering,rp){
      monthActualTotals=function(){return {income:income,expense:consumption};};
      actualIE=function(){var agfA=fill(0),agcA=fill(0),agA=fill(0);agfA[7]=agf;agcA[7]=agc;agA[7]=agf+agc;return {ai:fill(0),ae:fill(0),ag:agA,agc:agcA,agf:agfA};};
      _contingencyEntering=function(){return entering;};
      residualPool=function(){return rp;};
      return monthlyCashReconciliation(2026,8);
    };
    var ident=function(r){return Math.abs((r.income+r.reserveDraw)-(r.consumption+r.protectedGoals+r.contingencyRepair+r.residualFunding+r.unallocated))<0.02;};
    var Rz={};
    // 001 excess income + negative contingency → surplus repairs contingency
    var g=recon(15000,11000,1000,0,-2000,1000);
    Rz.a001={repair:g.contingencyRepair,after:g.contingencyAfterRepair,residual:g.residualFunding,unalloc:g.unallocated,surplus:g.preAllocationSurplus,ident:ident(g)};
    // 002 surplus < deficit → partial repair, $0 residual
    g=recon(12000,11000,0,0,-2000,1000);
    Rz.a002={repair:g.contingencyRepair,after:g.contingencyAfterRepair,residual:g.residualFunding,ident:ident(g)};
    // 003 surplus == deficit → contingency to $0, $0 residual
    g=recon(13000,11000,0,0,-2000,1000);
    Rz.a003={repair:g.contingencyRepair,after:g.contingencyAfterRepair,residual:g.residualFunding,ident:ident(g)};
    // 004 surplus > deficit → repair first, remainder to residual
    g=recon(14000,11000,0,0,-1000,5000);
    Rz.a004={repair:g.contingencyRepair,after:g.contingencyAfterRepair,residual:g.residualFunding,ident:ident(g)};
    // 005 positive contingency → no diversion; proceed to residual, then unallocated
    g=recon(13000,11000,0,0,500,1000);
    Rz.a005={repair:g.contingencyRepair,after:g.contingencyAfterRepair,residual:g.residualFunding,unalloc:g.unallocated,ident:ident(g)};
    // 006 category overspending but income well above requirements → correct net surplus
    g=recon(15000,12000,1000,0,-500,2000);
    Rz.a006={surplus:g.preAllocationSurplus,repair:g.contingencyRepair,residual:g.residualFunding,ident:ident(g)};
    // 007 high deposits but higher consumption → no manufactured surplus; draws reserves
    g=recon(15000,16000,0,0,-2000,1000);
    Rz.a007={surplus:g.preAllocationSurplus,repair:g.contingencyRepair,residual:g.residualFunding,draws:g.drawsReserves,reserve:g.reserveDraw,hasSurplus:g.hasSurplus,ident:ident(g)};
    // 011 no excess income (income == consumption + protected) → nothing allocated, contingency unchanged
    g=recon(12000,11000,1000,0,-2000,1000);
    Rz.a011={repair:g.contingencyRepair,residual:g.residualFunding,unalloc:g.unallocated,after:g.contingencyAfterRepair,surplus:g.preAllocationSurplus,ident:ident(g)};

    // restore canonical helpers for real-row integration cases
    monthActualTotals=realMAT;actualIE=realIE;_contingencyEntering=function(){return 0;};residualPool=function(){return 5000;};
    window.isGoalName=function(x){return (""+x).trim().toLowerCase()==='vacation';};
    var dep=function(amt,d){return [2026,8,d||'2026-08-10','','deposit','',amt,'',''];};
    var exp=function(cat,amt,d){return [2026,8,d||'2026-08-10','',cat,'',amt,'',''];};
    // 008 refund increases surplus THROUGH consumption (nets it down), NOT as income
    state.cats=[];state.goals=[];state.rows=[dep(12000),exp('Food',11000),exp('Food',-500)];
    g=monthlyCashReconciliation(2026,8);
    Rz.a008={income:g.income,consumption:g.consumption,surplus:g.preAllocationSurplus,ident:ident(g)}; // income 12000, consumption 10500, surplus 1500
    // 009 goal transfer is NOT consumption and isn't double-counted
    state.goals=[{name:'Vacation',residual:true,residualPct:100}];state.rows=[dep(12000),exp('Food',10000),exp('Vacation',1000)];
    g=monthlyCashReconciliation(2026,8);
    Rz.a009={consumption:g.consumption,goalMoves:g.actualGoalMoves,ident:ident(g)}; // consumption 10000 (goal move excluded), actualGoalMoves 1000
    // 010 three-paycheck month → extra surplus after requirements; the 3rd check is not "free money"
    state.goals=[];state.rows=[dep(4000,'2026-08-03'),dep(4000,'2026-08-15'),dep(4000,'2026-08-28'),exp('Food',9000)];
    g=monthlyCashReconciliation(2026,8);
    Rz.a010={income:g.income,consumption:g.consumption,surplus:g.preAllocationSurplus,residual:g.residualFunding,ident:ident(g)}; // income 12000, consumption 9000, surplus 3000
    return Rz;
  });

  ck('CASH-ALLOC-001 excess income + −$2,000 contingency → repairs $2,000 (→ $0), then $1,000 residual, $0 unallocated; identity holds',
     near(R.a001.repair,2000)&&near(R.a001.after,0)&&near(R.a001.residual,1000)&&near(R.a001.unalloc,0)&&near(R.a001.surplus,3000)&&R.a001.ident, JSON.stringify(R.a001));
  ck('CASH-ALLOC-002 surplus $1,000 < $2,000 deficit → partial repair $1,000 (→ −$1,000), $0 residual; identity holds',
     near(R.a002.repair,1000)&&near(R.a002.after,-1000)&&near(R.a002.residual,0)&&R.a002.ident, JSON.stringify(R.a002));
  ck('CASH-ALLOC-003 surplus $2,000 == deficit → contingency to $0, $0 residual; identity holds',
     near(R.a003.repair,2000)&&near(R.a003.after,0)&&near(R.a003.residual,0)&&R.a003.ident, JSON.stringify(R.a003));
  ck('CASH-ALLOC-004 surplus $3,000 > $1,000 deficit → repair $1,000 (→ $0), remainder $2,000 to residual; identity holds',
     near(R.a004.repair,1000)&&near(R.a004.after,0)&&near(R.a004.residual,2000)&&R.a004.ident, JSON.stringify(R.a004));
  ck('CASH-ALLOC-005 positive contingency → no diversion (repair $0), residual $1,000 then $1,000 unallocated; identity holds',
     near(R.a005.repair,0)&&near(R.a005.after,500)&&near(R.a005.residual,1000)&&near(R.a005.unalloc,1000)&&R.a005.ident, JSON.stringify(R.a005));
  ck('CASH-ALLOC-006 category overspend but income well above requirements → net surplus $2,000 correct (repair $500); identity holds',
     near(R.a006.surplus,2000)&&near(R.a006.repair,500)&&near(R.a006.residual,1500)&&R.a006.ident, JSON.stringify(R.a006));
  ck('CASH-ALLOC-007 high deposits but higher consumption → NO surplus manufactured; draws $1,000 reserves, no repair/residual; identity holds',
     near(R.a007.surplus,-1000)&&near(R.a007.repair,0)&&near(R.a007.residual,0)&&R.a007.draws&&near(R.a007.reserve,1000)&&!R.a007.hasSurplus&&R.a007.ident, JSON.stringify(R.a007));
  ck('CASH-ALLOC-008 refund increases surplus THROUGH consumption (nets down), not as income (income $12,000, consumption $10,500, surplus $1,500)',
     near(R.a008.income,12000)&&near(R.a008.consumption,10500)&&near(R.a008.surplus,1500)&&R.a008.ident, JSON.stringify(R.a008));
  ck('CASH-ALLOC-009 a goal transfer is NOT consumption and isn’t double-counted (consumption $10,000, goal moves $1,000)',
     near(R.a009.consumption,10000)&&near(R.a009.goalMoves,1000)&&R.a009.ident, JSON.stringify(R.a009));
  ck('CASH-ALLOC-010 three-paycheck month → income $12,000, consumption $9,000, surplus $3,000 (3rd check isn’t free money); identity holds',
     near(R.a010.income,12000)&&near(R.a010.consumption,9000)&&near(R.a010.surplus,3000)&&R.a010.ident, JSON.stringify(R.a010));
  ck('CASH-ALLOC-011 no excess income → nothing allocated, contingency unchanged at −$2,000; identity holds',
     near(R.a011.repair,0)&&near(R.a011.residual,0)&&near(R.a011.unalloc,0)&&near(R.a011.after,-2000)&&near(R.a011.surplus,0)&&R.a011.ident, JSON.stringify(R.a011));
  ck('CASH-ALLOC-012 reconciliation identity holds across every case (every dollar has exactly one destination)',
     R.a001.ident&&R.a002.ident&&R.a003.ident&&R.a004.ident&&R.a005.ident&&R.a006.ident&&R.a007.ident&&R.a008.ident&&R.a009.ident&&R.a010.ident&&R.a011.ident, 'identity across all');

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

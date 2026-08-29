/* GOLDEN TESTS — planned vs currently-SUPPORTABLE goal funding (goalFundingStatus). The authoritative fact the Nest Review and
   Wren both narrate. It distinguishes what the PLAN allocated to goals from what THIS month's actual performance supports.
   Coverage hierarchy: category budget → the envelope's OWN accumulated balance → shared contingency (pooled buffer categories)
   → uncovered, absorbed by this month's cash. The uncovered-cash slice is exactly what erodes residual ("% of leftover")
   capacity; fixed goal commitments are protected. Two invariants must hold in EVERY scenario:
     (A) overTotal        === envelopeSelf + sharedContingencyUsed + cashAbsorbed
     (B) residualSupported === max(0, residualPlanned − cashAbsorbed)
   Scenarios: under-plan, on-plan, over-but-envelope-self-covered, over-but-shared-contingency-covered, uncovered overage
   (reduces residual), and an overage large enough to zero residual and draw reserves. */
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
  await page.waitForFunction(()=>typeof goalFundingStatus==='function'&&typeof computeRollover==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});
  const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    var CARRY={},SPEND={};carryInFor=function(n){return (CARRY[(""+n).toLowerCase()]||0);};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    window.catSpend12=function(n){return (SPEND[(""+n).toLowerCase()]||fill(0)).slice();};window.spentByMonth=window.catSpend12;
    window.isGoalName=function(x){return (state.goals||[]).some(function(g){return g&&g.name&&g.name.toLowerCase()===(""+x).trim().toLowerCase();});};
    // Standard household: income $120k/yr; a fixed $1,000/mo goal; a residual goal. Budget varies per scenario.
    function base(){
      state.cons=[{name:'Inc',annual:120000,bud12:fill(10000)}];
      state.goals=[{name:'Emergency',monthly:1000,target:20000,balance:5000,archived:false},{name:'Vacation',residual:true,residualPct:100,target:8000,balance:1000,archived:false}];
      state.assets=[];state.debts=[];state.rows=[];CARRY={};SPEND={};
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:0};
    }
    function plainCat(name,mbud,mused,annual){state.meta.cats[name.toLowerCase()]={type:'monthly'};return {name:name,mbud:mbud,mused:mused,annual:annual,bud12:fill(mbud)};}
    function envCat(name,mbud,annual,roll){state.meta.cats[name.toLowerCase()]={type:'monthly',roll:roll};return {name:name,mbud:mbud,annual:annual,bud12:fill(mbud)};}
    var Rz={},G;

    // 1) UNDER plan — Living $6,500 of $7,000; no overage
    base();state.cats=[plainCat('Living',7000,6500,84000)];G=goalFundingStatus();
    Rz.under={overTotal:G.overTotal,cash:G.cashAbsorbed,rp:G.residualPlanned,rs:G.residualSupported,reduced:G.residualReduced,recon:near(G.overTotal,G.envelopeSelf+G.sharedContingencyUsed+G.cashAbsorbed),inv:near(G.residualSupported,Math.max(0,G.residualPlanned-G.cashAbsorbed))};

    // 2) EXACTLY on plan — Living $7,000 of $7,000
    base();state.cats=[plainCat('Living',7000,7000,84000)];G=goalFundingStatus();
    Rz.on={overTotal:G.overTotal,cash:G.cashAbsorbed,rs:G.residualSupported,rp:G.residualPlanned,recon:near(G.overTotal,G.envelopeSelf+G.sharedContingencyUsed+G.cashAbsorbed),inv:near(G.residualSupported,Math.max(0,G.residualPlanned-G.cashAbsorbed))};

    // 3) OVER, covered by the envelope's OWN banked balance — Food banked ~$2,100, spends $800 vs $500 alloc (over $300)
    base();state.cats=[plainCat('Living',7000,7000,78000),envCat('Food',500,6000,'envelope')];
    SPEND['food']=[200,200,200,200,200,200,200,800,0,0,0,0]; // Jan–Jul bank $300/mo (2,100); Aug spends $800 (over $300), still positive
    G=goalFundingStatus();
    Rz.envSelf={overTotal:G.overTotal,envelopeSelf:G.envelopeSelf,cash:G.cashAbsorbed,shared:G.sharedContingencyUsed,rs:G.residualSupported,rp:G.residualPlanned,reduced:G.residualReduced,recon:near(G.overTotal,G.envelopeSelf+G.sharedContingencyUsed+G.cashAbsorbed),inv:near(G.residualSupported,Math.max(0,G.residualPlanned-G.cashAbsorbed))};

    // 4) OVER, envelope goes into deficit but SHARED CONTINGENCY covers it — Kids spends $600 vs $500 every month; Buf banks $300/mo
    base();state.cats=[plainCat('Living',7000,7000,72000),envCat('Kids',500,6000,'envelope'),envCat('Buf',300,3600,'buffer')];
    SPEND['kids']=fill(600);SPEND['buf']=fill(0); // Kids −$700 cumulative; Aug over $100. Buffer +$2,100 → contingency covers
    G=goalFundingStatus();
    Rz.sharedCov={overTotal:G.overTotal,shared:G.sharedContingencyUsed,cash:G.cashAbsorbed,rs:G.residualSupported,rp:G.residualPlanned,reduced:G.residualReduced,recon:near(G.overTotal,G.envelopeSelf+G.sharedContingencyUsed+G.cashAbsorbed),inv:near(G.residualSupported,Math.max(0,G.residualPlanned-G.cashAbsorbed))};

    // 5) UNCOVERED overage — Living $7,460 of $7,000 (over $460), no cushion → cash absorbs it, residual drops by $460
    base();state.cats=[plainCat('Living',7000,7460,84000)];G=goalFundingStatus();
    Rz.uncovered={overTotal:G.overTotal,cash:G.cashAbsorbed,rp:G.residualPlanned,rs:G.residualSupported,reduced:G.residualReduced,draws:G.drawsReserves,recon:near(G.overTotal,G.envelopeSelf+G.sharedContingencyUsed+G.cashAbsorbed),inv:near(G.residualSupported,Math.max(0,G.residualPlanned-G.cashAbsorbed))};

    // 6) BIG overage — Living $9,500 of $7,000 (over $2,500 > $2,000 residual) → residual to $0 AND draws reserves
    base();state.cats=[plainCat('Living',7000,9500,84000)];G=goalFundingStatus();
    Rz.big={cash:G.cashAbsorbed,rp:G.residualPlanned,rs:G.residualSupported,draws:G.drawsReserves,overflow:G.overflow,fixed:G.fixedSupported,recon:near(G.overTotal,G.envelopeSelf+G.sharedContingencyUsed+G.cashAbsorbed),inv:near(G.residualSupported,Math.max(0,G.residualPlanned-G.cashAbsorbed))};
    return Rz;
  });

  ck('UNDER plan: no overage, residual fully supported = planned $2,000; invariants hold', near(R.under.overTotal,0)&&near(R.under.cash,0)&&near(R.under.rs,2000)&&near(R.under.rp,2000)&&!R.under.reduced&&R.under.recon&&R.under.inv, JSON.stringify(R.under));
  ck('ON plan: no overage, residual supported = planned; invariants hold', near(R.on.overTotal,0)&&near(R.on.cash,0)&&near(R.on.rs,R.on.rp)&&R.on.recon&&R.on.inv, JSON.stringify(R.on));
  ck('OVER but envelope self-covers ($300 from its own banked): NO cash, residual UNCHANGED; invariants hold', near(R.envSelf.envelopeSelf,300)&&near(R.envSelf.cash,0)&&near(R.envSelf.shared,0)&&near(R.envSelf.rs,R.envSelf.rp)&&!R.envSelf.reduced&&R.envSelf.recon&&R.envSelf.inv, JSON.stringify(R.envSelf));
  ck('OVER but SHARED CONTINGENCY covers the deficit: NO cash, residual UNCHANGED; invariants hold', R.sharedCov.shared>0.005&&near(R.sharedCov.cash,0)&&near(R.sharedCov.rs,R.sharedCov.rp)&&!R.sharedCov.reduced&&R.sharedCov.recon&&R.sharedCov.inv, JSON.stringify(R.sharedCov));
  ck('UNCOVERED $460 overage → cash absorbs it, supported residual = $2,000 − $460 = $1,540; invariants hold', near(R.uncovered.cash,460)&&near(R.uncovered.rs,1540)&&R.uncovered.reduced&&!R.uncovered.draws&&R.uncovered.recon&&R.uncovered.inv, JSON.stringify(R.uncovered));
  ck('BIG $2,500 overage → residual to $0 AND draws reserves ($500 over capacity); fixed still protected; invariants hold', near(R.big.rs,0)&&R.big.draws&&near(R.big.overflow,500)&&near(R.big.fixed,1000)&&R.big.recon&&R.big.inv, JSON.stringify(R.big));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

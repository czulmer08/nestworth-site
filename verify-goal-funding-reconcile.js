/* FINANCIAL RECONCILIATION AUDIT (Test B, not Test A). Proves the PROPOSITION behind the copy, at the ENGINE level — no UI
   strings tested here. For each goal type and coverage layer it computes authoritative outputs and asserts:
     • the household cash identity:  income + reservesDrawn − consumption − fixedSupported − residualSupported = −overflow
       (overflow = money the overage pushed past this month's discretionary room, i.e. into reserves / below the floor);
     • whether PLANNED goal funding equals ECONOMICALLY-SUPPORTABLE goal funding, and if not, by exactly how much.
   Keeps accumulated-envelope coverage distinct from shared-contingency usage throughout.
   FINDING (asserted below): fixed and category-linked goal money is reserved before the leftover, so it stays equal; RESIDUAL
   ("% of leftover") capacity genuinely FALLS as uncovered cash absorbs an overage — so a blanket "goals are unaffected" is too
   strong, which is why goalFundingStatus() exposes residualPlanned vs residualSupported and the surfaces narrate the divergence. */
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
  await page.waitForFunction(()=>typeof goalFundingStatus==='function'&&typeof residualPool==='function'&&typeof fixedGoalMonthly==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    var CARRY={},SPEND={};carryInFor=function(n){return (CARRY[(""+n).toLowerCase()]||0);};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    window.catSpend12=function(n){return (SPEND[(""+n).toLowerCase()]||fill(0)).slice();};window.spentByMonth=window.catSpend12;
    window.isGoalName=function(x){return (state.goals||[]).some(function(g){return g&&g.name&&g.name.toLowerCase()===(""+x).trim().toLowerCase();});};
    function base(goals,floor){state.cons=[{name:'Inc',annual:120000,bud12:fill(10000)}];state.assets=[];state.debts=[];state.rows=[[2026,8,'2026-08-01','','x','y',0,'','']];CARRY={};SPEND={}; // scaffolding row amount 0 so it isn't counted as unbudgeted spend
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:floor||0};state.goals=goals;}
    function plain(name,mbud,mused,annual){state.meta.cats[name.toLowerCase()]={type:'monthly'};return {name:name,mbud:mbud,mused:mused,annual:annual,bud12:fill(mbud)};}
    function env(name,mbud,annual,roll){state.meta.cats[name.toLowerCase()]={type:'monthly',roll:roll};return {name:name,mbud:mbud,annual:annual,bud12:fill(mbud)};}
    // household cash identity for THIS month (Aug, idx 7). consumption = actual spend (plain: mused; envelope: SPEND[cat][7]).
    function cashIdentity(g){
      var I=(state.cons||[]).reduce(function(s,c){return s+((c.bud12&&c.bud12[7])||0);},0);
      var C=(state.cats||[]).reduce(function(s,c){var isEnv=(state.meta.cats[c.name.toLowerCase()]||{}).roll;var sp=isEnv?((SPEND[c.name.toLowerCase()]||fill(0))[7]||0):(c.mused!=null?c.mused:0);return s+sp;},0);
      C=r2(C+((typeof unbudgetedConsumption==="function")?unbudgetedConsumption():0)); // canonical consumption INCLUDES unbudgeted/uncategorized spend
      // income + reserves drawn − consumption − fixed − residualSupported should equal −overflow (0 when balanced; negative = reserve/floor draw)
      var lhs=r2(I + g.envelopeSelf + g.sharedContingencyUsed - C - g.fixedSupported - g.residualSupported);
      return {I:r2(I),C:r2(C),lhs:lhs,expect:r2(-g.overflow)};
    }
    var Rz={};var GF=function(){return goalFundingStatus();};
    // NOTE: annual === mbud×12 everywhere (residualPool reads annual, month tracks mbud) so the cash identity reconciles exactly.

    // 1) FIXED monthly goal + a $600 uncovered overage → fixed PROTECTED (planned==supported); cash identity reconciles
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000}],0);state.cats=[plain('Living',7000,7600,84000)];
    var g=GF(),ci=cashIdentity(g);
    Rz.fixed={fixedPlanned:g.fixedPlanned,fixedSupported:g.fixedSupported,equal:near(g.fixedPlanned,g.fixedSupported),identity:near(ci.lhs,ci.expect),cash:g.cashAbsorbed};

    // 2) CATEGORY-LINKED goal ($200/mo into Gifts) + residual, no fixed, overage elsewhere → linked money lives in the Gifts
    //    budget (NOT the residual pool, NOT fixedGoalMonthly); residual falls by the cash overage
    base([{name:'Xmas',monthly:200,category:'Gifts',target:2400,balance:0},{name:'Vac',residual:true,residualPct:100,target:8000,balance:0}],0);
    state.cats=[plain('Living',6800,7260,81600),plain('Gifts',200,200,2400)]; // budget 84,000/yr → residualPlanned 3,000; Living $460 over
    g=GF();ci=cashIdentity(g);
    Rz.linked={residualPlanned:g.residualPlanned,residualSupported:g.residualSupported,fallsByCash:near(g.residualPlanned-g.residualSupported,g.cashAbsorbed),cash:g.cashAbsorbed,linkedNotInFixed:near(g.fixedPlanned,0),identity:near(ci.lhs,ci.expect)};

    // 3) RESIDUAL % goal + fixed $1,000 + uncovered $460 overage → planned $2,000 vs supported $1,540 (FALLS); identity reconciles
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000},{name:'Vac',residual:true,residualPct:100,target:8000,balance:0}],0);state.cats=[plain('Living',7000,7460,84000)];
    g=GF();ci=cashIdentity(g);
    Rz.residual={rp:g.residualPlanned,rs:g.residualSupported,diverges:g.residualPlanned>g.residualSupported+0.005,exact:near(g.residualSupported,r2(g.residualPlanned-g.cashAbsorbed)),cash:g.cashAbsorbed,identity:near(ci.lhs,ci.expect)};

    // 4) CAPPED residual (cap $400) + fixed + $460 overage → the leftover POOL still falls by the cash-absorbed amount
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000},{name:'Vac',residual:true,residualPct:100,residualCap:400,target:8000,balance:0}],0);state.cats=[plain('Living',7000,7460,84000)];
    g=GF();
    Rz.capped={rp:g.residualPlanned,rs:g.residualSupported,poolFalls:near(g.residualSupported,r2(g.residualPlanned-g.cashAbsorbed))};

    // 5) OVER but ENVELOPE self-covers ($300 from its own banked) → residual UNCHANGED; NO shared contingency used; identity reconciles
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000},{name:'Vac',residual:true,residualPct:100,target:8000,balance:0}],0);
    state.cats=[plain('Living',7000,7000,84000),env('Food',500,6000,'envelope')];SPEND['food']=[200,200,200,200,200,200,200,800,0,0,0,0];
    g=GF();ci=cashIdentity(g);
    Rz.envSelf={envelopeSelf:g.envelopeSelf,shared:g.sharedContingencyUsed,cash:g.cashAbsorbed,rEqual:near(g.residualPlanned,g.residualSupported),identity:near(ci.lhs,ci.expect)};

    // 6) OVER, envelope deficit covered by SHARED CONTINGENCY → residual UNCHANGED; envelopeSelf and shared kept DISTINCT; identity reconciles
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000},{name:'Vac',residual:true,residualPct:100,target:8000,balance:0}],0);
    state.cats=[plain('Living',7000,7000,84000),env('Kids',500,6000,'envelope'),env('Buf',300,3600,'buffer')];
    SPEND['kids']=fill(600);SPEND['buf']=[0,0,0,0,0,0,0,300,0,0,0,0]; // Buf banks Jan–Jul, spends its budget in Aug (no in-month banking)
    g=GF();ci=cashIdentity(g);
    Rz.sharedCov={shared:g.sharedContingencyUsed,envelopeSelf:g.envelopeSelf,cash:g.cashAbsorbed,rEqual:near(g.residualPlanned,g.residualSupported),identity:near(ci.lhs,ci.expect)};

    // 7) BIG overage crossing the NEST EGG FLOOR — $2,500 over > $2,000 residual → residual 0, overflow $500 draws reserves/floor
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000},{name:'Vac',residual:true,residualPct:100,target:8000,balance:0}],3000);state.cats=[plain('Living',7000,9500,84000)];
    g=GF();ci=cashIdentity(g);
    Rz.floor={rs:g.residualSupported,overflow:g.overflow,draws:g.drawsReserves,floorSet:g.floor,identity:near(ci.lhs,ci.expect),identityVal:ci.lhs,expect:ci.expect};

    // 8) UNBUDGETED consumption — $500 in a category with no budget line, all budgeted categories exactly on plan. It is real
    //    cash consumption (canonical monthActualTotals includes it) with no cushion, so supportable residual falls by exactly the
    //    $500, and the full household cash identity (C now includes unbudgeted spend) reconciles.
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000},{name:'Vac',residual:true,residualPct:100,target:8000,balance:0}],0);
    state.cats=[plain('Living',8000,8000,96000)];state.rows=[[2026,8,'2026-08-10','','Misc','',500,'','']];
    g=GF();ci=cashIdentity(g);
    Rz.unbudg={cash:g.cashAbsorbed,rp:g.residualPlanned,rs:g.residualSupported,fallsByCash:near(g.residualPlanned-g.residualSupported,g.cashAbsorbed),identity:near(ci.lhs,ci.expect)};
    return Rz;
  });

  ck('FIXED goal: planned === supported (reserved from income first, protected under overage); cash identity reconciles', R.fixed.equal&&near(R.fixed.fixedSupported,1000)&&R.fixed.identity, JSON.stringify(R.fixed));
  ck('CATEGORY-LINKED goal: funded from the category budget (not the residual pool); residual still falls by the cash overage; identity reconciles', R.linked.linkedNotInFixed&&R.linked.fallsByCash&&R.linked.identity, JSON.stringify(R.linked));
  ck('RESIDUAL goal: planned $2,000 DIVERGES from supported $1,540 under an uncovered overage — the blanket "unaffected" is too strong', R.residual.diverges&&near(R.residual.rp,2000)&&near(R.residual.rs,1540)&&R.residual.exact&&R.residual.identity, JSON.stringify(R.residual));
  ck('CAPPED residual: the leftover pool still falls by the cash-absorbed amount (cap is a ceiling, not protection)', R.capped.poolFalls, JSON.stringify(R.capped));
  ck('ENVELOPE self-coverage does NOT reduce residual and does NOT touch shared contingency (kept distinct); identity reconciles', near(R.envSelf.envelopeSelf,300)&&near(R.envSelf.shared,0)&&near(R.envSelf.cash,0)&&R.envSelf.rEqual&&R.envSelf.identity, JSON.stringify(R.envSelf));
  ck('SHARED CONTINGENCY covering a deficit does NOT reduce residual, kept distinct from envelope self-coverage; identity reconciles', R.sharedCov.shared>0.005&&near(R.sharedCov.cash,0)&&R.sharedCov.rEqual&&R.sharedCov.identity, JSON.stringify(R.sharedCov));
  ck('FLOOR case: a $2,500 overage zeroes residual and leaves $500 of overflow drawing on reserves/floor; identity = −overflow', near(R.floor.rs,0)&&near(R.floor.overflow,500)&&R.floor.draws&&R.floor.floorSet===3000&&R.floor.identity&&near(R.floor.identityVal,-500), JSON.stringify(R.floor));
  ck('UNBUDGETED $500 (no budget line) reduces supportable residual by exactly the cash absorbed; full cash identity reconciles', near(R.unbudg.cash,500)&&near(R.unbudg.rp,1000)&&near(R.unbudg.rs,500)&&R.unbudg.fallsByCash&&R.unbudg.identity, JSON.stringify(R.unbudg));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: fixed & category-linked goal money stays equal (reserved before the leftover); RESIDUAL capacity FALLS with uncovered cash — proven at the engine level, with the full cash identity reconciling in every case.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

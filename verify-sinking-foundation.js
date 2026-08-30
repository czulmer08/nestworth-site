/* SINKING-FUND DATA MODEL — FOUNDATION (v0.68.43). Proves the new category semantics are PROSPECTIVE and INERT: they store and
   read correctly, clamp defensively, expose the review read-model, survive the meta round-trip — and change NOTHING in any engine
   (safe-to-move, cash flow, net worth, envelope balances, the reserve are byte-identical whether or not a category carries
   purpose/contribution/sinking). The forecast reinterpretation is a later increment; this increment must be provably neutral. */
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
  await page.waitForFunction(()=>typeof catPurpose==='function'&&typeof sinkingSummary==='function'&&typeof goalSafeToMove==='function'&&typeof normMeta==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};todayISO=function(){return '2026-09-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    function baseRows(){var rr=[];for(var mo=1;mo<=8;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-03','Pay','Deposit','',1000,'','']);
      for(var mo=1;mo<=5;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-10','','Tuition','School',500,'','']);
      rr.push([2026,12,'2026-12-15','','Tuition','School',6000,'','']);return rr;}
    function build(extraCfg){
      state.cons=[{name:'Inc',bud12:fill(1000),annual:12000}];
      state.cats=[{name:'Tuition',bud12:fill(500),annual:6000}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[{name:'Checking',bal:9000}];state.debts=[{name:'Card',bal:2000}];
      state.rows=baseRows();
      var tcfg={roll:'envelope'};if(extraCfg)for(var k in extraCfg)tcfg[k]=extraCfg[k];
      state.meta={cats:{"tuition":tcfg},cons:{},goals:[],payees:['Pay'],floor:0,startCash:2000};
      window.__SPEND["tuition"]=[500,500,500,500,500,0,0,0,0,0,0,0];
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    function snapshot(){
      var cf=computeCashflow(currentPlan(),{mode:'actual',year:2026});
      var gs=goalSafeToMove();var rb=reserveBreakdown();
      return {safe:gs.safeToGoal,fLow:gs.forwardLow,cfEnd:cf.end,cfLow:cf.low,nw:netWorthNow(),bal:catBalance(state.cats[0]),
        reserve:rb?rb.reserve:null,rbTotal:rb?rb.total:null};
    }
    var Rz={};
    // ---- legacy defaults (no new fields) ----
    build(null);
    Rz.legacy={purpose:catPurpose('Tuition'),contribution:catContributionMonthly('Tuition',8),consumption:catConsumptionMonthly('Tuition',8),sinking:catSinking('Tuition'),bud:500};
    var base=snapshot();
    // ---- clamp + enum coercion ----
    build({purpose:'bogus',contribution:99999});
    Rz.coerce={purpose:catPurpose('Tuition'),contribClamped:catContributionMonthly('Tuition',8),consumption:catConsumptionMonthly('Tuition',8)};
    build({purpose:'split',contribution:200});
    Rz.split={purpose:catPurpose('Tuition'),contribution:catContributionMonthly('Tuition',8),consumption:catConsumptionMonthly('Tuition',8)};
    // ---- sinkingSummary read model ----
    build({purpose:'sinking',contribution:500,sinking:{id:'lnk1',obligation:{id:'ob1',name:'Tuition',amount:6000,dueYear:2026,dueMonth:12,source:'row'},openingFunded:1500,openingISO:'2026-09-15'}});
    Rz.summary=sinkingSummary('Tuition');
    Rz.newIdStable=(function(){var a=newSinkId('ob');var b=newSinkId('ob');return a!==b&&/^ob_/.test(a);})();
    Rz.opening=captureOpeningFunded('Tuition');
    // ---- INERT WITHOUT A LINK: purpose + contribution but NO obligation link must be byte-identical (the engine never acts on
    //      an inferred/unlinked contribution — reinterpretation requires an explicit link; that active case is verify-sinking-engine.js) ----
    build({purpose:'split',contribution:300});
    var withFields=snapshot();
    Rz.base=base;Rz.withFields=withFields;
    Rz.identical=(JSON.stringify(base)===JSON.stringify(withFields));
    // ---- meta round-trip: normMeta must preserve the new cat fields verbatim ----
    var doc={cats:{"tuition":{roll:'envelope',purpose:'split',contribution:300,sinking:{id:'lnk3',obligation:{id:'ob3',name:'Tuition',amount:6000,dueYear:2026,dueMonth:12}}}},cons:{},goals:[]};
    var rt=normMeta(JSON.parse(JSON.stringify(doc)));
    Rz.roundTrip=JSON.stringify(rt.cats.tuition)===JSON.stringify(doc.cats.tuition);
    return Rz;
  });

  ck('legacy category → purpose "ongoing", contribution $0, consumption = full budget, no sinking link',
     R.legacy.purpose==='ongoing'&&near(R.legacy.contribution,0)&&near(R.legacy.consumption,500)&&R.legacy.sinking===null, JSON.stringify(R.legacy));
  ck('defensive coercion: a bogus purpose → "ongoing"; a contribution above budget clamps to the budget ($500), consumption floors at $0',
     R.coerce.purpose==='ongoing'&&near(R.coerce.contribClamped,500)&&near(R.coerce.consumption,0), JSON.stringify(R.coerce));
  ck('split budget: contribution $200 kept, consumption = budget − contribution = $300 (total unchanged)',
     R.split.purpose==='split'&&near(R.split.contribution,200)&&near(R.split.consumption,300), JSON.stringify(R.split));
  ck('sinkingSummary read model: banked $1,500, 3 planned months (Sep–Nov) × $500 = $1,500, expected funded $3,000, remaining $3,000',
     near(R.summary.alreadyBanked,1500)&&R.summary.monthsToDue===3&&near(R.summary.plannedContributionsBeforeDueDate,1500)&&near(R.summary.expectedFundedAtDueDate,3000)&&near(R.summary.remainingUnfundedAtDueDate,3000),
     JSON.stringify(R.summary));
  ck('expectedFunded never exceeds the obligation; remaining never negative', R.summary.expectedFundedAtDueDate<=R.summary.amount+0.02&&R.summary.remainingUnfundedAtDueDate>=-0.02, JSON.stringify({exp:R.summary.expectedFundedAtDueDate,rem:R.summary.remainingUnfundedAtDueDate}));
  ck('stable id generator returns unique, prefixed ids; captureOpeningFunded reads the live banked balance ($1,500) with a date',
     R.newIdStable&&near(R.opening.amount,1500)&&/^2026-/.test(R.opening.iso), JSON.stringify({idOk:R.newIdStable,opening:R.opening}));
  ck('INERT WITHOUT A LINK: purpose + contribution but no obligation link changes NOTHING — safe-to-move, cash flow (end/low), net worth, envelope balance, and the reserve are byte-identical (reinterpretation is never inferred, it requires an explicit link)',
     R.identical, 'base='+JSON.stringify(R.base)+' with='+JSON.stringify(R.withFields));
  ck('net worth in the snapshot correctly nets debts ($9,000 − $2,000 = $7,000) — sanity that the zero-change compare is meaningful',
     near(R.base.nw,7000), 'nw='+R.base.nw);
  ck('meta round-trip: normMeta preserves purpose, contribution, and the sinking link verbatim (fields survive save/load)',
     R.roundTrip, 'roundTrip='+R.roundTrip);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the sinking-fund data model stores/reads/round-trips correctly and is provably inert — no engine output moves.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

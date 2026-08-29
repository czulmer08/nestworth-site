/* CONTINGENCY ↔ GOALS narration. The Month "Can you cover it?" block and Wren must NARRATE the authoritative
   goalFundingStatus() — distinguishing PLANNED from currently-SUPPORTABLE goal funding — not over-claim "goals unaffected."
   Two cases: (1) an overage covered by an envelope's own balance leaves residual UNTOUCHED (reassure); (2) an UNCOVERED
   overage that hits cash reduces supportable residual (say planned vs supported honestly, and that fixed goals stay protected).
   Neither surface computes this itself; both read the one helper. */
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
  await page.waitForFunction(()=>typeof coverageHtml==='function'&&typeof wrenAnalyze==='function'&&typeof goalFundingStatus==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    window.remPrefs=function(){return {overbudget:true,duesoon:true,saveup:true,missed:true,goals:true,recap:true};};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    var CARRY={},SPEND={};carryInFor=function(n){return (CARRY[(""+n).toLowerCase()]||0);};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    window.catSpend12=function(n){return (SPEND[(""+n).toLowerCase()]||fill(0)).slice();};window.spentByMonth=window.catSpend12;
    window.isGoalName=function(x){return (state.goals||[]).some(function(g){return g&&g.name&&g.name.toLowerCase()===(""+x).trim().toLowerCase();});};
    function base(goals){state.cons=[{name:'Inc',annual:120000,bud12:fill(10000)}];state.assets=[];state.debts=[];state.rows=[[2026,8,'2026-08-01','','Living','x',7000,'','']];CARRY={};SPEND={};
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:0};state.goals=goals;}
    function plain(name,mbud,mused,annual){state.meta.cats[name.toLowerCase()]={type:'monthly'};return {name:name,mbud:mbud,mused:mused,annual:annual,bud12:fill(mbud)};}
    function env(name,mbud,annual,roll){state.meta.cats[name.toLowerCase()]={type:'monthly',roll:roll};return {name:name,mbud:mbud,annual:annual,bud12:fill(mbud)};}
    var GG=[{name:'Emergency',monthly:1000,target:20000,balance:5000,archived:false},{name:'Vacation',residual:true,residualPct:100,target:8000,balance:1000,archived:false}];
    var Rz={};

    // CASE 1 — overage fully absorbed by an envelope's OWN banked balance → residual UNTOUCHED (reassure)
    base(JSON.parse(JSON.stringify(GG)));
    state.cats=[plain('Living',7000,7000,78000),env('Food',500,6000,'envelope')];SPEND['food']=[200,200,200,200,200,200,200,800,0,0,0,0];
    var g1=goalFundingStatus(),h1=coverageHtml();
    var w1=wrenAnalyze("can my contingency cover it this month?");var wt1=(w1&&(w1.answer||w1.text))||"";
    Rz.covered={cash:g1.cashAbsorbed,reduced:g1.residualReduced,reviewReassures:/doesn’t reduce your goal funding|doesn't reduce your goal funding/.test(h1),reviewNoFalseWarn:!/residual saving is supported at/.test(h1),wrenReassures:/doesn't reduce your goal funding|fully supported/.test(wt1)};

    // CASE 2 — UNCOVERED $460 overage hits cash → supported residual $1,540 of planned $2,000 (honest), fixed protected
    base(JSON.parse(JSON.stringify(GG)));
    state.cats=[plain('Living',7000,7460,84000)];
    var g2=goalFundingStatus(),h2=coverageHtml();
    var w2=wrenAnalyze("can my contingency cover it this month?");var wt2=(w2&&(w2.answer||w2.text))||"";
    Rz.reduced={cash:g2.cashAbsorbed,rp:g2.residualPlanned,rs:g2.residualSupported,reduced:g2.residualReduced,
      reviewShowsSupported:h2.indexOf(money(1540))>=0&&h2.indexOf(money(2000))>=0,reviewFixedProtected:/Fixed goals stay funded/.test(h2),
      wrenShowsSupported:wt2.indexOf("1,540")>=0||wt2.indexOf("1540")>=0,wrenNaming:/absorbed by cash|residual saving is supported/.test(wt2)};

    // CASE 3 — NO goals → no goal row, no false reassurance
    base([]);state.cats=[plain('Living',7000,7460,84000)];
    var h3=coverageHtml();
    Rz.noGoals={noGoalRow:!/goal funding|residual saving|Fixed goals stay/.test(h3),stillRendered:!!h3};

    // CASE 4 — a residual goal exists but the plan has NO leftover (income == budget → residualPlanned $0). The goal line must NOT
    // render the vacuous "planned $0.00 of residual saving is fully supported" — no pool means nothing to reassure about.
    base([{name:'Vac',residual:true,residualPct:100,target:8000,balance:0}]);
    state.cons=[{name:'Inc',annual:84000,bud12:fill(7000)}]; // income == budget → residualPool 0
    state.cats=[plain('Living',7000,7460,84000)];
    var h4=coverageHtml();
    Rz.zeroPool={noVacuous:h4.indexOf(money(0))<0&&!/residual saving is fully supported/.test(h4),stillRendered:!!h4};

    // CASE 5 — ORDER: renderReminders must put "Over budget" BEFORE "Can you cover it?"
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000},{name:'Vac',residual:true,residualPct:100,target:8000,balance:0}]);
    state.cats=[plain('Mortgage',2000,2190,24000),plain('Living',7000,7000,60000)]; // Mortgage over → OVER BUDGET
    try{if($('remBody')){renderReminders();var html=$('remBody').innerHTML;Rz.order={overIdx:html.indexOf('Over budget'),coverIdx:html.indexOf('Can you cover it'),before:html.indexOf('Over budget')>=0&&html.indexOf('Can you cover it')>=0&&html.indexOf('Over budget')<html.indexOf('Can you cover it')};}else Rz.order={before:'no-remBody'};}catch(e){Rz.order={err:e.message};}

    // CASE 6 — a BUFFER category over its monthly budget is shown in the ASSESSMENT with a "contingency buffer" note (option B),
    // not as a bare over-budget alarm (and it's kept out of the OVER BUDGET list).
    base([{name:'Emergency',monthly:1000,target:20000,balance:5000}]);
    state.meta.cats['mortgage']={type:'monthly',roll:'buffer'};
    state.cats=[{name:'Mortgage',mbud:2000,mused:2190,annual:24000,bud12:fill(2000)}];
    SPEND['mortgage']=[1500,1500,1500,1500,1500,1500,1500,2190,0,0,0,0]; // banks Jan–Jul, over in Aug; pool stays positive
    var h6=coverageHtml();
    try{$('remBody')&&renderReminders();}catch(e){}
    var remHtml=($('remBody')&&$('remBody').innerHTML)||"";
    Rz.buffer={note:/absorbed by your shared contingency buffer/.test(h6),mentionsMortgage:/Mortgage/.test(h6),notInOverBudget:remHtml.indexOf('Over budget')<0};
    return Rz;
  });

  ck('CASE 1 — envelope self-covers: residual NOT reduced; Review & Wren reassure honestly (no false "reduced" warning)', R.covered.cash<0.005&&!R.covered.reduced&&R.covered.reviewReassures&&R.covered.reviewNoFalseWarn&&R.covered.wrenReassures, JSON.stringify(R.covered));
  ck('CASE 2 — uncovered $460 overage: supportable residual = $1,540 of planned $2,000; Review shows both, fixed protected', R.reduced.reduced&&R.reduced.reviewShowsSupported&&R.reduced.reviewFixedProtected&&R.reduced.cash===460, JSON.stringify(R.reduced));
  ck('CASE 2 — Wren narrates supported vs planned and names the cash-absorbed cause', R.reduced.wrenShowsSupported&&R.reduced.wrenNaming, JSON.stringify(R.reduced));
  ck('CASE 3 — no goals: the block still renders the coverage, but shows NO goal line (no false reassurance)', R.noGoals.noGoalRow&&R.noGoals.stillRendered, JSON.stringify(R.noGoals));
  ck('CASE 4 — residual goal with NO leftover pool ($0): the vacuous "$0.00 fully supported" line is NOT shown', R.zeroPool.noVacuous&&R.zeroPool.stillRendered, JSON.stringify(R.zeroPool));
  ck('CASE 5 — ORDER: "Over budget" renders BEFORE "Can you cover it?"', R.order.before===true, JSON.stringify(R.order));
  ck('CASE 6 — a buffer category over budget shows a "contingency buffer" note in the assessment, not a bare over-budget alarm', R.buffer.note&&R.buffer.mentionsMortgage&&R.buffer.notInOverBudget, JSON.stringify(R.buffer));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

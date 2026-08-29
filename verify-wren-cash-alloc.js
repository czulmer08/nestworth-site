/* WREN routing for PROJECTED CASH + the allocation follow-up (screenshot: "What happens with my projected cash this month?" was
   answered with month SPENDING PACE; the follow-up "Will it go into my contingency or fund my goals?" answered generic contingency
   state and never resolved "it" or answered the allocation). Proves:
     WREN-CASH-001/002  "projected cash" routes to the cash-flow projection, NOT spending pace.
     WREN-CASH-003/004/005  the follow-up resolves "it" to the prior projected-cash fact and answers from monthlyCashReconciliation.
     WREN-CASH-006  contingency overspent + residual partially supportable → both $0-available and supported-vs-planned residual.
     WREN-CASH-007  positive cash + no goals → does not invent a goal allocation.
     WREN-CASH-008  negative projected cash → says there's no surplus and names the reserve draw. */
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
  await page.waitForFunction(()=>typeof wrenAnalyze==='function'&&typeof monthlyCashReconciliation==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    var A=function(q){var r=wrenAnalyze(q);return (r&&(r.answer||r.text))||"";};

    // Real setup for the PROJECTED CASH routing (computeCashflow must run).
    state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:0,startCash:0};
    state.cons=[{name:'Inc',annual:120000,bud12:fill(10000)}];
    state.cats=[{name:'Living',mbud:8000,annual:96000,bud12:fill(8000),mspent:5000,mused:5000}];
    state.goals=[];state.assets=[];state.debts=[];
    state.rows=[[2026,8,'2026-08-10','','deposit','',9000,'',''],[2026,8,'2026-08-10','','Living','',5000,'','']];

    var res={};
    res.q001=A("What happens with my projected cash this month?");
    res.q002=A("What is my projected cash this month?");

    // Allocation follow-up: stub the engine (already covered by verify-cash-allocation.js) so we test ROUTING + COMPOSITION.
    var setRC=function(o){monthlyCashReconciliation=function(){return o;};};
    var setGF=function(o){goalFundingStatus=function(){return o;};};
    var priorFact=function(){wrenCtx.lastFact={type:'projectedCash',period:'currentMonth',amount:500,ending:497,sourceIntent:'cashflowCurrentMonth'};};

    // 003 prior projected-cash → "Will it fund my goals?" (surplus present)
    setRC({hasSurplus:true,surplus:3000,contingencyRepair:2000,contingencyEntering:-2000,contingencyAfterRepair:0,contingencyEnteringDeficit:2000,residualPlanned:1000,residualFunding:1000,unallocated:0,drawsReserves:false});
    setGF({hasFixed:true,fixedSupported:1000,hasResidual:true,residualPlanned:1000});
    priorFact();res.q003=A("Will it fund my goals?");
    // 004 prior → "Will it go into contingency?" (no surplus, overspent)
    setRC({hasSurplus:false,surplus:0,contingencyRepair:0,contingencyEntering:-4252.27,contingencyAfterRepair:-4252.27,contingencyEnteringDeficit:4252.27,residualPlanned:1000,residualFunding:600,unallocated:0,reserveDraw:800,drawsReserves:true});
    setGF({hasFixed:true,fixedSupported:1000,hasResidual:true,residualPlanned:1000});
    priorFact();res.q004=A("Will it go into my contingency?");
    // 005 "Will it go into contingency or fund my goals?" (both halves)
    priorFact();res.q005=A("Will it go into my contingency or fund my goals?");
    // 006 contingency overspent + residual partially supportable (no surplus)
    priorFact();res.q006=A("Will it go into my contingency or fund my goals?"); // same stubs as 004/005 (overspent + residual 600/1000)
    // 007 positive cash + NO goals → don't invent goal allocation
    setRC({hasSurplus:true,surplus:2000,contingencyRepair:0,contingencyEntering:500,contingencyAfterRepair:500,contingencyEnteringDeficit:0,residualPlanned:0,residualFunding:0,unallocated:2000,drawsReserves:false});
    setGF({hasFixed:false,fixedSupported:0,hasResidual:false,residualPlanned:0});
    priorFact();res.q007=A("Will it fund my goals or go into contingency?");
    // 008 negative projected cash → no excess + reserve consequence
    setRC({hasSurplus:false,surplus:0,contingencyRepair:0,contingencyEntering:-2000,contingencyAfterRepair:-2000,contingencyEnteringDeficit:2000,residualPlanned:1000,residualFunding:0,unallocated:0,reserveDraw:1200,drawsReserves:true});
    setGF({hasFixed:false,fixedSupported:0,hasResidual:false,residualPlanned:0});
    priorFact();res.q008=A("Will the surplus go into contingency?");
    return res;
  });

  var isCashflow=function(s){return /projected (gain|draw)|running cash|by month-end/i.test(s)&&!/monthly budget\. at this pace|of your .* monthly budget/i.test(s);};
  ck('WREN-CASH-001 "What happens with my projected cash this month?" → cash-flow projection, NOT spending pace', isCashflow(R.q001), R.q001);
  ck('WREN-CASH-002 "What is my projected cash this month?" → cash-flow projection', isCashflow(R.q002), R.q002);
  ck('WREN-CASH-003 prior projected-cash → "Will it fund my goals?" → resolves "it", uses goal-funding facts (residual $1,000 of $1,000)',
     /residual goals? is supported|residual goal funding/i.test(R.q003)&&/\$1,000\.00/.test(R.q003)&&/fixed goal contributions/i.test(R.q003), R.q003);
  ck('WREN-CASH-004 prior → "Will it go into contingency?" → explains it isn’t auto-funded, contingency still overspent ($0 available)',
     /does(n’|n')t automatically refill it|nothing refills your contingency/i.test(R.q004)&&/\$0 available/.test(R.q004), R.q004);
  ck('WREN-CASH-005 "…contingency or fund my goals?" → answers BOTH halves (contingency AND goals)',
     /contingency/i.test(R.q005)&&/(residual goal funding|fixed goal contributions)/i.test(R.q005), R.q005);
  ck('WREN-CASH-006 overspent contingency + residual partially supportable → both $0-available and supported-vs-planned residual',
     /\$0 available/.test(R.q006)&&/\$600\.00 of your planned \$1,000\.00/.test(R.q006), R.q006);
  ck('WREN-CASH-007 positive cash + NO goals → does NOT invent a goal allocation', /don.t have goals set up/i.test(R.q007)&&!/residual goal funding is supported/i.test(R.q007), R.q007);
  ck('WREN-CASH-008 negative projected cash → says no surplus and names the reserve draw ($1,200)', /(isn.t a surplus|no surplus)/i.test(R.q008)&&/\$1,200\.00 from reserves/.test(R.q008), R.q008);

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

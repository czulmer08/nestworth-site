/* "YOUR MONEY RIGHT NOW" — the single consolidated Month card (v0.68.34). One story, four layers:
   (1) the answer — one hero "$X safe to move to [goal]"; (2) why — the AUTHORITATIVE, floor-INDEPENDENT waterfall
   available === reserve + floor + safe (proven: vary the floor and reserve/forwardLow are unchanged, only safe moves —
   the floor is never hidden inside the reserve, and every number comes straight from goalSafeToMove, not reverse-engineered);
   (3) this month — deposits, actual spending, "Cash not yet spent" (the misleading "Surplus to allocate" is gone);
   (4) your protection — contingency available, banked in envelopes, residual goals supportable — from the canonical helpers.
   Contingency history, envelope balances, "what the reserve protects" and "where did the extra go" live behind expandables. */
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
  await page.waitForFunction(()=>typeof moneyRightNow==='function'&&typeof goalSafeToMove==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2027;};bYear=function(){return 2026;};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    function setup(floor){
      var exp=fill(9000);exp[5]=16000;
      state.cons=[{name:'Candice',bud12:fill(10000),annual:120000,mdep:9797.11,mtarget:8297.73}];
      state.cats=[{name:'Living',bud12:exp,annual:0}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];
      state.assets=[];state.debts=[];state.rows=[];
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:floor,startCash:5000};
    }
    var Rz={};
    // A) primary at floor $1,000 → available 6000 = reserve 2000 + floor 1000 + safe 3000
    setup(1000);var m=moneyRightNow(),gs=goalSafeToMove(),h=moneyNowHTML();
    Rz.A={available:m.available,reserve:m.reserve,floor:m.floor,safe:m.safe,fLow:m.forwardLow,gsSafe:gs.safeToGoal,abovePlan:m.abovePlan,
      sum:r2(m.reserve+m.floor+m.safe),html:h};
    // B) FLOOR INDEPENDENCE: vary floor; reserve + forwardLow unchanged, only safe moves
    setup(0);var m0=moneyRightNow();setup(3000);var m3=moneyRightNow();
    Rz.B={r0:m0.reserve,r1:m.reserve,r3:m3.reserve,fl0:m0.forwardLow,fl3:m3.forwardLow,s0:m0.safe,s1:m.safe,s3:m3.safe};
    // C) THIS MONTH + PROTECTION sourced from the canonical helpers (override to known values; safe must NOT change)
    setup(1000);
    window.monthlyCashReconciliation=function(){return {income:7500,consumption:3335,protectedGoals:0,contingencyRepair:0,contingencyBuild:0,residualFunding:1050,unallocated:3115,reserveDraw:0,drawsReserves:false,contingencyEffective:2100};};
    window.computeRollover=function(){return {rawBuffer:2100,envTotal:0,envelopes:[],remainingContingency:2100};};
    window.goalFundingStatus=function(){return {residualSupported:1050,residualPlanned:1050,hasResidual:true};};
    var mc=moneyRightNow(),hc=moneyNowHTML();
    Rz.C={deposits:mc.deposits,spending:mc.spending,notYetSpent:mc.notYetSpent,cont:mc.contingencyAvailable,env:mc.envelopesBanked,resid:mc.residualSupportable,safe:mc.safe,html:hc};
    // D) BREACH
    setup(1000);state.cats[0].bud12[5]=22000;var mb=moneyRightNow(),hb=moneyNowHTML();
    Rz.D={safe:mb.safe,breach:mb.breach,html:hb};
    // E) RESERVE BREAKDOWN — "what's ahead" reconciles EXACTLY to the reserve; methodology demoted behind a nested disclosure
    (function(){
      var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
      var exp=fill(7000);exp[1]=8000;exp[2]=8500;exp[3]=9000; // Feb/Mar/Apr draw 1000/1500/2000, low at Apr
      state.cons=[{name:'Inc',bud12:fill(7000),annual:84000}];state.cats=[{name:'L',bud12:exp,annual:0}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=[];
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:1000,startCash:8000};
    })();
    var rb=reserveBreakdown(),he=moneyNowHTML();
    Rz.E={reserve:rb.reserve,total:rb.total,reconciles:rb.reconciles,tight:rb.tightMonth,
      names:rb.months.map(function(r){return r.name;}),needs:rb.months.map(function(r){return r.needed;}),
      consistent:rb.months.every(function(r){return Math.abs((r.recurring+r.known)-(r.income-r.net))<0.02;}),
      html:he};
    // G) roll-independence of the safe figure
    (function(){
      function safeWith(roll){var exp=[];for(var i=0;i<12;i++)exp.push(9000);exp[5]=16000;
        state.cons=[{name:'Inc',bud12:(function(){var a=[];for(var i=0;i<12;i++)a.push(10000);return a;})(),annual:120000}];
        state.cats=[{name:'Living',bud12:exp,annual:108000,mbud:9000,mspent:6000,mused:6000}];
        state.goals=[{name:'Car',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=[];
        state.meta={cats:(roll?{"living":{roll:roll}}:{}),cons:{},goals:[],payees:['Me'],floor:1000,startCash:5000};
        return goalSafeToMove().safeToGoal;}
      Rz.G={none:safeWith(null),envelope:safeWith('envelope'),buffer:safeWith('buffer')};
    })();
    // H) multiple-goal handling — the label is count-aware (safe-to-move is goal-agnostic)
    (function(){
      window.goalSafeToMove=function(){return {currentProjected:6000,forwardLow:4000,forwardLowMonth:6,floor:1000,safeToGoal:3000,billsCovered:true,breach:false,breachBy:0,startCashSet:true,startCash:5000};};
      function label(goals){state.goals=goals;var h=moneyNowHTML();var m=h.match(/Safe to move to ([^<]+)</);return m?m[1]:'';}
      Rz.H={one:label([{name:'Car Fund',residual:true,archived:false}]),
            two:label([{name:'Car Fund',residual:true,archived:false},{name:'Vacation',monthly:150,archived:false}]),
            none:label([]),
            twoNote:/put it toward any one goal, or split it/.test((state.goals=[{name:'Car Fund',residual:true,archived:false},{name:'Vacation',archived:false}],moneyNowHTML()))};
    })();
    return Rz;
  });

  // A — authoritative waterfall + single source
  ck('IDENTITY: available === reserve + floor + safe (6000 = 2000 + 1000 + 3000)',
     near(R.A.sum,R.A.available)&&near(R.A.available,6000)&&near(R.A.reserve,2000)&&near(R.A.floor,1000)&&near(R.A.safe,3000), JSON.stringify(R.A).slice(0,160));
  ck('SINGLE SOURCE: the hero safe figure is exactly goalSafeToMove().safeToGoal',
     near(R.A.safe,R.A.gsSafe)&&near(R.A.safe,3000), 'safe='+R.A.safe+' gs='+R.A.gsSafe);
  ck('WATERFALL renders: "Available cash now", "Reserved for what’s ahead", "Nest Egg Floor", "Safe to move"',
     /Available cash now/.test(R.A.html)&&/Reserved for what’s ahead/.test(R.A.html)&&/Nest Egg Floor/.test(R.A.html)&&/Safe to move/.test(R.A.html), 'labels');
  ck('ONE hero only: the answer label "Safe to move to Car Fund" appears once (prose mentions in collapsed expandables are fine)',
     (R.A.html.match(/Safe to move to Car Fund/g)||[]).length===1, 'count='+(R.A.html.match(/Safe to move to Car Fund/g)||[]).length);
  ck('the "Reserved for what’s ahead" row is itself the inline dropdown (tap-to-expand right there), not a separate expandable',
     /<summary class="mn-drow">(<span>)?<span class="ck">▸<\/span> Reserved for what’s ahead/.test(R.A.html)&&!/What is the .* reserved for\?/.test(R.A.html), 'inline reserve disclosure');
  // B — floor independence (the correctness check the design demanded)
  ck('FLOOR-INDEPENDENT: reserve is identical at floor $0/$1000/$3000 (floor NOT double-counted in the reserve)',
     near(R.B.r0,R.B.r1)&&near(R.B.r1,R.B.r3)&&near(R.B.r0,2000), JSON.stringify({r0:R.B.r0,r1:R.B.r1,r3:R.B.r3}));
  ck('FLOOR-INDEPENDENT: forwardLow identical across floors; safe moves dollar-for-dollar with the floor',
     near(R.B.fl0,R.B.fl3)&&near(R.B.s0-R.B.s1,1000)&&near(R.B.s1-R.B.s3,2000), JSON.stringify(R.B));
  // C — this month + protection from canonical helpers; no "surplus"/"cash remaining"; safe unaffected
  ck('THIS MONTH from monthlyCashReconciliation: deposits 7500, spending 3335, "Cash not yet spent" 4165',
     near(R.C.deposits,7500)&&near(R.C.spending,3335)&&near(R.C.notYetSpent,4165)&&/Cash not yet spent/.test(R.C.html), JSON.stringify({d:R.C.deposits,s:R.C.spending,n:R.C.notYetSpent}));
  ck('YOUR PROTECTION from the helpers: contingency 2100, envelopes 0, residual supportable 1050',
     near(R.C.cont,2100)&&near(R.C.env,0)&&near(R.C.resid,1050)&&/Your protection/.test(R.C.html), JSON.stringify({c:R.C.cont,e:R.C.env,r:R.C.resid}));
  ck('the word "surplus" is gone, and there is no competing "cash remaining" number',
     !/surplus/i.test(R.C.html)&&!/cash remaining/i.test(R.C.html), 'clean');
  ck('the this-month/protection detail does NOT change the safe figure (still the projection’s $3,000)',
     near(R.C.safe,3000), 'safe='+R.C.safe);
  // D — breach
  ck('BREACH: shows "$0 safe to move" and flags the gap (no misleading positive number, no waterfall)',
     near(R.D.safe,0)&&R.D.breach===true&&/\$0 safe to move/.test(R.D.html)&&!/Available cash now/.test(R.D.html), JSON.stringify({safe:R.D.safe,breach:R.D.breach}));

  // E — reserve breakdown reconciles exactly + two-level hierarchy
  ck('RESERVE BREAKDOWN reconciles EXACTLY: the per-month "cash needed from today" sums to the displayed reserve',
     R.E.reconciles&&near(R.E.total,R.E.reserve)&&near(R.E.total,4500), JSON.stringify({total:R.E.total,reserve:R.E.reserve}));
  ck('BREAKDOWN months are the future months up to the tightest (Feb, Mar, Apr) with needs 1000/1500/2000',
     JSON.stringify(R.E.names)===JSON.stringify(['Feb','Mar','Apr'])&&JSON.stringify(R.E.needs)===JSON.stringify([1000,1500,2000])&&R.E.tight==='Apr', JSON.stringify({names:R.E.names,needs:R.E.needs}));
  ck('each month is internally consistent (recurring + known bills = income − net)', R.E.consistent, String(R.E.consistent));
  ck('the dropdown shows WHAT is ahead first ("What’s ahead", "Must stay from today’s cash"), methodology behind "How is this calculated?"',
     /What’s ahead through Apr/.test(R.E.html)&&/Must stay from today’s cash/.test(R.E.html)&&/How is this calculated\?/.test(R.E.html), 'hierarchy');
  ck('methodology uses "planned expenses and commitments" (not "bills"), and is NOT the primary content of the disclosure',
     /planned expenses and commitments/.test(R.E.html)&&R.E.html.indexOf('What’s ahead through')<R.E.html.indexOf('How is this calculated?'), 'wording+order');

  // G) residual is under "Your goals", not "Your protection"; and safe is roll-independent (contingency/envelopes not double-reserved)
  ck('residual goal funding is under "Your goals", NOT "Your protection"',
     /Your goals/.test(R.C.html)&&/Goal funding supportable/.test(R.C.html)&&R.C.html.indexOf('Goal funding supportable')>R.C.html.indexOf('Your goals')&&(R.C.html.indexOf('Your protection')<0||R.C.html.indexOf('Goal funding supportable')>R.C.html.indexOf('Your protection')), 'section split');
  ck('NO DOUBLE-RESERVE: the safe figure is identical whether a category is plain, an envelope, or a buffer (roll is a label, not a deduction)',
     R.G&&near(R.G.none,R.G.envelope)&&near(R.G.envelope,R.G.buffer), JSON.stringify(R.G));

  // H — count-aware goal label
  ck('ONE goal → the label names it ("Safe to move to Car Fund")', R.H.one==='Car Fund', 'label='+R.H.one);
  ck('MULTIPLE goals → generalizes to "your goals" (the figure is goal-agnostic, not per-goal)', R.H.two==='your goals', 'label='+R.H.two);
  ck('NO goals → "savings"', R.H.none==='savings', 'label='+R.H.none);
  ck('MULTIPLE goals adds the split note ("put it toward any one goal, or split it")', R.H.twoNote===true, String(R.H.twoNote));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: one card, one story — an authoritative floor-independent waterfall to a single safe figure, with this-month flow and protection sourced from the canonical helpers, no "surplus", no competing remainder.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

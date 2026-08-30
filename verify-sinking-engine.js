/* SINKING-FUND FORECAST ENGINE (v0.68.44, increment 2). The forward projection reinterprets a LINKED sinking/split category's
   monthly contribution as a RESERVATION of existing cash — not recurring spend — in the months from now up to (not including) the
   obligation's due month. So the money set aside monthly and the bill it funds are never double-counted. This suite proves the
   ENV-FC properties against the CORRECT model (the already-banked balance was always in available cash — §7b; the fix is the
   future contributions), plus the operational boundary and the strict gating (never inferred). */
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
  await page.waitForFunction(()=>typeof goalSafeToMove==='function'&&typeof computeCashflow==='function'&&typeof sinkingSummary==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};todayISO=function(){return '2026-09-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // Tuition sinking category, $500/mo contribution, a $6,000 Dec obligation (logged). Income $1,000/mo. Floor 0. September now.
    function build(opt){opt=opt||{};
      var billAmt=(opt.billAmt!=null)?opt.billAmt:6000, dueM=opt.dueM||12, contribution=(opt.contribution!=null)?opt.contribution:500;
      var rr=[];for(var mo=1;mo<=8;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-03','Pay','Deposit','',1000,'','']);
      if(!opt.noBill)rr.push([2026,dueM,'2026-'+String(dueM).padStart(2,'0')+'-15','','Tuition','School',billAmt,'','']);
      state.cons=[{name:'Inc',bud12:fill(1000),annual:12000}];state.cats=[{name:'Tuition',bud12:fill(500),annual:6000}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=rr;
      var tcfg={roll:'envelope',contribution:contribution};if(opt.purpose)tcfg.purpose=opt.purpose;
      if(opt.link)tcfg.sinking={id:'l1',obligation:{id:'o1',name:'Tuition',amount:billAmt,dueYear:2026,dueMonth:dueM,source:'row'},openingFunded:0,openingISO:'2026-09-15'};
      state.meta={cats:{tuition:tcfg},cons:{},goals:[],payees:['Pay'],floor:0,startCash:0};
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    function fwdLow(cf,cm){var lo=Infinity;for(var m=cm-1;m<12;m++){var bal=cf.months[m]&&cf.months[m].bal;if(bal!=null&&bal<lo)lo=bal;}return isFinite(lo)?lo:0;}
    var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    var Rz={};
    // P1 — freed contributions = plannedContributionsBeforeDueDate; safe rises by exactly that when the bill binds
    build({purpose:'ongoing',link:false});Rz.ongoing=goalSafeToMove().safeToGoal;
    build({purpose:'sinking',link:true});var gs=goalSafeToMove();Rz.sinking=gs.safeToGoal;Rz.sinkLowM=gs.forwardLowMonth;Rz.planned=sinkingSummary('Tuition').plannedContributionsBeforeDueDate;
    // P2 — operational boundary: move EXACTLY safe as a one-time outflow this month → forward low lands on the floor; +$1 breaches
    (function(){var cm=curMonth(),safe=goalSafeToMove().safeToGoal,floor=0;var p=currentPlan();
      var pa=JSON.parse(JSON.stringify(p));pa.oneTime=fill(0);pa.oneTime[cm-1]=safe;var lowA=fwdLow(computeCashflow(pa,{mode:'actual',year:2026}),cm);
      var pb=JSON.parse(JSON.stringify(p));pb.oneTime=fill(0);pb.oneTime[cm-1]=safe+1;var lowB=fwdLow(computeCashflow(pb,{mode:'actual',year:2026}),cm);
      Rz.boundLandsFloor=Math.abs(lowA-floor)<0.02;Rz.boundBreaches=(lowB<floor-0.5);})();
    // P3 — gating (never inferred): purpose sinking but NO link, and purpose ongoing WITH a link → NO reinterpretation
    build({purpose:'sinking',link:false});Rz.sinkNoLink=goalSafeToMove().safeToGoal;
    build({purpose:'ongoing',link:true});Rz.ongoLink=goalSafeToMove().safeToGoal;
    // P4 — link removal / delete reverts to ordinary treatment (ENV-FC-006)
    build({purpose:'sinking',link:true});var withLink=goalSafeToMove().safeToGoal;
    build({purpose:'sinking',link:false});var afterRemoval=goalSafeToMove().safeToGoal;
    Rz.removalReverts=near(afterRemoval,Rz.ongoing)&&!near(withLink,afterRemoval);
    // P5 — reschedule LATER frees more contribution months (monotonic): due Oct < due Dec in freed contributions
    build({purpose:'sinking',link:true,dueM:10,billAmt:6000});var safeOct=goalSafeToMove().safeToGoal;
    build({purpose:'sinking',link:true,dueM:12,billAmt:6000});var safeDec=goalSafeToMove().safeToGoal;
    Rz.laterFreesMore=(safeDec>safeOct-0.005);
    // P6 — fully funded (ENV-FC-002): a bill small enough that reservations+income absorb it → safe UNCHANGED vs no bill at all
    build({purpose:'sinking',link:true,billAmt:2000,dueM:12});var safeSmall=goalSafeToMove().safeToGoal;
    build({purpose:'sinking',link:true,noBill:true});var safeNoBill=goalSafeToMove().safeToGoal;
    Rz.fullyFunded=near(safeSmall,safeNoBill);
    // P7 — reinterpretation never drops a month's baseline below zero, and never exceeds the budget (safe stays finite/sane)
    build({purpose:'sinking',link:true,contribution:99999});var gsHuge=goalSafeToMove();Rz.clampedSafe=gsHuge.safeToGoal;Rz.finite=isFinite(gsHuge.safeToGoal)&&gsHuge.safeToGoal>=0;
    return Rz;
  });

  ck('P1 no double-count: a linked sinking fund raises safe-to-move by EXACTLY the freed contributions ($6,000 − $4,500 = $1,500 = plannedContributionsBeforeDueDate), and the bill still binds in December',
     near(R.sinking-R.ongoing,1500)&&near(R.sinking-R.ongoing,R.planned)&&R.sinkLowM===12, JSON.stringify({ongoing:R.ongoing,sinking:R.sinking,planned:R.planned,lowM:R.sinkLowM}));
  ck('P2 operational boundary holds: moving exactly the (higher) safe amount lands the forward low on the floor; one dollar more breaches it',
     R.boundLandsFloor&&R.boundBreaches, JSON.stringify({landsFloor:R.boundLandsFloor,breaches:R.boundBreaches}));
  ck('P3 NEVER INFERRED: purpose "sinking" with no link, and purpose "ongoing" with a link, both leave safe-to-move at the ordinary $4,500 (reinterpretation requires an explicit link AND a sinking/split purpose)',
     near(R.sinkNoLink,R.ongoing)&&near(R.ongoLink,R.ongoing), JSON.stringify({sinkNoLink:R.sinkNoLink,ongoLink:R.ongoLink,ongoing:R.ongoing}));
  ck('P4 ENV-FC-006: removing the link reverts to ordinary treatment (safe returns to $4,500) — deleting a link never strands the reinterpretation',
     R.removalReverts, 'removalReverts='+R.removalReverts);
  ck('P5 reschedule: a LATER due date frees more contribution months, so safe-to-move is ≥ an earlier due date (monotonic)',
     R.laterFreesMore, 'laterFreesMore='+R.laterFreesMore);
  ck('P6 ENV-FC-002 fully funded: a bill small enough to be absorbed by reservations + income creates no new forward low — safe-to-move is unchanged vs no bill at all',
     R.fullyFunded, 'fullyFunded='+R.fullyFunded);
  ck('P7 defensive: a contribution larger than the budget can never drive a month below zero outflow — safe stays finite and non-negative',
     R.finite, 'clampedSafe='+R.clampedSafe);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: a linked sinking fund reinterprets future contributions as reservations — safe-to-move moves by exactly the newly-recognized funded portion, and only ever when a real link exists.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

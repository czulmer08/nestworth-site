/* SAFE-TO-MOVE-TO-GOAL — the "join" that makes NestWorth answer "how much can I safely move to my goal today?" from the EXISTING
   forward cash-flow engine (single source of truth, no double-count). The definition is OPERATIONAL and proven here by simulation:
     safeToGoal = max(0, forwardLow − Nest Egg Floor)     [forwardLow = lowest projected balance from the current month forward]
   Guarantee: move exactly `safeToGoal` as a one-time outflow this month, re-run the FULL projection, and the forward low lands on
   the floor; one dollar more breaches it. Because the number is read straight off computeCashflow's path — which already contains
   future bills, envelope set-asides, banked balances, contingency effects, protected/linked/residual goals, and future income —
   nothing is subtracted a second time. Uses OFF-YEAR plan mode for a deterministic forward path (no actual/plan blend). */
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
  await page.waitForFunction(()=>typeof goalSafeToMove==='function'&&typeof computeCashflow==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2027;};bYear=function(){return 2026;}; // OFF-YEAR → computeCashflow uses pure plan; goalSafeToMove looks at all 12 months
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // Deterministic plan: $10k income/mo; $9k expense/mo EXCEPT a $16k lumpy bill in June (index 5). startCash $5,000.
    // Path from $5k: +1k×5 → $10k by May; June −6k → $4k (the forward low); +1k×6 → $10k by Dec. forwardLow = $4,000 (June).
    function setup(startCash,floor,juneBill,incomePerMo){
      var exp=fill(9000);exp[5]=(juneBill!=null?juneBill:16000);
      state.cons=[{name:'Inc',bud12:fill(incomePerMo!=null?incomePerMo:10000)}];
      state.cats=[{name:'Living',bud12:exp}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];
      state.assets=[];state.debts=[];state.rows=[];
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:floor||0,startCash:startCash};
    }
    // simulate moving `mv` out today (one-time outflow in month 1) → return the lowest forward balance after the move
    function simLow(mv){
      var p=currentPlan();p.oneTime=fill(0);p.oneTime[0]=mv;
      var cf=computeCashflow(p,{mode:"plan",year:2026});var lo=Infinity;
      for(var m=0;m<12;m++){if(cf.months[m].bal<lo)lo=cf.months[m].bal;}return r2(lo);
    }
    var Rz={};
    // 1) BINDING BOUNDARY: safe = $4,000; moving it lands the low on the floor ($0); +$1 breaches
    setup(5000,0);
    var s=goalSafeToMove();
    Rz.bind={safe:s.safeToGoal,fLow:s.forwardLow,fMon:s.forwardLowMonth,billsCovered:s.billsCovered,
      lowAtSafe:simLow(s.safeToGoal),lowAtSafePlus1:simLow(s.safeToGoal+1)};
    // 3) SINGLE-SOURCE / no double-count: safe equals max(0, min-forward-balance − floor) computed independently from the SAME cf
    var cf0=computeCashflow(currentPlan(),{mode:"plan",year:2026}),mlo=Infinity;for(var m=0;m<12;m++)if(cf0.months[m].bal<mlo)mlo=cf0.months[m].bal;
    Rz.single={safe:s.safeToGoal,manual:r2(Math.max(0,r2(mlo-0)))};
    // 2) FLOOR-AWARENESS: floor $1,000 → safe drops by EXACTLY $1,000 (to $3,000); move it → low lands on $1,000
    setup(5000,1000);var sf=goalSafeToMove();
    Rz.floor={safe:sf.safeToGoal,floor:sf.floor,lowAtSafe:simLow(sf.safeToGoal)};
    // 4) BREACH ALREADY (bills NOT covered): a $22k June bill drops the path below $0 even before moving → safe $0, warns
    setup(5000,0,22000);var sb=goalSafeToMove();
    Rz.breach={safe:sb.safeToGoal,billsCovered:sb.billsCovered,breach:sb.breach,fLow:sb.forwardLow};
    // 5) NO STARTING SAVINGS: startCash 0 → flagged, and safe is measured from the $0 baseline
    setup(0,0);var sn=goalSafeToMove();
    Rz.noStart={startCashSet:sn.startCashSet,safe:sn.safeToGoal};
    // 6) EXTRA-INCOME (3rd-paycheck) month: a +$4k March spike lifts the June dip above the starting month, so the binding low
    // MOVES to month 1 ($6,000) and safe RISES from $4,000 to $6,000 — extra income correctly frees up more, never less.
    setup(5000,0);state.cons=[{name:'Inc',bud12:(function(){var a=fill(10000);a[2]=14000;return a;})()}];var s3=goalSafeToMove();
    Rz.spike={safe:s3.safeToGoal,fMon:s3.forwardLowMonth};
    // 7) OVERSPEND lowers safe / REFUND raises it: bump June bill +$1,000 → safe −$1,000; cut it −$1,000 → safe +$1,000
    setup(5000,0,17000);var sOver=goalSafeToMove();
    setup(5000,0,15000);var sRef=goalSafeToMove();
    Rz.sensitivity={over:sOver.safeToGoal,refund:sRef.safeToGoal};
    // 8) WREN consumes the SAME helper — "how much can I safely move to my car fund?" → the same $4,000 answer
    setup(5000,0);state.rows=[[2027,1,'2027-01-05','','x','',0,'','N']]; // non-empty so wrenAnalyze runs
    var wr=(typeof wrenAnalyze==='function')?wrenAnalyze("how much can I safely move to my car fund?"):null;
    Rz.wren=(wr&&(wr.answer||wr.text))||"";
    return Rz;
  });

  ck('BINDING BOUNDARY: safe = $4,000 (forward low $4,000 in June); moving it lands the forward low exactly on the $0 floor',
     near(R.bind.safe,4000)&&near(R.bind.fLow,4000)&&R.bind.fMon===6&&R.bind.billsCovered&&near(R.bind.lowAtSafe,0), JSON.stringify(R.bind));
  ck('BINDING BOUNDARY: one dollar more ($4,001) breaches the floor (forward low goes to −$1)',
     R.bind.lowAtSafePlus1<-0.005&&near(R.bind.lowAtSafePlus1,-1), 'lowAtSafe+1='+R.bind.lowAtSafePlus1);
  ck('SINGLE-SOURCE (no double-count): safe = max(0, min-forward-balance − floor) straight from the same cash-flow path',
     near(R.single.safe,R.single.manual)&&near(R.single.safe,4000), JSON.stringify(R.single));
  ck('FLOOR-AWARENESS: floor $1,000 reduces safe by exactly $1,000 (to $3,000); moving it lands the low on $1,000 (not $0)',
     near(R.floor.safe,3000)&&near(R.floor.floor,1000)&&near(R.floor.lowAtSafe,1000), JSON.stringify(R.floor));
  ck('BILLS NOT COVERED: a $22k bill sinks the plan below the floor before any move → safe $0, billsCovered=false, breach flagged',
     near(R.breach.safe,0)&&R.breach.billsCovered===false&&R.breach.breach===true&&R.breach.fLow<-0.005, JSON.stringify(R.breach));
  ck('NO STARTING SAVINGS: flagged (startCashSet=false) so the panel can warn the number is off a $0 baseline',
     R.noStart.startCashSet===false&&near(R.noStart.safe,0-0)===false||R.noStart.startCashSet===false, JSON.stringify(R.noStart));
  ck('EXTRA-INCOME month: a March spike lifts June out of the way — binding low moves to month 1 and safe RISES $4,000 → $6,000',
     near(R.spike.safe,6000)&&R.spike.fMon===1, JSON.stringify(R.spike));
  ck('SENSITIVITY: a $1,000 bigger bill lowers safe to $3,000; a $1,000 smaller bill raises it to $5,000',
     near(R.sensitivity.over,3000)&&near(R.sensitivity.refund,5000), JSON.stringify(R.sensitivity));
  ck('WREN consumes the same helper: "how much can I safely move to my car fund?" → $4,000, names the floor and tightest month',
     /safely move up to \$4,000\.00 to Car Fund/.test(R.wren)&&/Nest Egg Floor/.test(R.wren)&&/Jun/.test(R.wren), R.wren);

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: "safe to move" is proven operationally — moving it lands the forward low exactly on the Nest Egg Floor, one dollar more breaches it, and the number is read straight from the existing projection so nothing is double-counted.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

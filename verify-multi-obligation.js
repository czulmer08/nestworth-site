/* MULTI-OBLIGATION SINKING FUNDS (v0.68.47) — one envelope funding several future bills. Proves the ENV-FC allocation rules
   (004: no banked dollar funds two bills; 005: an earlier bill consumes part of the fund, a later one sees only the remainder),
   the generalized forecast engine (every bill lands at full at its OWN due month; a month's contribution is freed only while the
   fund is still saving toward a LATER bill and the month isn't itself a due month; no double-count), and single-bill back-compat. */
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
  await page.waitForFunction(()=>typeof sinkingAllocation==='function'&&typeof catObligations==='function'&&typeof goalSafeToMove==='function'&&typeof _cfFutureOut==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};todayISO=function(){return '2026-09-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    var TIRES={id:'t1',name:'Tires',amount:900,dueYear:2026,dueMonth:11,source:'row'};
    var SERVICE={id:'s1',name:'Service',amount:1200,dueYear:2026,dueMonth:12,source:'row'};
    function build(opt){opt=opt||{};
      var rr=[];for(var mo=1;mo<=8;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-03','Pay','Deposit','',500,'','']);
      if(opt.bills!==false){rr.push([2026,11,'2026-11-15','','Car Maintenance','Shop',900,'','']);rr.push([2026,12,'2026-12-15','','Car Maintenance','Shop',1200,'','']);}
      state.cons=[{name:'Inc',bud12:fill(500),annual:6000}];state.cats=[{name:'Car Maintenance',bud12:fill(500),annual:6000}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=rr;
      var cfg={roll:'envelope'};if(opt.contribution!=null)cfg.contribution=opt.contribution;if(opt.purpose)cfg.purpose=opt.purpose;if(opt.sinking)cfg.sinking=opt.sinking;
      state.meta={cats:{"car maintenance":cfg},cons:{},goals:[],payees:['Pay'],floor:0,startCash:opt.startCash!=null?opt.startCash:10000};
      window.__SPEND["car maintenance"]=opt.spend||[500,500,500,500,500,0,0,0,0,0,0,0]; // banks toward the bills
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    // ENV-FC-004 — allocation: banked $1,000 (via spend history) + $500/mo → both bills funded, distinct, leftover accounted, no double
    build({purpose:'sinking',contribution:500,spend:[500,500,500,500,500,0,0,0,0,0,0,0],sinking:{obligations:[TIRES,SERVICE]}});
    var a4=sinkingAllocation('Car Maintenance');
    Rz.a4={banked:a4.banked,perMonth:a4.perMonth,obs:a4.obligations.map(function(o){return {name:o.name,funded:o.funded,remaining:o.remaining};}),leftover:a4.leftover,
      sumFunded:a4.obligations.reduce(function(s,o){return s+o.funded;},0),order:a4.obligations.map(function(o){return o.dueMonth;})};
    // ENV-FC-005 — earlier bill consumes part, later sees the remainder: banked exactly $500 (Jan–Jul fully spent, Aug $0), NO future contributions
    build({purpose:'sinking',contribution:0,spend:[500,500,500,500,500,500,500,0,0,0,0,0],sinking:{obligations:[TIRES,SERVICE]}});
    var a5=sinkingAllocation('Car Maintenance');
    Rz.a5={banked:a5.banked,tires:a5.obligations[0],service:a5.obligations[1]};
    // ENGINE — freed contributions = the SAVING months only (Sep,Oct); Nov (Tires due) & Dec (Service due) are NOT freed
    build({purpose:'ongoing',contribution:500,sinking:{obligations:[TIRES,SERVICE]}});var safeOng=goalSafeToMove().safeToGoal;
    build({purpose:'sinking',contribution:500,sinking:{obligations:[TIRES,SERVICE]}});var gsS=goalSafeToMove();Rz.safeSink=gsS.safeToGoal;Rz.safeOng=safeOng;Rz.lowM=gsS.forwardLowMonth;
    // each bill lands at FULL at its own due month (Nov=$900, Dec=$1,200) — no contribution understates the bill
    var plan=currentPlan(),catExp=_cfCatExp(plan,2026),planGh=Number(plan.goalMonthlyFixed)||0;
    Rz.novOut=_cfFutureOut(plan,catExp,10,planGh).out; Rz.decOut=_cfFutureOut(plan,catExp,11,planGh).out;
    Rz.octOut=_cfFutureOut(plan,catExp,9,planGh).out; // a pure SAVING month → contribution freed → $0
    // BACK-COMPAT — a single obligation expressed as obligations:[one] equals the legacy obligation:{} single form
    build({purpose:'sinking',contribution:500,bills:false,sinking:{obligations:[SERVICE]}});
    state.rows.push([2026,12,'2026-12-15','','Car Maintenance','Shop',1200,'','']);if(typeof buildIndexes==='function')buildIndexes();
    var safeArr=goalSafeToMove().safeToGoal;
    build({purpose:'sinking',contribution:500,bills:false,sinking:{obligation:SERVICE}});
    state.rows.push([2026,12,'2026-12-15','','Car Maintenance','Shop',1200,'','']);if(typeof buildIndexes==='function')buildIndexes();
    var safeSingle=goalSafeToMove().safeToGoal;
    Rz.backcompat=near(safeArr,safeSingle);
    // checkupAddObligation — single link → add a second → catObligations returns BOTH, earliest-due-first
    build({purpose:'sinking',contribution:500,sinking:{obligation:TIRES}});
    checkupAddObligation('Car Maintenance',SERVICE);
    var obs=catObligations('Car Maintenance');
    Rz.added={n:obs.length,order:obs.map(function(o){return o.dueMonth;}),names:obs.map(function(o){return o.name;})};
    return Rz;
  });

  ck('ENV-FC-004: two bills sharing one envelope are each funded once — Tires $900 and Service $1,200 both covered, allocated earliest-due-first, nothing double-counted',
     R.a4.obs.length===2&&near(R.a4.obs[0].funded,900)&&near(R.a4.obs[1].funded,1200)&&near(R.a4.sumFunded,2100)&&JSON.stringify(R.a4.order)==='[11,12]', JSON.stringify(R.a4));
  ck('ENV-FC-004: no banked dollar funds two bills — total funded ($2,100) never exceeds banked + contributions, and the leftover is accounted',
     R.a4.sumFunded<=R.a4.banked+R.a4.perMonth*4+0.02&&R.a4.leftover>=-0.02, JSON.stringify({sumFunded:R.a4.sumFunded,banked:R.a4.banked,per:R.a4.perMonth,leftover:R.a4.leftover}));
  ck('ENV-FC-005: an earlier bill consumes part of the fund and a later bill sees only the remainder — $500 banked → Tires funded $500 (short $400), Service funded $0',
     near(R.a5.tires.funded,500)&&near(R.a5.tires.remaining,400)&&near(R.a5.service.funded,0)&&near(R.a5.service.remaining,1200), JSON.stringify(R.a5));
  ck('ENGINE: a multi-bill sinking fund raises safe-to-move by exactly the SAVING-months contributions (Sep + Oct = $1,000); the due months (Nov, Dec) are not freed',
     near(R.safeSink-R.safeOng,1000)&&R.lowM===12, JSON.stringify({sink:R.safeSink,ong:R.safeOng,diff:R.safeSink-R.safeOng,lowM:R.lowM}));
  ck('ENGINE: every bill lands at FULL at its own due month — Nov outflow $900 (Tires), Dec outflow $1,200 (Service); a pure saving month (Oct) frees the contribution → $0',
     near(R.novOut,900)&&near(R.decOut,1200)&&near(R.octOut,0), JSON.stringify({nov:R.novOut,dec:R.decOut,oct:R.octOut}));
  ck('BACK-COMPAT: a single obligation written as obligations:[one] gives the identical safe-to-move as the legacy obligation:{} form',
     R.backcompat, 'backcompat='+R.backcompat);
  ck('checkupAddObligation converts a single link to multi: both bills present, sorted earliest-due-first (Nov then Dec)',
     R.added.n===2&&JSON.stringify(R.added.order)==='[11,12]'&&R.added.names[0]==='Tires', JSON.stringify(R.added));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: one envelope funds several bills — each dollar to at most one bill, every bill at full on its due date, no double-count.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

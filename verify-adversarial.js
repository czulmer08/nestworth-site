/* ADVERSARIAL suite — deliberately hostile household scenarios that try to BREAK the consolidated engine and expose any
   remaining cross-surface disagreement or crash. Refunds > spend, linked goals, mid-year adoption, negative envelopes,
   3-paycheck months, unbudgeted spend, overdue goals, future-dated entries, empty state, goal/category name collisions. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof monthActualTotals==='function'&&typeof computeCashflow==='function'&&typeof evaluateDecision==='function'&&typeof buildNestReview==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var R=[];function ok(n,v,d){R.push({n:n,ok:!!v,d:d||''});}
    // deterministic clock + as-of, so date-sensitive assertions don't drift
    curYear=function(){return 2026;};curMonth=function(){return 8;};bYear=function(){return 2026;};
    todayISO=function(){return '2026-08-15';};
    var row=function(y,m,d,who,cat,co,amt){return [y,m,d,who,cat,co,amt,'','N'];};
    function reset(){state.meta={startCash:0,floor:0,cats:{},cons:{},goals:[]};state.cons=[];state.cats=[];state.goals=[];state.goalSet={};state.assets=[];state.debts=[];state.rows=[];state.carryIn={};state.spend={};state.dep={};}

    // A) Refund exceeds spend → net-negative category, everywhere
    reset();state.rows=[row(2026,8,'2026-08-05','','Food','Store',100),row(2026,8,'2026-08-06','','Food','Store',-300)];
    state.cats=[{name:'Food',bud12:Array(12).fill(200)}];try{buildIndexes();}catch(e){}
    var mtA=monthActualTotals(2026,8);
    ok('A refund>spend: net expense = −$200 (credit nets down)',Math.abs(mtA.expense+200)<0.01,JSON.stringify(mtA));
    ok('A catSpend12 Food = −$200 (matches)',Math.abs((catSpend12('Food')[7]||0)+200)<0.01);

    // B) Overdue goal → 0 funding periods, no crash rendering
    reset();state.goals=[{name:'Trip',target:5000,balance:2000,monthly:300,targetDate:'2026-06',archived:false,category:'',residual:false}];
    ok('B overdue goalFundMonths = 0 (target date passed)',goalFundMonths('2026-06')===0);
    var goalCrash=false;try{show('appScreen');state.meta.goals=state.goals.slice();loadGoals&&loadGoals();renderGoals();}catch(e){goalCrash=true;}
    ok('B renderGoals does not crash on an overdue goal',!goalCrash);

    // C) Mid-year adopter year-end projection = active-month avg, not YTD÷fraction
    reset();state.rows=[row(2026,8,'2026-08-01','','Food','X',3000)];state.cats=[{name:'Food',bud12:Array(12).fill(0)}];try{buildIndexes();}catch(e){}
    var yp=yearEndSpendProjection();
    ok('C mid-year projection = $3,000 + $3,000×4 = $15,000 (not ÷ fraction)',yp.proj===15000,JSON.stringify(yp));

    // D) Three-paycheck month (biweekly real payday calendar)
    reset();var pc=paydaysPerMonth('2026-01-02',14,2026);
    ok('D biweekly year has 26 checks and two 3-check months',pc.reduce(function(a,b){return a+b;},0)===26&&pc.filter(function(v){return v===3;}).length===2,JSON.stringify(pc));
    var bwCal=monthsFor({type:'biweekly',amount:1000,calendar:true,payAnchor:'2026-01-02'});
    ok('D a 3-paycheck month budgets $3,000 while a 2-paycheck month budgets $2,000',bwCal.some(function(v){return v===3000;})&&bwCal.some(function(v){return v===2000;}));

    // E) Negative envelope (overspent past months eat the cushion)
    reset();curMonth=function(){return 4;}; // April, so Jan–Mar are completed
    state.meta.startYM=202601;state.carryIn={};
    state.meta.cats={fun:{type:'itemized',roll:'envelope',items:[]}}; // envelope
    var funCat={name:'Fun',bud12:Array(12).fill(100)};
    state.rows=[row(2026,1,'2026-01-10','','Fun','X',400),row(2026,2,'2026-02-10','','Fun','X',50),row(2026,3,'2026-03-10','','Fun','X',50)]; // Jan overspends by 300
    try{buildIndexes();}catch(e){}
    var funBal=catBalance(funCat); // carry 0 + (100-400)+(100-50)+(100-50) = -300+50+50 = -200
    ok('E overspent envelope goes negative (−$200), not floored',Math.abs(funBal+200)<0.5,JSON.stringify(funBal));
    curMonth=function(){return 8;};

    // F) Unbudgeted spending shows in Month, cash flow AND Nest Review
    reset();curMonth=function(){return 8;};
    state.rows=[row(2026,7,'2026-07-01','','Deposit','Job',5000),row(2026,7,'2026-07-02','','','IKEA',450),row(2026,8,'2026-08-01','','Deposit','Job',5000),row(2026,8,'2026-08-02','','','IKEA',450)];
    state.cons=[{name:'Job',bud12:Array(12).fill(5000)}];state.cats=[{name:'Living',bud12:Array(12).fill(0)}];try{buildIndexes();}catch(e){}
    var mtF=monthActualTotals(2026,8),rvF=buildNestReview();
    ok('F unbudgeted $450 counts in Month totals',Math.abs(mtF.expense-450)<0.5,JSON.stringify(mtF));
    ok('F unbudgeted $450 counts in the Nest Review (July)',rvF&&Math.abs(rvF.spending.actual-450)<0.5,JSON.stringify(rvF&&rvF.spending));

    // G) Linked goal (Category=real cat, Company=goal): excluded from category spend, counted as a goal move once
    reset();state.goalSet={vacation:1};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='vacation';};
    state.rows=[row(2026,8,'2026-08-01','','Deposit','Job',2000),row(2026,8,'2026-08-06','','Living','Vacation',500)];
    state.cons=[{name:'Job',bud12:Array(12).fill(2000)}];state.cats=[{name:'Living',bud12:Array(12).fill(500)}];
    state.goals=[{name:'Vacation',monthly:500,balance:500,target:5000,category:'Living',residual:false,archived:false}];try{buildIndexes();}catch(e){}
    ok('G linked-goal move is NOT in Living category spend',Math.abs(catSpend12('Living')[7]||0)<0.01,JSON.stringify(catSpend12('Living')[7]));
    ok('G it IS found as a Vacation contribution',Math.abs(goalContribMonth('Vacation',2026,8)-500)<0.5);
    var cfG=computeCashflow(currentPlan(),{mode:'actual'});
    ok('G cash flow counts the $500 once (net = 2000−500 = 1500)',Math.abs(cfG.months[7].net-1500)<0.5,JSON.stringify(cfG.months[7].net));

    // H) Future-dated current-month entry excluded by the as-of cutoff
    reset();state.rows=[row(2026,8,'2026-08-10','','Food','X',100),row(2026,8,'2026-08-20','','Food','X',999)]; // 08-20 is after as-of 08-15
    state.cats=[{name:'Food',bud12:Array(12).fill(0)}];try{buildIndexes();}catch(e){}
    var mtH=monthActualTotals(2026,8);
    ok('H future-dated (Aug 20 > as-of Aug 15) entry excluded from actuals',Math.abs(mtH.expense-100)<0.5,JSON.stringify(mtH));

    // I) Totally empty state does not crash any engine or render
    reset();window.isGoalName=function(){return false;};
    var emptyCrash=false;try{monthActualTotals(2026,8);computeCashflow(currentPlan(),{mode:'actual'});planMetrics(currentPlan());netWorthNow();yearEndSpendProjection();buildNestReview();evaluateDecision({type:'expenseMonthly',amount:100});show('appScreen');renderMonth();renderStress();renderFeas();}catch(e){emptyCrash=true;R.push({n:'I empty-state error',ok:false,d:(e.message||e)});}
    ok('I empty state (no rows/cats/goals) crashes nothing',!emptyCrash);

    // J) Zero-budget category with real spend is flagged over budget
    reset();state.rows=[row(2026,8,'2026-08-01','','Misc','X',80)];state.cats=[{name:'Misc',bud12:Array(12).fill(0),mbud:0,mspent:80}];try{buildIndexes();}catch(e){}
    ok('J zero-budget category with $80 spent is over by $80',Math.abs((catSpend12('Misc')[7]||0)-80)<0.5);

    // K) A category literally named like a goal is treated as a goal movement (name collision) — not double counted as spend
    reset();state.goalSet={savings:1};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='savings';};
    state.rows=[row(2026,8,'2026-08-01','','Savings','',300)];state.cats=[{name:'Living',bud12:Array(12).fill(0)}];try{buildIndexes();}catch(e){}
    var mtK=monthActualTotals(2026,8);
    ok('K a goal-named row is not counted as spending',Math.abs(mtK.expense)<0.01,JSON.stringify(mtK));

    // L) Reimbursable expense (col I = 'Y') — counted as spending consistently (you paid it; the refund arrives later as a credit)
    reset();var rr=row(2026,8,'2026-08-01','','Work','Airline',600);rr[8]='Y';state.rows=[rr];state.cats=[{name:'Work',bud12:Array(12).fill(0)}];try{buildIndexes();}catch(e){}
    var mtL=monthActualTotals(2026,8);
    ok('L reimbursable expense is counted as spend ($600) like any expense',Math.abs(mtL.expense-600)<0.5,JSON.stringify(mtL));

    // M) Net worth anti-double-count: an account-linked goal is inside its asset, not added on top
    reset();state.assets=[{name:'Cash',bal:10000}];state.debts=[{name:'Loan',bal:3000}];
    state.goals=[{name:'EF',balance:8000,account:'Cash',archived:false},{name:'Trip',balance:1000,account:'',archived:false}];
    ok('M net worth = 10000 − 3000 + 1000 standalone (linked $8,000 not double-added) = $8,000',netWorthNow()===8000,JSON.stringify(netWorthNow()));

    // O) A goal due next January (Dec→Jan boundary), today Aug 2026 → 6 inclusive funding periods, not overdue
    reset();ok('O goal due Jan-2027 has 6 funding periods (Aug→Jan inclusive)',goalFundMonths('2027-01')===6,String(goalFundMonths('2027-01')));

    // P) Precision: an odd total split across 7 months still re-sums to the exact cent
    reset();var sp=monthsFor({type:'split',amount:100000000.01,cover:[1,1,1,1,1,1,1,0,0,0,0,0]});
    ok('P huge/odd split re-sums to the exact total',Math.round(sp.reduce(function(a,b){return a+b;},0)*100)/100===100000000.01,JSON.stringify(sp.reduce(function(a,b){return a+b;},0)));

    // Q) Leap-year biweekly payday calendar (2028, Feb 29) still yields 26 checks
    reset();var pcl=paydaysPerMonth('2028-01-07',14,2028);
    ok('Q leap-year (2028) biweekly still has 26 checks',pcl.reduce(function(a,b){return a+b;},0)===26,JSON.stringify(pcl.reduce(function(a,b){return a+b;},0)));

    // R) TWO goals linked to one category — both contributions leave cash once, both excluded from that category's spend
    reset();state.goalSet={vacation:1,car:1};window.isGoalName=function(n){var s=(""+n).trim().toLowerCase();return s==='vacation'||s==='car';};
    state.rows=[row(2026,8,'2026-08-01','','Deposit','Job',3000),row(2026,8,'2026-08-05','','Living','Vacation',400),row(2026,8,'2026-08-06','','Living','Car',300)];
    state.cons=[{name:'Job',bud12:Array(12).fill(3000)}];state.cats=[{name:'Living',bud12:Array(12).fill(700)}];
    state.goals=[{name:'Vacation',monthly:400,balance:0,category:'Living',archived:false,residual:false},{name:'Car',monthly:300,balance:0,category:'Living',archived:false,residual:false}];try{buildIndexes();}catch(e){}
    ok('R two linked goals: neither is in category spend',Math.abs(catSpend12('Living')[7]||0)<0.01);
    var cfR=computeCashflow(currentPlan(),{mode:'actual'});
    ok('R cash flow subtracts both once (3000 − 400 − 300 = 2300)',Math.abs(cfR.months[7].net-2300)<0.5,JSON.stringify(cfR.months[7].net));

    // S) Negative deposit (a clawback / reversed paycheck) reduces income, not spending
    reset();window.isGoalName=function(){return false;};state.rows=[row(2026,8,'2026-08-01','','Deposit','Job',-500),row(2026,8,'2026-08-02','','Food','X',100)];
    var mtS=monthActualTotals(2026,8);
    ok('S negative deposit reduces income (−$500) and is not spending',Math.abs(mtS.income+500)<0.5&&Math.abs(mtS.expense-100)<0.5,JSON.stringify(mtS));

    // T) Decision batch with FOUR conflicting changes at once still reruns coherently (no NaN / crash)
    reset();state.meta={startCash:5000,floor:0,cats:{},cons:{},goals:[]};
    state.cons=[{name:'Job',bud12:Array(12).fill(5000)}];state.cats=[{name:'Living',bud12:Array(12).fill(3000)}];
    state.goals=[{name:'Reno',monthly:500,balance:1000,target:9000,category:'',residual:false,archived:false}];state.goalSet={reno:1};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='reno';};
    state.assets=[{name:'Checking',bal:5000}];state.debts=[];state.rows=[];
    var batch=evaluateDecision([{type:'expenseMonthly',amount:800},{type:'income',amount:-600},{type:'goalMonthly',goal:'Reno',monthly:900},{type:'purchase',amount:2000,month:12}]);
    ok('T a 4-way conflicting batch returns finite numbers (no NaN)',batch&&isFinite(batch.after.surplus)&&isFinite(batch.after.low)&&isFinite(batch.after.netEnd)&&isFinite(batch.after.end),JSON.stringify(batch&&batch.after));

    return {R,errs:[]};
  });

  res.R.forEach(function(r){ck(r.n,r.ok,r.d);});
  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  PAGE ERRORS: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed'+(errs.length?(' ('+errs.length+' page errors)'):'')+'.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

/* STRANGER-HOUSEHOLD JOURNEYS. The author's household is one shape; a stranger's is many. This walks the OTHER BETA_STUDY
   households (H1, H3–H8), each loaded into the REAL engine, and asserts the household's SIGNATURE behavior plus the oracle
   "what the engine computes actually appears on the surface the user reads." (H2, the biweekly household with the write-path
   3-way oracle, is verify-new-user-journey.js.) SCOPE: single-client, loaded-state + engine + render — deep contingency and
   residual math also have their own dedicated suites; this checks the household-level outcome and its visibility. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const src=fs.readFileSync(APP,'utf8');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(src);return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof monthActualTotals==='function'&&typeof netWorthNow==='function'&&typeof computeResidual==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});
  const near=(a,b)=>Math.abs((a||0)-(b||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    window.catBills=function(){return [];};window.topCats=function(){return [];};
    var near=function(a,b){return Math.abs((a||0)-(b||0))<0.02;};
    var Rz={};
    function clean(){state.rows=[];state.cats=[];state.cons=[];state.goals=[];state.assets=[];state.debts=[];state.meta={cats:{},cons:{},goals:[],payees:['Me']};window.isGoalName=function(x){return (state.goals||[]).some(function(g){return g&&g.name&&g.name.toLowerCase()===(""+x).trim().toLowerCase();});};}
    function idx(){try{buildIndexes&&buildIndexes();}catch(e){}try{applyBudgetSpend&&applyBudgetSpend();}catch(e){}try{loadGoals&&loadGoals();}catch(e){}}
    function shows(v){try{show('appScreen');}catch(e){}['renderCatTbl','renderMonth','renderWorth','renderRecent'].forEach(function(fn){try{window[fn]&&window[fn]();}catch(e){}});var t=(document.body.textContent||'');return t.indexOf(money(v))>=0||t.indexOf(money(Math.abs(v)))>=0||t.replace(/[,$]/g,'').indexOf((''+Math.abs(v)))>=0;}
    function renderNoThrow(){var ok=true;['renderCatTbl','renderMonth','renderWorth','renderGoals','renderRecent'].forEach(function(fn){try{show('appScreen');window[fn]&&window[fn]();}catch(e){ok=false;}});return ok;}

    // ---- H1 salaried couple (baseline): income & spend sum correctly; a category's "left" is right ----
    clean();
    state.cons=[{name:'Alex'},{name:'Sam'}];
    state.cats=[{name:'Groceries',mbud:600,bud12:[600,600,600,600,600,600,600,600,600,600,600,600]},{name:'Rent',mbud:2000,bud12:[2000,2000,2000,2000,2000,2000,2000,2000,2000,2000,2000,2000]}];
    state.meta.cats={groceries:{type:'monthly',amount:600},rent:{type:'monthly',amount:2000}};
    state.rows=[[2026,8,'2026-08-01','Alex','Deposit','',3000,'',''],[2026,8,'2026-08-01','Sam','Deposit','',2500,'',''],
      [2026,8,'2026-08-03','','Groceries','Publix',420,'',''],[2026,8,'2026-08-05','','Rent','LL',2000,'','']];
    idx();var h1=monthActualTotals(2026,8);
    Rz.h1={income:r2(h1.income),expense:r2(h1.expense),sees:shows(420)}; // the Groceries spend is shown in the budget table

    // ---- H3 hourly / variable income: each month shows its OWN income, not an average; a future check is excluded ----
    clean();state.cons=[{name:'Jamie'}];
    state.rows=[[2026,7,'2026-07-10','Jamie','Deposit','',2800,'',''],[2026,8,'2026-08-10','Jamie','Deposit','',2100,'',''],[2026,9,'2026-09-10','Jamie','Deposit','',3400,'','']];
    idx();
    Rz.h3={aug:r2(monthActualTotals(2026,8).income),jul:r2(monthActualTotals(2026,7).income),augAsOfExcludesFuture:r2(monthActualTotals(2026,9,{asOf:'2026-08-15'}).income)};

    // ---- H4 single parent, tight cash flow: an over-budget category reads as OVER (negative "left"), and it's visible ----
    clean();state.cons=[{name:'Robin'}];
    state.cats=[{name:'Groceries',mbud:400,bud12:[400,400,400,400,400,400,400,400,400,400,400,400]}];
    state.meta.cats={groceries:{type:'monthly',amount:400}};
    state.rows=[[2026,8,'2026-08-01','Robin','Deposit','',2200,'',''],[2026,8,'2026-08-03','','Groceries','Aldi',560,'','']]; // $160 over
    idx();var gc=(state.cats||[]).filter(function(c){return c.name==='Groceries';})[0]||{};
    var used=(typeof budUsed==='function')?budUsed(gc):(gc.mused!=null?gc.mused:gc.mspent);
    Rz.h4={spentOverBudget:r2(used)>400,left:r2((gc.mbud||0)-r2(used)),monthExpense:r2(monthActualTotals(2026,8).expense)};

    // ---- H5 high-income / high-debt: net worth reflects debts, and paying debt from an account leaves net worth UNCHANGED ----
    clean();
    state.assets=[{name:'Checking',bal:12000},{name:'Savings',bal:8000}];state.debts=[{name:'Car loan',bal:18000},{name:'Student loan',bal:30000}];
    idx();var nwBefore=r2(netWorthNow());
    // pay $1,000 off the car loan from savings
    state.assets[1].bal=7000;state.debts[0].bal=17000;var nwAfter=r2(netWorthNow());
    Rz.h5={nw:nwBefore,expected:20000-48000,unchangedByDebtPay:near(nwBefore,nwAfter),sees:shows(28000)};

    // ---- H6 heavy credit-card user: a refund NETS against spend; a reimbursed expense still counts until paid back ----
    clean();state.cons=[{name:'Casey'}];
    state.cats=[{name:'Groceries',mbud:500,bud12:[500,500,500,500,500,500,500,500,500,500,500,500]},{name:'Dining',mbud:200,bud12:[200,200,200,200,200,200,200,200,200,200,200,200]}];
    state.meta.cats={groceries:{type:'monthly',amount:500},dining:{type:'monthly',amount:200}};
    state.rows=[[2026,8,'2026-08-02','','Groceries','Costco',200,'','N'],[2026,8,'2026-08-04','','Dining','Bistro',100,'work lunch','Y'],[2026,8,'2026-08-06','','Groceries','Costco',-50,'refund','N']];
    idx();
    Rz.h6={expense:r2(monthActualTotals(2026,8).expense),reimbFlagRendered:(function(){try{return reimbTag([0,0,0,0,'Dining','Bistro',100,'','Y']).indexOf('reimbursed')>=0;}catch(e){return false;}})()};

    // ---- H7 goal-heavy saver (residual): the leftover pool splits across residual goals, never negative, cap respected ----
    clean();state.cons=[{name:'Pat',annual:60000,bud12:[5000,5000,5000,5000,5000,5000,5000,5000,5000,5000,5000,5000]}];
    state.cats=[{name:'Living',mbud:2000,annual:24000,bud12:[2000,2000,2000,2000,2000,2000,2000,2000,2000,2000,2000,2000]}];
    state.meta.cats={living:{type:'monthly',amount:2000}};
    state.rows=[[2026,8,'2026-08-01','Pat','Deposit','',5000,'','']]; // income $60k/yr, budget $24k/yr → ~$3,000/mo leftover pool
    var h7goals=[{name:'Vacation',target:5000,balance:500,residual:true,residualPct:50,residualCap:400},{name:'Car',target:12000,balance:1000,residual:true,residualPct:30},{name:'Emergency',target:3000,balance:0,residual:true,residualPct:20}];
    state.goals=h7goals;state.meta.goals=JSON.parse(JSON.stringify(h7goals)); // also in meta so loadGoals rebuilds them instead of wiping
    idx();if(!(state.goals||[]).length)state.goals=h7goals; // belt-and-suspenders if loadGoals didn't repopulate
    var pool=(typeof residualPool==='function')?r2(residualPool()):null;computeResidual();
    var rg=state.goals.filter(function(g){return g.residual;});
    var allNonNeg=rg.every(function(g){return (g._resMo||0)>=-0.005;});
    var vac=rg.filter(function(g){return g.name==='Vacation';})[0]||{};
    var sumMo=r2(rg.reduce(function(s,g){return s+(g._resMo||0);},0));
    Rz.h7={pool:pool,allNonNeg:allNonNeg,vacCappedAtOrUnder:(vac._resMo||0)<=400.005,sumWithinPool:(pool==null)||sumMo<=pool+0.02,someFunded:sumMo>0};

    // ---- H8 messy new user: uncategorized AND unbudgeted spending still COUNT; incomplete setup doesn't crash the app ----
    clean();
    state.cats=[{name:'Groceries',mbud:0,bud12:[0,0,0,0,0,0,0,0,0,0,0,0]}]; // one category, no budget set; no income at all
    state.meta.cats={};
    state.rows=[[2026,8,'2026-08-02','','','Corner Store',75,'',''],[2026,8,'2026-08-03','','Pets','Chewy',40,'',''],[2026,8,'2026-08-04','','Groceries','Aldi',60,'','']];
    idx();
    Rz.h8={expenseIncludesUncatAndUnbudgeted:r2(monthActualTotals(2026,8).expense),rendersWithoutCrash:renderNoThrow()};

    return Rz;
  });

  ck('H1 salaried couple: income $5,500 and spend $2,420 sum correctly and show', near(R.h1.income,5500)&&near(R.h1.expense,2420)&&R.h1.sees, JSON.stringify(R.h1));
  ck('H3 variable income: each month shows its OWN income (Aug $2,100, Jul $2,800), not an average', near(R.h3.aug,2100)&&near(R.h3.jul,2800), JSON.stringify(R.h3));
  ck('H3 variable income: a future paycheck is excluded by the as-of cutoff (not counted early)', near(R.h3.augAsOfExcludesFuture,0), JSON.stringify(R.h3));
  ck('H4 tight cash flow: a category spent over budget reads as OVER (negative "left")', R.h4.spentOverBudget&&R.h4.left<0&&near(R.h4.monthExpense,560), JSON.stringify(R.h4));
  ck('H5 high-debt: net worth reflects debts (−$28,000) and is unchanged by paying debt from an account', near(R.h5.nw,-28000)&&near(R.h5.nw,R.h5.expected)&&R.h5.unchangedByDebtPay&&R.h5.sees, JSON.stringify(R.h5));
  ck('H6 credit-card user: a $50 refund NETS spend to $250 (reimbursed row still counts, and is flagged)', near(R.h6.expense,250)&&R.h6.reimbFlagRendered, JSON.stringify(R.h6));
  ck('H7 goal-heavy: residual pool splits across goals — none negative, Vacation capped at $400, within the pool', R.h7.allNonNeg&&R.h7.vacCappedAtOrUnder&&R.h7.sumWithinPool&&R.h7.someFunded, JSON.stringify(R.h7));
  ck('H8 messy user: uncategorized ($75) + unbudgeted ($40) + budgeted ($60) all count = $175; incomplete setup does not crash', near(R.h8.expenseIncludesUncatAndUnbudgeted,175)&&R.h8.rendersWithoutCrash, JSON.stringify(R.h8));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,4).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  SCOPE: loaded-household engine + render behavior across BETA_STUDY households. Deep contingency/residual math also has dedicated suites; the human study is BETA_STUDY.md.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

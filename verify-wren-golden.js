/* WREN GOLDEN SUITE — semantic regression tests, hardened as a RELEASE-GRADE oracle.
   Design (unchanged): one fixed synthetic household; natural-language questions in paraphrase clusters; each answer graded on
   five dimensions (RETRIEVAL · CLASSIFICATION · COMPUTATION · INTERPRETATION · BOUNDARIES); permanent WREN-NNN cases.
   Harness rules enforced here (from the test-of-the-tests audit):
     1. NO FALSE-GREEN. If a description names an expected amount/date/entity/status/engine result, the assertion checks that
        EXACT authoritative fact. Semantic-regex fallbacks are used ONLY where there is no number to check (e.g. "declines to
        predict the market"). Financial Computation tests never accept "|| any dollar amount".
     2. FIXTURE ISOLATION. Fixture factories rebuild the household and RESTORE every monkey-patched core function; standalone
        questions reset the full Wren context; only Chain/Follow-up/Memory cases deliberately carry conversational state.
     3. PROVENANCE, not just invocation. Call-count spies prove Wren CALLED the engine; sentinel tests prove she USED the
        engine's returned value (stub an engine with unmistakable numbers, assert Wren echoes them, restore immediately). */
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
  await page.waitForFunction(()=>typeof wrenAnalyze==='function'&&typeof getGoalFacts==='function'&&typeof computeRollover==='function',{timeout:8000});

  const out=[]; // {id,dom,dim,n,ok,det}
  const ck=(id,dom,dim,n,ok,det)=>out.push({id,dom,dim,n,ok:!!ok,det:det||''});

  const res=await page.evaluate(()=>{
    // ---- deterministic clock ----
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    var row=function(y,m,d,who,cat,co,amt,desc){return [y,m,d,who,cat,co,amt,desc||'','N'];};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};

    // ---- capture PRISTINE originals of the core functions the contingency fixture pollutes ----
    var ORIG={catSpend12:catSpend12,catLinkedGoal12:catLinkedGoal12,adoptionFloor:adoptionFloor,rollStartFloor:rollStartFloor,carryInFor:carryInFor,isGoalName:window.isGoalName};

    function resetWrenContext(){wrenCtx={goal:null,cat:null,envelope:null,why:null,scenario:null};}

    // FIXTURE FACTORY: the fixed base household. Restores every core function first, so it always yields a clean household
    // regardless of any prior fixture's monkey-patching.
    function makeBaseHousehold(){
      catSpend12=ORIG.catSpend12;catLinkedGoal12=ORIG.catLinkedGoal12;adoptionFloor=ORIG.adoptionFloor;rollStartFloor=ORIG.rollStartFloor;carryInFor=ORIG.carryInFor;
      state.meta={startCash:5000,floor:2000,cats:{groceries:{type:"monthly"},mortgage:{type:"monthly"},travel:{type:"monthly"}},cons:{denzell:{type:"paycheck",freq:26,mode:"keepcheck",keepChk:1769.60,amount:3836.27,calendar:true,payAnchor:"2026-08-29"}},payees:["Me","Denzell"]};
      state.cons=[{name:"Denzell",annual:53733.42,mtarget:6200.01,mdep:6200.01,bud12:[4133.34,4133.34,4133.34,4133.34,4133.34,4133.34,4133.34,6200.01,4133.34,4133.34,4133.34,6200.01]}];
      state.cats=[
        {name:"Groceries",mbud:600,mspent:450,mused:450,annual:7200,bud12:fill(600)},
        {name:"Mortgage",mbud:2000,mspent:2200,mused:2200,annual:24000,bud12:fill(2000)},
        {name:"Travel",mbud:1000,mspent:300,mused:700,annual:12000,bud12:fill(1000)}]; // linked-goal Vacation uses $400 of the budget → mused 700
      state.goalSet={vacation:1,"car fund":1,"car loan":1,"car insurance":1,"emergency fund":1,"emergency savings":1,boat:1};
      window.isGoalName=function(n){return !!state.goalSet[(""+n).trim().toLowerCase()];};
      state.goals=[
        {name:"Vacation",target:5000,balance:2000,monthly:300,mtd:400,targetDate:"2026-12",residual:false,archived:false,account:"",category:"Travel"},
        {name:"Car Fund",target:12000,balance:3000,monthly:800,mtd:0,residual:true,residualPct:80,residualCap:0,archived:false},
        {name:"Car Loan",target:8000,balance:1000,monthly:250,mtd:0,targetDate:"2027-06",residual:false,archived:false},
        {name:"Car Insurance",target:1800,balance:600,monthly:150,mtd:0,residual:false,archived:false},
        {name:"Emergency Fund",target:3000,balance:3000,monthly:0,mtd:0,residual:false,archived:false},
        {name:"Emergency Savings",target:5000,balance:0,monthly:0,mtd:0,residual:false,archived:false},
        {name:"Boat",target:9000,balance:500,monthly:100,mtd:0,targetDate:"2026-03",residual:false,archived:true}];
      state.assets=[{name:"Checking",bal:15000},{name:"Savings",bal:5000}];
      state.debts=[{name:"Car Loan Debt",bal:15000}];
      state.nwHist=[{ym:202607,assets:19000,debts:15500,net:3500},{ym:202608,assets:20000,debts:15000,net:5000}];
      state.rows=[
        row(2026,8,'2026-08-01','Denzell','Deposit','',2066.67,''),row(2026,8,'2026-08-08','Denzell','Deposit','',2066.67,''),row(2026,8,'2026-08-14','Denzell','Deposit','',2066.67,''),
        row(2026,8,'2026-08-03','','Groceries','Grocery Store',500,''),row(2026,8,'2026-08-06','','Groceries','Grocery Store',-50,'refund'),
        row(2026,8,'2026-08-02','','Mortgage','Bank',2200,''),row(2026,8,'2026-08-05','','Travel','Airline',300,''),
        row(2026,8,'2026-08-04','','','IKEA',180,''),
        row(2026,8,'2026-08-07','','Travel','Vacation',400,''),
        row(2026,7,'2026-07-05','','','Vacation',300,''),row(2026,8,'2026-08-05','','','Vacation',400,''),
        row(2026,7,'2026-07-03','','Groceries','Grocery Store',400,''),row(2026,7,'2026-07-02','','Mortgage','Bank',2000,''),row(2026,7,'2026-07-09','','Travel','Airline',120,''),
        row(2026,8,'2026-08-25','','','Vacation',500,'future')];
      state.carryIn={};state.spend={};state.dep={};
      try{buildIndexes();}catch(e){}try{applyBudgetSpend();}catch(e){}
      resetWrenContext();
    }
    // FIXTURE FACTORY: base + a red envelope (Children −$2,800) covered by a positive buffer pool (Cushion +$1,960). Patches
    // are LOCAL — the next makeBaseHousehold() restores the originals, so nothing leaks into later domains.
    function makeContingencyHousehold(){
      makeBaseHousehold();
      state.meta.cats.children={type:"monthly",roll:"envelope"};state.meta.cats.cushion={type:"monthly",roll:"buffer"};
      catLinkedGoal12=function(){return fill(0);};
      var SP={children:[900,900,900,900,900,900,900,0,0,0,0,0],cushion:[20,20,20,20,20,20,20,0,0,0,0,0]};
      var base=ORIG.catSpend12;catSpend12=function(n){var k=(""+n).toLowerCase();return SP[k]?SP[k].slice():base(n);};
      adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
      state.cats.push({name:"Children",bud12:fill(500)},{name:"Cushion",bud12:fill(300)});
      resetWrenContext();
    }

    // ---- invocation spies (prove the engine was CALLED) ----
    function spy(name){var o=window[name];if(typeof o!=='function')return;var S={n:0};window['__'+name]=S;window[name]=function(){S.n++;return o.apply(this,arguments);};}
    var ENGINES=['getGoalFacts','planMetrics','evaluateDecision','computeRollover','netWorthNow','monthActualTotals','computeCashflow','computeAnnualPlan'];
    ENGINES.forEach(spy);
    function resetSpies(){ENGINES.forEach(function(s){if(window['__'+s])window['__'+s].n=0;});}

    function ask(text){var ana=null;try{ana=wrenAnalyze(text);}catch(e){return {path:'error',answer:'ERR:'+e.message};}if(ana)return {path:'analyze',answer:ana.answer||'',go:ana.go};var it=null;try{it=wrenMatch(text);}catch(e){}if(it)return {path:'match',answer:it.a||''};return {path:'none',answer:''};}
    function snap(r){r.spy={};ENGINES.forEach(function(s){r.spy[s]=window['__'+s]?window['__'+s].n:0;});return r;}
    function run(text){resetWrenContext();resetSpies();return snap(ask(text));}   // ISOLATED standalone question
    function runK(text){resetSpies();return snap(ask(text));}                     // KEEP context (a chain/memory follow-up turn)
    function cluster(qs){return qs.map(run);}                                     // each paraphrase is independent (run resets)

    var R={},F={};

    // ================= BASE-HOUSEHOLD DOMAINS =================
    makeBaseHousehold();
    // authoritative facts — assertions cross-check Wren against THESE, computed by the real engines
    F.vac=getGoalFacts("Vacation");F.emf=getGoalFacts("Emergency Fund");F.esav=getGoalFacts("Emergency Savings");
    F.nw=netWorthNow();F.pool=(typeof residualPool==='function'?Math.round(residualPool()*100)/100:0);
    F.mt=monthActualTotals(2026,8);F.augSpend=F.mt.expense;F.augIncome=F.mt.income;
    F.grocYTD=(function(){var s=catSpend12("Groceries");var t=0;for(var m=0;m<8;m++)t+=s[m]||0;return Math.round(t*100)/100;})();
    F.pmLow=planMetrics(currentPlan()).low;
    F.debt=(state.debts||[]).reduce(function(a,x){return a+(x.bal||0);},0);
    resetSpies();

    // ---- residual mechanics (WREN-001/002) ----
    R.residCap=cluster([
      "For my car fund goal, I want it to contribute 80% of the leftover funds, will it contribute up to the $800 or past it?",
      "Does my Car Fund stop at $800?","Can Car Fund get more than $800?","Is the $800 a cap on Car Fund?",
      "Which controls Car Fund, the $800 or the 80%?","Will the 80% go on top of the $800 for Car Fund?"]);
    R.contrastA=run("How much money did we have leftover in August?");
    R.contrastB=run("How much of our leftover goes to Car Fund?");
    // ---- goals ----
    R.g_bal=run("How much is in my Vacation goal?");R.g_more=run("How much more do I need for Vacation?");
    R.g_mtd=run("What did I contribute to Vacation this month?");R.g_ytd=run("How much have I put toward Vacation this year?");
    R.g_pace=run("Am I on pace for Vacation?");R.g_why=run("Why am I behind on Vacation?");
    R.g_finish=run("What would I need to save to finish Vacation by December?");
    R.g_reached=run("How's my Emergency Fund doing?");R.g_unfunded=run("When will I reach Emergency Savings?");
    R.g_overdue=run("When will I reach my Boat goal?");
    // ---- entity ----
    R.e_carAmbig=run("How's my car goal doing?");R.e_carExact=run("How much is in Car Fund?");
    R.e_emAmbig=run("How much is in my emergency goal?");R.e_emExact=run("How much is in Emergency Fund?");
    R.e_typo=run("How's my Vacaton goal?");R.e_missing=run("How much is in my Yacht goal?");
    // ---- category-linked ----
    R.cl_spent=run("How much did I spend on Travel?");R.cl_used=run("How much of my Travel budget have I used?");
    R.cl_left=run("How much Travel budget is left?");R.cl_goal=run("How much went toward Vacation?");
    // ---- income ----
    R.i_checks=run("How many paychecks does Denzell get this month?");R.i_reaches=run("How much of each check actually reaches our budget?");
    R.i_setaside=run("How much gets set aside from each check?");R.i_scale=run("Does the per-check set-aside increase in a three-paycheck month?");
    R.i_whyhigh=run("Why is our income higher in August?");
    // ---- spending / refund ----
    R.s_groc=run("How much did groceries cost after my refund?");R.s_refincome=run("Was the refund income?");
    R.s_unbud=run("What did I spend that wasn't budgeted?");R.s_biggest=run("What was my biggest expense this month?");
    R.s_vacspend=run("Did my Vacation contribution count as spending?");
    R.s_atStore=run("How much did I spend at Grocery Store?");R.s_total=run("How much have I spent in total this month?");
    R.s_grocYear=run("How much have I spent on groceries this year?");R.s_mostOn=run("What did I spend the most on?");
    R.s_biggestYr=run("What's my biggest expense?");
    // ---- as-of ----
    R.a_spent=run("How much have I spent this month?");R.a_income=run("How much income have we received this month?");
    R.a_scheduled=run("What's scheduled later this month?");
    // ---- cash flow / affordability ----
    R.cf_means=run("Are we living within our means?");R.cf_afford=run("Can we afford a $700 car payment?");
    R.cf_incdrop=run("What if Denzell's income drops $500 a month?");R.cf_low=run("What's our lowest cash month?");
    R.cf_cluster=cluster(["Will we run out of money?","Are we living within our means?","Is our budget sustainable?"]);
    R.a_vac=run("Can we spend $6,000 on a vacation in December?");R.a_daycare=run("What if daycare goes up $300 a month?");
    R.a_incGoal=run("Can I increase Car Fund to $1,200 a month?");
    // ---- net worth / debt ----
    R.n_worth=run("What's our net worth?");R.n_why=run("Why did our net worth go up?");
    R.n_linked=run("Why isn't my linked Vacation goal counted again in net worth?");
    R.n_debt=run("How much debt do we have?");R.n_paid=run("How much debt did we pay down?");
    R.n_moveGoal=run("If I move $5,000 into a goal, does my net worth change?");
    // ---- false premise ----
    R.fp_spend=run("Why did I spend $700 on Travel?");R.fp_nwfall=run("Why did my net worth fall?");R.fp_miss=run("Why did I miss my Vacation contribution?");
    R.fpp_nw=run("Why is my net worth dropping?");R.fpp_spend=run("Why did I overspend $700 on Travel?");
    // ---- epistemic ----
    R.ep_market=run("Will the stock market crash next year?");R.ep_house=run("What will my house be worth next year?");
    R.ep_bill=run("How much will my electric bill be next February?");R.ep_why=run("Why did Denzell buy this?");
    R.ep_necessary=run("Was that purchase necessary?");R.ep_definite=run("Will I definitely reach Car Fund by November?");
    R.epi_market2=run("Is the market going to crash?");R.epi_house2=run("How much will my house be worth in five years?");
    R.pb=run("Can you add a button to do that?");
    // ---- goal paraphrase clusters / edges ----
    R.gp_bal=cluster(["How much is in Vacation?","What's my Vacation balance?","How much have I saved for Vacation?","Where's Vacation at?"]);
    R.gp_more=cluster(["How much more for Vacation?","How much is left on Vacation?","What's left to save for Vacation?"]);
    R.gp_pace=cluster(["Am I on track for Vacation?","Am I on pace for Vacation?","Will I hit my Vacation goal in time?","Am I behind on Vacation?"]);
    R.ge_carLoan=run("How's my Car Loan goal doing?");R.ge_withdraw=run("What happens if I take $1,000 out of Vacation?");
    R.ge_reachedMore=run("How much more do I need for Emergency Fund?");R.g_insurance=run("How's Car Insurance?");R.g_carloanETA=run("When will I reach Car Loan?");
    R.ip_reach=cluster(["How much of each check reaches our budget?","How much of each paycheck can we actually budget?","What's budgetable from each check?"]);
    R.ep_partial=run("How's Emergency Savings doing?");R.ep_savings=run("How much is in my savings goal?");
    R.e_insurance=run("How's my Insurance goal?");R.e_typo2=run("How's my Emergancy Fund?");
    // ---- time comparison ----
    R.t_vsLast=run("Did we spend more than last month?");R.t_change=run("What's changed since July?");
    R.t_thisYear=run("How are we doing this year?");R.t_yearEnd=run("Where are we projected to finish the year?");

    // ================= CONTINGENCY DOMAIN (own fixture) =================
    makeContingencyHousehold();
    F.roll2=computeRollover();
    var ch=F.roll2.envelopes.filter(function(e){return e.name==='Children';})[0]||{};
    F.c={raw:ch.rawBalance,covered:ch.coveredByContingency,uncovered:F.roll2.uncoveredDeficit,available:F.roll2.remainingContingency,rawBuffer:F.roll2.rawBuffer,total:F.roll2.totalUncoveredDeficit,used:F.roll2.contingencyUsed};
    resetSpies();
    R.c_whyneg=run("Why is Children negative?");R.c_stillneg=run("Why is Children still negative if contingency covers it?");
    R.c_covered=run("How much of Children is covered by contingency?");R.c_uncov=run("How much is still uncovered?");
    R.c_avail=run("How much contingency do I actually have available?");R.c_which=run("Which envelopes are using contingency?");
    R.c_erase=run("Since contingency erased my Children overspending, am I fine?");R.c_nweffect=run("Does using contingency lower my net worth?");
    R.c_avail4=run("How much contingency do I have available?");R.c_over4=run("Is my contingency overspent?");
    R.c_total4=run("How much rollover shortfall do I have altogether?");R.c_whyRed=run("Why is Children in the red?");

    // ================= RESTORE BASE for the remaining domains =================
    makeBaseHousehold();resetSpies();
    // ---- conversational chains (deliberately carry context: first turn run(), follow-ups runK()) ----
    R.chainHyp=(function(){var a=run("Could I increase Car Fund to $1,000 a month?");return {a:a,b:runK("Would that put us below our floor?"),c:runK("And our lowest cash?"),d:runK("What about the surplus?")};})();
    R.chainCat=(function(){var a=run("How much did I spend on Travel?");return {a:a,b:runK("How much is left?")};})();
    R.chainWhyOB=(function(){var a=run("Am I over budget?");return {a:a,b:runK("Why?")};})();
    R.chainWhyNW=(function(){var a=run("Why did our net worth go up?");return {a:a,b:runK("Why?")};})();
    R.chainAfford=(function(){var a=run("Can we afford a $700 car payment?");return {a:a,b:runK("Would that drop us below our floor?")};})();
    R.chain3=(function(){var a=run("How's my Vacation goal?");return {a:a,b:runK("Am I on track?"),c:runK("Why?")};})();
    R.fu_catLeft=(function(){var a=run("How much did I spend on Groceries?");return {a:a,b:runK("How much is left there?")};})();
    R.fu=(function(){var a=run("How's my Vacation goal doing?");return {a:a,b:runK("How much did I add this month?"),c:runK("What about last month?"),d:runK("Why?")};})();
    // ---- conversational memory: SUPPORTED behavior + documented BOUNDARIES ----
    R.m_goalFollow=(function(){var a=run("How's my Vacation goal?");return {a:a,b:runK("How much did I add this month?")};})();
    R.m_catFollow=(function(){var a=run("How much did I spend on Travel?");return {a:a,b:runK("How much is left?")};})();
    R.m_goalToCat=(function(){var a=run("How's my Vacation goal?");return {a:a,b:runK("How much did I spend on Groceries?")};})();
    R.m_catToGoal=(function(){var a=run("How much did I spend on Groceries?");return {a:a,b:runK("How's my Vacation goal?")};})();
    R.m_ambigFollow=(function(){var a=run("How's my Vacation goal?");return {a:a,b:runK("How's my car goal?")};})();
    R.m_freshOverride=(function(){var a=run("How's my Vacation goal?");return {a:a,b:runK("How's Emergency Fund?")};})();
    R.m_pronoun=(function(){var a=run("How's my Vacation goal?");return {a:a,b:runK("Could I increase it to $500 a month?")};})();
    R.m_whyOverwrite=(function(){var a=run("How's my Vacation goal?");var b=runK("Why am I over budget?");return {a:a,b:b,c:runK("Why?")};})();

    // ================= PROVENANCE (sentinel) — proves Wren USES the engine's returned value =================
    // Stub one engine with unmistakable numbers, ask one question, assert Wren's answer reflects the sentinel, restore.
    makeBaseHousehold();var PROV={};
    function withStub(name,stub,text,followSetup){
      var saved=window[name];window[name]=stub;var r;
      try{resetWrenContext();if(followSetup)followSetup();r=ask(text);}finally{window[name]=saved;}
      return r;
    }
    // getGoalFacts → sentinel balance $4,321.09
    PROV.goal=withStub('getGoalFacts',function(){return {found:true,name:"Vacation",archived:false,target:9999.99,balance:4321.09,remaining:5678.90,reached:false,residual:false,residualPct:0,residualCap:0,plannedMonthly:0,plannedThisMonth:0,fundedThisMonth:0,mtd:0,ytd:0,lastMonth:0,shortfallThisMonth:0,targetDate:"",monthsToTarget:0,overdue:false,requiredPace:0,behind:false,account:"",category:"",linked:false,eta:null,status:"unfunded"};},"How much is in Vacation?");
    // netWorthNow → sentinel $42,424.24
    PROV.nw=withStub('netWorthNow',function(){return 42424.24;},"What's our net worth?");
    // planMetrics → sentinel low −$55,555.55
    PROV.pm=withStub('planMetrics',function(){return {surplus:12121.21,surplusYr:12121.21,low:-55555.55,lowMonth:"October",end:9090.90,netEnd:0,netNow:0};},"Are we living within our means?");
    // computeRollover → sentinel uncovered $4,455.55
    PROV.roll=withStub('computeRollover',function(){return {buffer:0,envelopes:[],envTotal:0,goalsCommit:0,rawBuffer:0,availableBuffer:0,remainingContingency:0,bufferDeficit:0,totalEnvelopeDeficit:9999.99,contingencyUsed:5544.44,uncoveredDeficit:4455.55,uncoveredEnvelopeDeficit:4455.55,totalUncoveredDeficit:4455.55};},"How much is still uncovered?");
    // evaluateDecision → sentinel after.low $44,444.44 (via a carried hypothetical, so wrenScenarioSub echoes it)
    PROV.dec=(function(){makeBaseHousehold();resetWrenContext();ask("Could I increase Vacation to $500 a month?");/* sets scenario via REAL engine */
      var saved=window.evaluateDecision;window.evaluateDecision=function(){return {type:'goalMonthly',batch:false,changes:[{type:'goalMonthly'}],feasible:true,before:{surplus:11111.11,surplusYr:11111.11,low:22222.22,lowMonth:"March",end:0,netEnd:0,netNow:0},after:{surplus:33333.33,surplusYr:33333.33,low:44444.44,lowMonth:"March",end:0,netEnd:88888.88,netNow:0},goal:null,floor:0,passesFloor:true};};
      var r;try{r=ask("And our lowest cash?");}finally{window.evaluateDecision=saved;}return r;})();
    makeBaseHousehold();

    return {R:R,F:F,PROV:PROV};
  });

  const R=res.R,F=res.F,PROV=res.PROV;
  const M=v=>(v<0?'-':'')+'$'+Math.abs(Number(v)).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); // matches the app's money() negative format ("-$2,800.00")
  const has=(r,s)=>!!(r&&r.answer&&r.answer.indexOf(s)>=0);
  const rx=(r,re)=>!!(r&&r.answer&&re.test(r.answer));
  const all=(arr,pred)=>arr.every(pred);
  const D=(exp,r,extra)=>({exp,act:(r&&r.answer||'').slice(0,120),spy:(r&&r.spy)||null,extra:extra||undefined});

  // ============ RESIDUAL / CLASSIFICATION ============
  ck('WREN-001','Residual','Classification','6 residual-cap paraphrases avoid the savings/pace misroute', all(R.residCap,a=>!/you kept|leftover in|on pace to reach it around/i.test(a.answer)), R.residCap.map(a=>a.answer.slice(0,30)));
  ck('WREN-001','Residual','Interpretation','6 paraphrases explain leftover funding / not-capped', all(R.residCap,a=>/leftover|not capped|% of|cap/i.test(a.answer)), R.residCap.map(a=>a.answer.slice(0,30)));
  ck('WREN-001','Residual','Computation','the draw references the EXACT engine pool amount '+M(F.pool), has(R.residCap[0],M(F.pool)), D(M(F.pool),R.residCap[0]));
  ck('WREN-002','Residual','Classification','contrastive "leftover in August" → monthly finances, not a goal', !/not capped|Car Fund|leftover funding/i.test(R.contrastA.answer), R.contrastA.answer);
  ck('WREN-002','Residual','Classification','contrastive "leftover to Car Fund" → residual goal', /Car Fund|leftover|not capped|%/i.test(R.contrastB.answer)&&!/you kept/i.test(R.contrastB.answer), R.contrastB.answer);

  // ============ GOALS (exact facts) ============
  ck('WREN-020','Goals','Retrieval','Vacation balance is EXACTLY '+M(F.vac.balance), has(R.g_bal,'Vacation')&&has(R.g_bal,M(F.vac.balance)), D(M(F.vac.balance),R.g_bal));
  ck('WREN-020','Goals','Computation','balance answer invoked getGoalFacts', R.g_bal.spy.getGoalFacts>0, D('getGoalFacts>0',R.g_bal,{spy:R.g_bal.spy.getGoalFacts}));
  ck('WREN-021','Goals','Interpretation','remaining is EXACTLY '+M(F.vac.remaining), has(R.g_more,M(F.vac.remaining)), D(M(F.vac.remaining),R.g_more));
  ck('WREN-022','Goals','Classification','MTD contribution is EXACTLY '+M(F.vac.mtd)+' this month (goal funding)', has(R.g_mtd,M(F.vac.mtd))&&/this month/i.test(R.g_mtd.answer), D(M(F.vac.mtd),R.g_mtd));
  ck('WREN-023','Goals','Computation','YTD is EXACTLY '+M(F.vac.ytd)+' (future-dated $500 excluded)', has(R.g_ytd,M(F.vac.ytd))&&!has(R.g_ytd,'$1,200'), D(M(F.vac.ytd),R.g_ytd));
  ck('WREN-024','Goals','Classification','"on pace" reads as pace, not spending', /pace|reach|behind|on track/i.test(R.g_pace.answer)&&!/you spent/i.test(R.g_pace.answer), R.g_pace.answer);
  ck('WREN-025','Goals','Interpretation','"why behind" gives EXACT required pace '+M(F.vac.requiredPace)+' vs planned '+M(F.vac.plannedMonthly), has(R.g_why,M(F.vac.requiredPace))&&has(R.g_why,M(F.vac.plannedMonthly)), D(M(F.vac.requiredPace)+' & '+M(F.vac.plannedMonthly),R.g_why));
  ck('WREN-026','Goals','Interpretation','"finish by December" gives EXACT required rate '+M(F.vac.requiredPace), has(R.g_finish,M(F.vac.requiredPace)), D(M(F.vac.requiredPace),R.g_finish));
  ck('WREN-027','Goals','Interpretation','reached goal is fully-funded ('+M(F.emf.balance)+'), not behind', /fully funded|reached/i.test(R.g_reached.answer)&&has(R.g_reached,M(F.emf.balance))&&!/behind/i.test(R.g_reached.answer), D(M(F.emf.balance),R.g_reached));
  ck('WREN-028','Goals','Boundaries','unfunded goal shows '+M(F.esav.balance)+'/'+M(F.esav.target)+' and fabricates NO date', has(R.g_unfunded,M(F.esav.balance))&&has(R.g_unfunded,M(F.esav.target))&&!/on pace to reach it around [A-Z]/.test(R.g_unfunded.answer), D(M(F.esav.balance)+' of '+M(F.esav.target),R.g_unfunded));
  ck('WREN-029','Goals','Boundaries','overdue archived Boat gives no false FUTURE date', !/on pace to reach it around (20[3-9]\d|20[2-9]\d)/.test(R.g_overdue.answer)&&/passed|overdue|reach|archiv|don'?t see|target/i.test(R.g_overdue.answer), R.g_overdue.answer);

  // ============ ENTITY ============
  ck('WREN-030','Entity','Boundaries','"car goal" (3 matches) asks which', /did you mean|which/i.test(R.e_carAmbig.answer), R.e_carAmbig.answer);
  ck('WREN-031','Entity','Retrieval','"Car Fund" resolves exactly (bal '+M(3000)+')', has(R.e_carExact,'Car Fund')&&has(R.e_carExact,M(3000))&&!/did you mean/i.test(R.e_carExact.answer), D(M(3000),R.e_carExact));
  ck('WREN-032','Entity','Boundaries','"emergency goal" (2 matches) asks which', /did you mean|which/i.test(R.e_emAmbig.answer), R.e_emAmbig.answer);
  ck('WREN-033','Entity','Retrieval','"Emergency Fund" resolves exactly ('+M(3000)+')', has(R.e_emExact,'Emergency Fund')&&has(R.e_emExact,M(3000)), D(M(3000),R.e_emExact));
  ck('WREN-034','Entity','Boundaries','a clear typo resolves to NO goal', !/Car (Fund|Loan|Insurance)|Emergency|Vacation|Boat/i.test(R.e_typo.answer), R.e_typo.answer);
  ck('WREN-035','Entity','Boundaries','a nonexistent goal is declined', /don'?t see|no goal/i.test(R.e_missing.answer), R.e_missing.answer);

  // ============ CATEGORY-LINKED (consumption vs budget used) ============
  ck('WREN-040','Linked','Classification','"spent on Travel" = consumption EXACTLY $300 (not $700)', has(R.cl_spent,M(300))&&!has(R.cl_spent,M(700)), D(M(300),R.cl_spent));
  ck('WREN-041','Linked','Classification','"Travel budget used" = EXACTLY $700 (incl. linked-goal $400)', has(R.cl_used,M(700)), D(M(700),R.cl_used));
  ck('WREN-042','Linked','Interpretation','"Travel left" = EXACTLY $300', has(R.cl_left,M(300)), D(M(300),R.cl_left));
  ck('WREN-043','Linked','Classification','"toward Vacation" = EXACTLY $400 goal funding', has(R.cl_goal,M(400)), D(M(400),R.cl_goal));

  // ============ INCOME ============
  ck('WREN-050','Income','Computation','EXACTLY 3 paychecks in a 3-check August', has(R.i_checks,'3')&&/paycheck/i.test(R.i_checks.answer), R.i_checks.answer);
  ck('WREN-051','Income','Interpretation','budgetable per check = EXACTLY '+M(2066.67), has(R.i_reaches,M(2066.67)), D(M(2066.67),R.i_reaches));
  ck('WREN-052','Income','Classification','set-aside per check = EXACTLY '+M(1769.60), has(R.i_setaside,M(1769.60)), D(M(1769.60),R.i_setaside));
  ck('WREN-053','Income','Interpretation','per-check set-aside DOES scale in a 3-check month', /yes/i.test(R.i_scale.answer)&&/3|three|per check/i.test(R.i_scale.answer), R.i_scale.answer);
  ck('WREN-054','Income','Interpretation','August higher because it is a 3-paycheck month', /3|three|extra/i.test(R.i_whyhigh.answer)&&/paycheck|check/i.test(R.i_whyhigh.answer), R.i_whyhigh.answer);

  // ============ SPENDING / REFUND (exact) ============
  ck('WREN-070','Spending','Computation','groceries after refund = EXACTLY '+M(450), has(R.s_groc,M(450)), D(M(450),R.s_groc));
  ck('WREN-071','Spending','Classification','a refund is NOT income', /(no|isn'?t|not).{0,16}income|reduce|lower|offset/i.test(R.s_refincome.answer)&&!/income in august was/i.test(R.s_refincome.answer), R.s_refincome.answer);
  ck('WREN-072','Spending','Retrieval','unbudgeted = EXACTLY '+M(180)+' (the IKEA)', has(R.s_unbud,M(180)), D(M(180),R.s_unbud));
  ck('WREN-073','Spending','Classification','biggest expense is Mortgage', /mortgage/i.test(R.s_biggest.answer), R.s_biggest.answer);
  ck('WREN-074','Spending','Classification','a Vacation contribution is NOT counted as spending', /(no|not|isn'?t).{0,20}(spend|spending|expense)|goal|toward/i.test(R.s_vacspend.answer)&&!/you spent \$/i.test(R.s_vacspend.answer), R.s_vacspend.answer);
  ck('WREN-191','Spending','Retrieval','spend at Grocery Store (year) nets the refund = EXACTLY '+M(F.grocYTD), has(R.s_atStore,M(F.grocYTD)), D(M(F.grocYTD),R.s_atStore));
  ck('WREN-192','Spending','Computation','total spent this month = EXACTLY '+M(F.augSpend)+' (deposits & goal moves excluded)', has(R.s_total,M(F.augSpend)), D(M(F.augSpend),R.s_total));
  ck('WREN-290','Spending','Computation','groceries YTD = EXACTLY '+M(F.grocYTD), has(R.s_grocYear,M(F.grocYTD)), D(M(F.grocYTD),R.s_grocYear));
  ck('WREN-291','Spending','Classification','"spent the most on" is a real category (Mortgage)', /mortgage/i.test(R.s_mostOn.answer), R.s_mostOn.answer);
  ck('WREN-190','Spending','Classification','biggest expense (yr) is Mortgage, not a deposit/goal move', /mortgage/i.test(R.s_biggestYr.answer), R.s_biggestYr.answer);

  // ============ AS-OF / FUTURE DATE ============
  ck('WREN-080','AsOf','Computation','spent-this-month = EXACTLY '+M(F.augSpend)+' (future $500 excluded)', has(R.a_spent,M(F.augSpend)), D(M(F.augSpend),R.a_spent));
  ck('WREN-081','AsOf','Computation','income-this-month = EXACTLY '+M(F.augIncome)+' (matches the actuals engine)', has(R.a_income,M(F.augIncome)), D(M(F.augIncome),R.a_income));
  ck('WREN-260','AsOf','Boundaries','"scheduled later this month" does NOT report the future $500 as already done', !/you'?ve (contributed|put in|added) .*\$1,200|already/i.test(R.a_scheduled.answer)&&!/contributed \$500\.00 this month/i.test(R.a_scheduled.answer), R.a_scheduled.answer);

  // ============ CASH FLOW / AFFORDABILITY (provenance-enforced) ============
  ck('WREN-090','CashFlow','Classification','"within our means" distinguishes annual plan from cash-flow low point', /sustainab|cushion|cash|dip|deficit|positive/i.test(R.cf_means.answer), R.cf_means.answer);
  ck('WREN-091','CashFlow','Computation','affordability INVOKED the Decision Engine', R.cf_afford.spy.evaluateDecision>0, D('evaluateDecision>0',R.cf_afford,{spy:R.cf_afford.spy.evaluateDecision}));
  ck('WREN-092','CashFlow','Computation','income-drop MUST route through the Decision Engine (no ad-hoc fallback)', R.cf_incdrop.spy.evaluateDecision>0, D('evaluateDecision>0',R.cf_incdrop,{spy:R.cf_incdrop.spy.evaluateDecision}));
  ck('WREN-160','CashFlow','Computation','$6,000 December vacation INVOKED the Decision Engine', R.a_vac.spy.evaluateDecision>0, D('evaluateDecision>0',R.a_vac,{spy:R.a_vac.spy.evaluateDecision}));
  ck('WREN-161','CashFlow','Computation','daycare +$300/mo INVOKED the Decision Engine', R.a_daycare.spy.evaluateDecision>0, D('evaluateDecision>0',R.a_daycare,{spy:R.a_daycare.spy.evaluateDecision}));
  ck('WREN-162','CashFlow','Computation','"increase Car Fund to $1,200" INVOKED the Decision Engine', R.a_incGoal.spy.evaluateDecision>0, D('evaluateDecision>0',R.a_incGoal,{spy:R.a_incGoal.spy.evaluateDecision}));
  ck('WREN-270','CashFlow','Classification','3 cash-flow paraphrases read as sustainability/cash', all(R.cf_cluster,a=>/(sustainab|cushion|cash|dip|deficit|positive|surplus|savings)/i.test(a.answer)), R.cf_cluster.map(a=>a.answer.slice(0,26)));
  ck('WREN-271','CashFlow','Computation','all 3 cash-flow paraphrases INVOKED planMetrics', all(R.cf_cluster,a=>a.spy.planMetrics>0), R.cf_cluster.map(a=>a.spy.planMetrics));
  ck('WREN-272','CashFlow','Computation','"lowest cash month" reports the EXACT engine low '+M(F.pmLow), has(R.cf_low,M(F.pmLow)), D(M(F.pmLow),R.cf_low));

  // ============ NET WORTH / DEBT (exact) ============
  ck('WREN-100','Worth','Computation','net worth = EXACTLY '+M(F.nw)+' AND invoked netWorthNow', has(R.n_worth,M(F.nw))&&R.n_worth.spy.netWorthNow>0, D(M(F.nw),R.n_worth,{spy:R.n_worth.spy.netWorthNow}));
  ck('WREN-101','Worth','Interpretation','increase attributes EXACTLY +$1,000 assets and $500 debt paydown', has(R.n_why,M(1000))&&has(R.n_why,M(500)), D(M(1000)+' & '+M(500),R.n_why));
  ck('WREN-102','Worth','Interpretation','linked goal not double-counted (earmarking explained)', /earmark|inside|account|already|counted once|not added/i.test(R.n_linked.answer), R.n_linked.answer);
  ck('WREN-170','Worth','Retrieval','total debt = EXACTLY '+M(F.debt), has(R.n_debt,M(F.debt)), D(M(F.debt),R.n_debt));
  ck('WREN-171','Worth','Interpretation','debt paid down = EXACTLY '+M(500), has(R.n_paid,M(500)), D(M(500),R.n_paid));
  ck('WREN-172','Worth','Classification','moving cash into a goal does NOT change net worth', /(no|doesn'?t|not|same)/i.test(R.n_moveGoal.answer)&&/net worth|still yours|inside|earmark/i.test(R.n_moveGoal.answer), R.n_moveGoal.answer);

  // ============ FALSE PREMISE ============
  ck('WREN-110','FalsePremise','Boundaries','"$700 on Travel" corrected to EXACTLY $300', has(R.fp_spend,M(300))&&/(not|actually|\$400|linked|goal)/i.test(R.fp_spend.answer), D(M(300),R.fp_spend));
  ck('WREN-111','FalsePremise','Boundaries','"net worth fell" corrected — it ROSE '+M(1500), /up|grew|rose|increase/i.test(R.fp_nwfall.answer)&&has(R.fp_nwfall,M(1500)), D('rose '+M(1500),R.fp_nwfall));
  ck('WREN-112','FalsePremise','Boundaries','"missed Vacation contribution" corrected — it was '+M(F.vac.mtd), /(didn'?t miss|you (did|have)|on record)/i.test(R.fp_miss.answer)&&has(R.fp_miss,M(F.vac.mtd)), D(M(F.vac.mtd),R.fp_miss));
  ck('WREN-250','FalsePremise','Boundaries','"net worth dropping?" corrected (it rose)', /(up|grew|rose|increase)/i.test(R.fpp_nw.answer)&&!/^your net worth dipped/i.test(R.fpp_nw.answer), R.fpp_nw.answer);
  ck('WREN-251','FalsePremise','Boundaries','"overspend $700 on Travel?" corrected to EXACTLY $300', has(R.fpp_spend,M(300)), D(M(300),R.fpp_spend));

  // ============ EPISTEMIC (semantic is appropriate here — nothing to number-check) ============
  ck('WREN-120','Epistemic','Boundaries','stock-market crash → declines', /can'?t predict|outside|don'?t (know|forecast)|not.*forecast/i.test(R.ep_market.answer), R.ep_market.answer);
  ck('WREN-121','Epistemic','Boundaries','future house value → declines', /can'?t forecast|don'?t forecast|update the value|not.*project/i.test(R.ep_house.answer), R.ep_house.answer);
  ck('WREN-122','Epistemic','Boundaries','future bill → declines', /don'?t forecast|only know|budget an amount/i.test(R.ep_bill.answer), R.ep_bill.answer);
  ck('WREN-123','Epistemic','Boundaries','"why did Denzell buy this" → can\'t know intent', /can'?t know|only see|not the reason/i.test(R.ep_why.answer), R.ep_why.answer);
  ck('WREN-124','Epistemic','Boundaries','"was it necessary" → won\'t judge', /your call|won'?t judge|can'?t (say|judge)/i.test(R.ep_necessary.answer), R.ep_necessary.answer);
  ck('WREN-125','Epistemic','Boundaries','"definitely reach by November" → estimate not certainty', /can'?t promise|estimate|not a? ?certain|changes month/i.test(R.ep_definite.answer), R.ep_definite.answer);
  ck('WREN-240','Epistemic','Boundaries','"is the market going to crash?" declines', /can'?t predict|outside|don'?t (know|forecast)/i.test(R.epi_market2.answer), R.epi_market2.answer);
  ck('WREN-241','Epistemic','Boundaries','"house worth in five years?" declines', /can'?t forecast|don'?t forecast|update the value/i.test(R.epi_house2.answer), R.epi_house2.answer);
  ck('WREN-130','Product','Boundaries','Wren does not offer to build/change the app', !/i can add|i'?ll (add|implement|build|change)|i can change/i.test(R.pb.answer), R.pb.answer);

  // ============ GOAL clusters / edges ============
  ck('WREN-180','Goals','Retrieval','4 balance paraphrases all report EXACTLY '+M(F.vac.balance), all(R.gp_bal,a=>has(a,M(F.vac.balance))&&/Vacation/i.test(a.answer)), R.gp_bal.map(a=>a.answer.slice(0,26)));
  ck('WREN-181','Goals','Computation','all 4 balance paraphrases invoked getGoalFacts', all(R.gp_bal,a=>a.spy.getGoalFacts>0), R.gp_bal.map(a=>a.spy.getGoalFacts));
  ck('WREN-182','Goals','Interpretation','3 "how much more" paraphrases all report EXACTLY '+M(F.vac.remaining), all(R.gp_more,a=>has(a,M(F.vac.remaining))), R.gp_more.map(a=>a.answer.slice(0,26)));
  ck('WREN-210','Goals','Classification','4 pace paraphrases read as pace/behind, never spending', all(R.gp_pace,a=>/pace|reach|behind|on track|20\d\d/i.test(a.answer)&&!/you spent/i.test(a.answer)), R.gp_pace.map(a=>a.answer.slice(0,22)));
  ck('WREN-211','Goals','Retrieval','"Car Loan goal" resolves to Car Loan (not residual Car Fund)', /Car Loan/i.test(R.ge_carLoan.answer)&&!/leftover|80%/i.test(R.ge_carLoan.answer), R.ge_carLoan.answer);
  ck('WREN-212','Goals','Interpretation','withdraw $1,000 shows balance EXACTLY '+M(2000)+' → '+M(1000), has(R.ge_withdraw,M(2000))&&has(R.ge_withdraw,M(1000)), D(M(2000)+'→'+M(1000),R.ge_withdraw));
  ck('WREN-213','Goals','Interpretation','"how much more" on a reached goal says nothing left', /(fully funded|nothing (left|to go)|reached|\$0)/i.test(R.ge_reachedMore.answer), R.ge_reachedMore.answer);
  ck('WREN-280','Goals','Retrieval','"Car Insurance" resolves exactly ('+M(600)+')', /Car Insurance/i.test(R.g_insurance.answer)&&has(R.g_insurance,M(600)), D(M(600),R.g_insurance));
  ck('WREN-281','Goals','Interpretation','"when will I reach Car Loan" projects a date', /20\d\d/.test(R.g_carloanETA.answer||''), R.g_carloanETA.answer);
  ck('WREN-220','Income','Interpretation','3 "reaches budget" paraphrases all give EXACTLY '+M(2066.67), all(R.ip_reach,a=>has(a,M(2066.67))), R.ip_reach.map(a=>a.answer.slice(0,26)));
  ck('WREN-230','Entity','Retrieval','"Emergency Savings" resolves exactly', /Emergency Savings/i.test(R.ep_partial.answer), R.ep_partial.answer);
  ck('WREN-231','Entity','Boundaries','"my savings goal" resolves Emergency Savings or asks', /Emergency Savings|did you mean|which|don'?t see/i.test(R.ep_savings.answer), R.ep_savings.answer);
  ck('WREN-320','Entity','Retrieval','"Insurance goal" (partial) resolves to Car Insurance', /Car Insurance/i.test(R.e_insurance.answer), R.e_insurance.answer);
  ck('WREN-321','Entity','Boundaries','typo "Emergancy Fund" resolves to NO wrong goal', !/Car (Fund|Loan|Insurance)|Vacation|Boat/i.test(R.e_typo2.answer), R.e_typo2.answer);

  // ============ TIME COMPARISON (exact where computable) ============
  // The comparison now routes BOTH periods through the canonical monthActualTotals(): this-month is deterministic (as-of day,
  // not the real clock) AND includes uncategorized spending (the $180 IKEA), so it equals the Month headline exactly.
  ck('WREN-150','Time','Interpretation','"more than last month?" uses CANONICAL totals: this month EXACTLY '+M(F.augSpend)+' (incl. uncategorized), July EXACTLY '+M(2520)+', "more"', has(R.t_vsLast,M(F.augSpend))&&has(R.t_vsLast,M(2520))&&/\bmore\b/i.test(R.t_vsLast.answer)&&!/3-paycheck|extra check/i.test(R.t_vsLast.answer), D(M(F.augSpend)+' & '+M(2520),R.t_vsLast));
  ck('WREN-150b','Time','Computation','INVARIANT: month-comparison this-month figure === Month headline ('+M(F.augSpend)+', via monthActualTotals) — Wren has no own "spent" definition', has(R.t_vsLast,M(F.augSpend))&&R.t_vsLast.spy.monthActualTotals>0, D(M(F.augSpend),R.t_vsLast,{spy:R.t_vsLast.spy.monthActualTotals}));
  ck('WREN-151','Time','Classification','"this year?" gives a YTD read', /(year|ytd|so far)/i.test(R.t_thisYear.answer), R.t_thisYear.answer);
  ck('WREN-152','Time','Interpretation','"finish the year?" gives a projection', /(project|year|trending|finish|by december|on pace|plan)/i.test(R.t_yearEnd.answer)&&rx(R.t_yearEnd,/\$[\d,]/), R.t_yearEnd.answer);
  ck('WREN-153','Time','Interpretation','"what changed since July?" compares with a figure', /(more|less|vs|chang)/i.test(R.t_change.answer)&&rx(R.t_change,/\$[\d,]/)&&!/couldn'?t find/i.test(R.t_change.answer), R.t_change.answer);

  // ============ CONTINGENCY (exact authoritative values) ============
  ck('WREN-060','Contingency','Interpretation','"why negative" explains overspend and shows '+M(F.c.raw), /Children/i.test(R.c_whyneg.answer)&&has(R.c_whyneg,M(F.c.raw)), D(M(F.c.raw),R.c_whyneg));
  ck('WREN-061','Contingency','Classification','raw stays visible ('+M(F.c.raw)+'); never says the −$ envelope is $0', has(R.c_stillneg,M(F.c.raw))&&/still shows|raw|history|accountability|covers/i.test(R.c_stillneg.answer)&&!/is now \$0|zeroed/i.test(R.c_stillneg.answer), D(M(F.c.raw),R.c_stillneg));
  ck('WREN-062','Contingency','Computation','coverage = EXACTLY '+M(F.c.covered)+' AND invoked computeRollover', has(R.c_covered,M(F.c.covered))&&R.c_covered.spy.computeRollover>0, D(M(F.c.covered),R.c_covered,{spy:R.c_covered.spy.computeRollover}));
  ck('WREN-063','Contingency','Interpretation','uncovered deficit = EXACTLY '+M(F.c.uncovered), has(R.c_uncov,M(F.c.uncovered)), D(M(F.c.uncovered),R.c_uncov));
  ck('WREN-064','Contingency','Interpretation','available contingency = EXACTLY '+M(F.c.available), has(R.c_avail,M(F.c.available)), D(M(F.c.available),R.c_avail));
  ck('WREN-065','Contingency','Retrieval','"which envelopes" names Children with EXACTLY '+M(F.c.covered)+'; NOT "no envelopes"', /Children/i.test(R.c_which.answer)&&has(R.c_which,M(F.c.covered))&&!/no envelopes/i.test(R.c_which.answer), D('Children '+M(F.c.covered),R.c_which));
  ck('WREN-066','Contingency','Boundaries','false premise "contingency erased overspending" is corrected', /doesn'?t erase|still shows|covers/i.test(R.c_erase.answer), R.c_erase.answer);
  ck('WREN-067','Contingency','Interpretation','using contingency does NOT lower net worth', /(no|doesn'?t|not).{0,20}(net worth|lower|change)|reallocation|doesn'?t move/i.test(R.c_nweffect.answer), R.c_nweffect.answer);
  ck('WREN-200','Contingency','Classification','"contingency available" = EXACTLY '+M(F.c.available), has(R.c_avail4,M(F.c.available))&&/available/i.test(R.c_avail4.answer), D(M(F.c.available),R.c_avail4));
  ck('WREN-201','Contingency','Classification','"overspent?" → NO, buffer in the black at '+M(F.c.rawBuffer), has(R.c_over4,M(F.c.rawBuffer))&&/(black|positive|no)/i.test(R.c_over4.answer), D(M(F.c.rawBuffer),R.c_over4));
  ck('WREN-202','Contingency','Interpretation','"rollover shortfall altogether" = EXACTLY '+M(F.c.total), has(R.c_total4,M(F.c.total)), D(M(F.c.total),R.c_total4));
  ck('WREN-300','Contingency','Interpretation','"why is Children in the red" explains overspend '+M(F.c.raw), /Children/i.test(R.c_whyRed.answer)&&has(R.c_whyRed,M(F.c.raw)), D(M(F.c.raw),R.c_whyRed));

  // ============ CONVERSATIONAL CHAINS ============
  ck('WREN-140','Chain','Computation','hypothetical "increase Car Fund to $1,000" runs the Decision Engine', R.chainHyp.a.spy.evaluateDecision>0, D('evaluateDecision>0',R.chainHyp.a,{spy:R.chainHyp.a.spy.evaluateDecision}));
  ck('WREN-140','Chain','Interpretation','follow-up "below our floor?" answers the floor', /floor/i.test(R.chainHyp.b.answer)&&/(above|below)/i.test(R.chainHyp.b.answer), R.chainHyp.b.answer);
  ck('WREN-140','Chain','Computation','the floor follow-up RE-RAN the Decision Engine', R.chainHyp.b.spy.evaluateDecision>0, D('evaluateDecision>0',R.chainHyp.b,{spy:R.chainHyp.b.spy.evaluateDecision}));
  ck('WREN-140','Chain','Interpretation','"and our lowest cash?" answers the cash low point', /(lowest|cash)/i.test(R.chainHyp.c.answer)&&rx(R.chainHyp.c,/\$[\d,]/), R.chainHyp.c.answer);
  ck('WREN-140','Chain','Interpretation','"what about the surplus?" answers annual surplus', /surplus/i.test(R.chainHyp.d.answer), R.chainHyp.d.answer);
  ck('WREN-141','Chain','Retrieval','"how much is left?" after Travel stays on Travel ('+M(300)+')', /Travel/i.test(R.chainCat.b.answer)&&has(R.chainCat.b,M(300)), D(M(300),R.chainCat.b));
  ck('WREN-142','Chain','Interpretation','bare "why?" after over-budget substantiates Mortgage +'+M(200), /mortgage/i.test(R.chainWhyOB.b.answer)&&has(R.chainWhyOB.b,M(200)), D(M(200),R.chainWhyOB.b));
  ck('WREN-143','Chain','Interpretation','bare "why?" after net-worth-up re-attributes '+M(1000)+'/'+M(500), has(R.chainWhyNW.b,M(1000))&&has(R.chainWhyNW.b,M(500)), D(M(1000)+' & '+M(500),R.chainWhyNW.b));
  ck('WREN-144','Chain','Computation','affordability chain floor follow-up RE-RAN the Decision Engine', R.chainAfford.b.spy.evaluateDecision>0&&/floor/i.test(R.chainAfford.b.answer), D('evaluateDecision>0 + floor',R.chainAfford.b,{spy:R.chainAfford.b.spy.evaluateDecision}));
  ck('WREN-310','Chain','Retrieval','3-turn "am I on track?" stays on Vacation', /Vacation|pace|reach|behind|20\d\d/i.test(R.chain3.b.answer)&&!/Car|Emergency/i.test(R.chain3.b.answer), R.chain3.b.answer);
  ck('WREN-311','Chain','Interpretation','3-turn bare "why?" substantiates Vacation pace ('+M(F.vac.requiredPace)+'/'+M(F.vac.plannedMonthly)+')', has(R.chain3.c,M(F.vac.requiredPace))&&has(R.chain3.c,M(F.vac.plannedMonthly)), D(M(F.vac.requiredPace)+' & '+M(F.vac.plannedMonthly),R.chain3.c));
  ck('WREN-312','Chain','Retrieval','"how much is left there?" after Groceries stays on Groceries', /Groceries/i.test(R.fu_catLeft.b.answer)&&!/Travel|Mortgage|Car/i.test(R.fu_catLeft.b.answer), R.fu_catLeft.b.answer);

  // ============ FOLLOW-UP ============
  ck('WREN-013','FollowUp','Retrieval','opening resolves Vacation', has(R.fu.a,'Vacation'), R.fu.a.answer);
  ck('WREN-013','FollowUp','Retrieval','"how much did I add this month?" stays on Vacation ('+M(F.vac.mtd)+')', has(R.fu.b,M(F.vac.mtd))&&!/Car|Emergency|Boat/i.test(R.fu.b.answer), D(M(F.vac.mtd),R.fu.b));
  ck('WREN-013','FollowUp','Interpretation','"what about last month?" gives July ('+M(F.vac.lastMonth)+')', has(R.fu.c,M(F.vac.lastMonth)), D(M(F.vac.lastMonth),R.fu.c));
  ck('WREN-013','FollowUp','Interpretation','bare "why?" substantiates being behind (exact pace)', has(R.fu.d,M(F.vac.requiredPace))&&has(R.fu.d,M(F.vac.plannedMonthly)), D(M(F.vac.requiredPace)+' & '+M(F.vac.plannedMonthly),R.fu.d));

  // ============ CONVERSATIONAL MEMORY (supported + boundaries) ============
  ck('WREN-330','Memory','Retrieval','SUPPORTED: direct goal follow-up stays on last goal ('+M(F.vac.mtd)+')', has(R.m_goalFollow.b,M(F.vac.mtd))&&!/Car|Emergency|Groceries/i.test(R.m_goalFollow.b.answer), D(M(F.vac.mtd),R.m_goalFollow.b));
  ck('WREN-331','Memory','Retrieval','SUPPORTED: direct category follow-up stays on Travel ('+M(300)+' left)', /Travel/i.test(R.m_catFollow.b.answer)&&has(R.m_catFollow.b,M(300)), D(M(300),R.m_catFollow.b));
  ck('WREN-332','Memory','Classification','SUPPORTED: goal→category switch answers Groceries ('+M(450)+'), not the goal', has(R.m_goalToCat.b,M(450))&&/Groceries/i.test(R.m_goalToCat.b.answer)&&!/Vacation/i.test(R.m_goalToCat.b.answer), D(M(450),R.m_goalToCat.b));
  ck('WREN-333','Memory','Classification','SUPPORTED: category→goal switch answers Vacation, not the category', /Vacation/i.test(R.m_catToGoal.b.answer)&&!/Groceries/i.test(R.m_catToGoal.b.answer), R.m_catToGoal.b.answer);
  ck('WREN-334','Memory','Boundaries','BOUNDARY: ambiguous NEW "car goal" ASKS — never reuses Vacation', /did you mean|which/i.test(R.m_ambigFollow.b.answer)&&!/Vacation/i.test(R.m_ambigFollow.b.answer), R.m_ambigFollow.b.answer);
  ck('WREN-335','Memory','Retrieval','SUPPORTED: explicit fresh entity overrides remembered (Emergency Fund)', /Emergency Fund/i.test(R.m_freshOverride.b.answer)&&!/Vacation/i.test(R.m_freshOverride.b.answer), R.m_freshOverride.b.answer);
  ck('WREN-336','Memory','Computation','SUPPORTED: "increase it to $500" resolves Vacation via the Decision Engine', R.m_pronoun.b.spy.evaluateDecision>0&&/Vacation/i.test(R.m_pronoun.b.answer), D('evaluateDecision>0 + Vacation',R.m_pronoun.b,{spy:R.m_pronoun.b.spy.evaluateDecision}));
  ck('WREN-337','Memory','Boundaries','BOUNDARY: latest claim overwrites — bare "why?" reflects over-budget (Mortgage +'+M(200)+'), not the goal', /mortgage/i.test(R.m_whyOverwrite.c.answer)&&has(R.m_whyOverwrite.c,M(200))&&!/Vacation/i.test(R.m_whyOverwrite.c.answer), D(M(200),R.m_whyOverwrite.c));

  // ============ PROVENANCE (sentinel — proves Wren USED the returned value) ============
  ck('WREN-400','Provenance','Computation','getGoalFacts value is echoed: balance $4,321.09 from the sentinel, not the real household', has(PROV.goal,'$4,321.09')&&!/\$2,000/.test(PROV.goal.answer), D('$4,321.09',PROV.goal));
  ck('WREN-401','Provenance','Computation','netWorthNow value is echoed: $42,424.24, not the real $14,600', has(PROV.nw,'$42,424.24')&&!has(PROV.nw,M(F.nw)), D('$42,424.24',PROV.nw));
  ck('WREN-402','Provenance','Computation','planMetrics low is echoed: −$55,555.55 from the sentinel', has(PROV.pm,'$55,555.55'), D('$55,555.55',PROV.pm));
  ck('WREN-403','Provenance','Computation','computeRollover uncovered is echoed: $4,455.55 from the sentinel', has(PROV.roll,'$4,455.55'), D('$4,455.55',PROV.roll));
  ck('WREN-404','Provenance','Computation','evaluateDecision after.low is echoed: $44,444.44 in the carried follow-up', has(PROV.dec,'$44,444.44'), D('$44,444.44',PROV.dec));

  // ---- report: two axes, never recombined; each capability separate; per-item release bar ----
  const CAP={
    'Goals':['Goals','Residual','Linked'], 'Spending':['Spending'], 'Income':['Income'],
    'Cash Flow/Decisions':['CashFlow','Time'], 'Worth/Debt':['Worth'], 'Contingency':['Contingency'],
    'As-of/Future-Date':['AsOf'], 'Entity Resolution':['Entity'], 'Follow-up Resolution':['FollowUp'],
    'Conversation Chains':['Chain'], 'Memory/Referent State':['Memory'], 'False-Premise Correction':['FalsePremise'],
    'Epistemic Boundaries':['Epistemic'], 'Product Behavior':['Product'], 'Provenance (narrator-only)':['Provenance']};
  const dom2cap={};Object.keys(CAP).forEach(c=>CAP[c].forEach(d=>dom2cap[d]=c));
  const byCap={},byDim={},byId={};
  out.forEach(r=>{const c=dom2cap[r.dom]||r.dom;(byCap[c]=byCap[c]||{p:0,f:0});(byDim[r.dim]=byDim[r.dim]||{p:0,f:0});(byId[r.id]=byId[r.id]||{p:0,f:0});
    r.ok?(byCap[c].p++,byDim[r.dim].p++,byId[r.id].p++):(byCap[c].f++,byDim[r.dim].f++,byId[r.id].f++);});
  let pass=0,fail=0;out.forEach(r=>{const ln='['+r.id+' · '+r.dom+'/'+r.dim+'] '+r.n;if(r.ok){pass++;}else{fail++;console.log('  FAIL '+ln+'\n        → '+JSON.stringify(r.det));}});
  const cases=Object.keys(byId),casesPass=cases.filter(id=>byId[id].f===0).length;
  const pad=(s,n)=>{s=''+s;return s+' '.repeat(Math.max(0,n-s.length));};
  const line=(label,v)=>{const tot=v.p+v.f;return pad(label,26)+pad(v.p+'/'+tot,9)+(v.f?'⚠ '+v.f+' FAILED':'✓');};
  console.log('\n  BY CAPABILITY (each reported separately — never merged into one release number)');
  Object.keys(CAP).forEach(c=>console.log('    '+line(c,byCap[c]||{p:0,f:0})));
  console.log('\n  BY QUALITY DIMENSION');
  ['Retrieval','Classification','Computation','Interpretation','Boundaries'].forEach(d=>console.log('    '+line(d,byDim[d]||{p:0,f:0})));
  if(errs.length)console.log('\n  page errors: '+errs.join(' | '));
  console.log('\n  OVERALL: '+casesPass+'/'+cases.length+' cases passed · '+pass+'/'+out.length+' assertions passed'+(fail?(' · '+fail+' FAILED'):''));
  // Release bar: trust capabilities + critical dimensions must each be 100% — flagged individually, never averaged.
  const gate=['Entity Resolution','False-Premise Correction','Epistemic Boundaries','Product Behavior','As-of/Future-Date','Provenance (narrator-only)'];
  const critDim=['Retrieval','Computation','Classification','Boundaries'];
  const breaches=gate.filter(c=>(byCap[c]||{f:0}).f>0).map(c=>'capability:'+c).concat(critDim.filter(d=>(byDim[d]||{f:0}).f>0).map(d=>'dimension:'+d));
  if(breaches.length)console.log('  ⚠ RELEASE-BAR BREACH (must be 100%): '+breaches.join(' · '));
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

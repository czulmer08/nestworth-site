/* GOLDEN INVARIANT TEST. One ledger, one set of hand-calculated truths, asserted against EVERY consumer — the classifier,
   the monthly-actuals engine, cash flow, annual plan, net worth, the Month headline, the Cash-flow screen, and the Nest
   Review. This is the test that catches "the formula is right in one place but a screen kept its own copy." */
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
  await page.waitForFunction(()=>typeof monthActualTotals==='function'&&typeof computeCashflow==='function'&&typeof buildNestReview==='function'&&typeof actualIE==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth();
    window.isGoalName=(n)=>((""+n).trim().toLowerCase()==='vacation');state.goalSet={vacation:1};

    /* THE SCENARIO (in July=M-1 and August=M): income $5,000; groceries $3,000; a $200 grocery refund; $400 unbudgeted
       (IKEA); $600 into the Vacation goal via Category; $250 into Vacation via Company.
       HAND-CALCULATED TRUTHS for each month:
         income          = 5000
         net expense      = 3000 - 200 + 400 = 3200   (refund nets down; goal moves are NOT spending)
         goal into Vacation = 600 + 250 = 850         (matched by Category OR Company)
         spendable-cash net = 5000 - 3200 - 850 = 950 (goal moves leave spendable cash)  */
    var rows=[];[M-1,M].forEach(function(mo){var d=Y+'-0'+mo+'-';
      rows.push([Y,mo,d+'01','Me','Deposit','Job',5000,'','N']);
      rows.push([Y,mo,d+'02','Me','Groceries','Store',3000,'','N']);
      rows.push([Y,mo,d+'03','Me','Groceries','Store',-200,'','N']);
      rows.push([Y,mo,d+'04','Me','','IKEA',400,'','N']);
      rows.push([Y,mo,d+'05','Me','Vacation','Move',600,'','N']);
      rows.push([Y,mo,d+'06','Me','Travel','Vacation',250,'','N']);});
    state.rows=rows;
    state.meta={startCash:0,floor:0,startYM:Y*100+1,cats:{},cons:{},goals:[]};state.carryIn={};
    state.cons=[{name:'Job',annual:60000,bud12:Array(12).fill(5000)}];
    state.cats=[{name:'Groceries',annual:36000,mbud:3000,mspent:3000,bud12:Array(12).fill(3000)}];
    state.goals=[{name:'Vacation',target:5000,balance:1000,monthly:0,archived:false,category:'',residual:false,account:''}];
    state.assets=[{name:'Checking',bal:10000}];state.debts=[{name:'Card',bal:2000}];try{buildIndexes();}catch(e){}

    var mi=M-1; // 0-based index for the CURRENT month M

    // 1) canonical classifier agrees on every row type
    var cls={dep:isExpenseRow(rows[0]),groc:isExpenseRow(rows[1]),credit:isExpenseRow(rows[2]),unbud:isExpenseRow(rows[3]),gcat:isExpenseRow(rows[4]),gco:isExpenseRow(rows[5])};
    var classOk=!cls.dep&&cls.groc&&cls.credit&&cls.unbud&&!cls.gcat&&!cls.gco;

    // 2) monthly-actuals engine
    var mt=monthActualTotals(Y,M);
    var mtOk=mt.income===5000&&mt.expense===3200;
    // 3) actualIE arrays
    var IE=actualIE(rows,Y);
    var ieOk=IE.ai[mi]===5000&&IE.ae[mi]===3200&&IE.ag[mi]===850;
    // 4) goal contribution (Category OR Company)
    var gcOk=goalContribMonth('Vacation',Y,M)===850;

    // 5) cash-flow engine: the current-month net = income − net expense − actual goal moves = 950
    var cf=computeCashflow(currentPlan(),{mode:'actual',includeGoalHold:true});
    var cfCur=cf.months[mi].net, cfPrev=cf.months[mi-1].net;
    var cfOk=Math.abs(cfCur-950)<0.5&&Math.abs(cfPrev-950)<0.5;

    // 6) the LIVE Cash-flow screen must show the SAME number (it now consumes computeCashflow)
    show('appScreen');state._stMode='actual';var screenNet=null;try{renderStress();var rowsEl=document.querySelectorAll('#stGrid .strow.sttap');if(rowsEl[mi]){screenNet=rowsEl[mi].querySelector('.stn').textContent;}}catch(e){}
    var screenOk=screenNet!==null&&screenNet.replace(/[^0-9.]/g,'')==='950.00';

    // 7) the Month headline must show Spent $3,200 / Income $5,000 (same monthly-actuals engine)
    var monthSpent=null,monthInc=null;try{renderMonth();var t=$("mTot").textContent;var m1=t.match(/Income\s*\$([0-9,]+\.\d\d)/);var m2=t.match(/Spent\s*\$([0-9,]+\.\d\d)/);monthInc=m1&&m1[1];monthSpent=m2&&m2[1];}catch(e){}
    var monthOk=monthSpent==='3,200.00'&&monthInc==='5,000.00';

    // 8) the Nest Review (reviews July=M-1) must agree: spend $3,200, and $850 moved to Vacation
    var rv=buildNestReview();
    var reviewOk=rv&&Math.abs(rv.spending.actual-3200)<0.5&&rv.goals.some(function(g){return g.name==='Vacation'&&Math.abs(g.added-850)<0.5;});

    // 9) Worth: net worth from the SAME assets/debts/standalone-goal set = $10,000 + $1,000 − $2,000 = $9,000
    var nw=netWorthNow();var worthOk=nw===9000;
    // 10) the Decision Engine baseline consumes the SAME net worth and the SAME cash-flow low/end (no independent copy)
    var base=evaluateDecision([]).before;
    var decOk=Math.abs(base.netNow-9000)<0.5&&Math.abs(base.end-cf.end)<0.5&&Math.abs(base.low-cf.low)<0.5;
    // 11) Budget's annual plan (actual mode) uses the SAME classifier — the $850/mo goal moves are NOT counted as budget.
    // Sanity-check the invariant directly: budget WITH goal moves wrongly included would be higher by 850 for each completed month.
    var ap=computeAnnualPlan(currentPlan(),{mode:'actual'});
    var IEy=actualIE(state.rows,Y);
    // Right = ordinary expense + category-LINKED goal allocation (agc, which consumed the category). Wrong = counting EVERY
    // goal move (ag) as budget. ap.budget must equal Right and differ from Wrong (proving standalone goal moves are excluded).
    var wrongExp=0,rightExp=0;for(var mm3=0;mm3<12;mm3++){var plan=3000;if(mm3<mi){rightExp+=IEy.ae[mm3]+IEy.agc[mm3];wrongExp+=IEy.ae[mm3]+IEy.ag[mm3];}else if(mm3===mi){rightExp+=Math.max(IEy.ae[mm3]+IEy.agc[mm3],plan);wrongExp+=Math.max(IEy.ae[mm3]+IEy.ag[mm3],plan);}else{rightExp+=plan;wrongExp+=plan;}}
    var budgetOk=Math.abs(ap.budget-r2(rightExp))<0.5 && Math.abs(ap.budget-r2(wrongExp))>0.5;
    // 12) Wren narrates the SAME monthly spend (she doesn't recompute it)
    var wrenSpend=null;try{var wa=wrenAnalyze("how much have I spent this month");wrenSpend=wa&&wa.answer;}catch(e){}
    var wrenOk=wrenSpend!==null&&wrenSpend.indexOf('3,200.00')>=0;

    return {cls,classOk,mt,mtOk,ieOk,gcOk,cfCur,cfPrev,cfOk,screenNet,screenOk,monthSpent,monthInc,monthOk,reviewOk,rv:rv&&{sp:rv.spending.actual},nw,worthOk,base:{net:base.netNow,end:base.end,low:base.low},decOk,ap,budgetOk,wrenSpend,wrenOk};
  });

  ck('classifier: deposit=income, refund=expense, unbudgeted=expense, goal-via-Category AND goal-via-Company excluded', res.classOk, JSON.stringify(res.cls));
  ck('monthly-actuals engine: income $5,000, net expense $3,200', res.mtOk, JSON.stringify(res.mt));
  ck('actualIE: income 5000 / expense 3200 / goal-moves 850', res.ieOk, String(res.ieOk));
  ck('goalContribMonth(Vacation) = 850 (Category + Company)', res.gcOk, String(res.gcOk));
  ck('cash-flow engine: spendable-cash net = $950 in both months', res.cfOk, JSON.stringify({cur:res.cfCur,prev:res.cfPrev}));
  ck('LIVE Cash-flow screen shows the SAME $950 (consumes computeCashflow)', res.screenOk, JSON.stringify(res.screenNet));
  ck('Month headline shows Spent $3,200 / Income $5,000 (same engine)', res.monthOk, JSON.stringify({spent:res.monthSpent,inc:res.monthInc}));
  ck('Nest Review agrees: $3,200 spent, $850 to Vacation (includes unbudgeted + Company-tagged goal)', res.reviewOk, JSON.stringify(res.rv));
  ck('Worth: net worth = $9,000 from the same assets/debts/standalone goal', res.worthOk, JSON.stringify(res.nw));
  ck('Decision Engine baseline consumes the same net worth + cash-flow low/end', res.decOk, JSON.stringify(res.base));
  ck('Budget annual plan uses the same classifier (goal moves excluded from budget)', res.budgetOk, JSON.stringify(res.ap));
  ck('Wren narrates the same $3,200 monthly spend (does not recompute it)', res.wrenOk, JSON.stringify(res.wrenSpend).slice(0,120));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* ITEM-UB — ONE authoritative "is this ledger row represented by the budget?" definition, shared by budget-USED and UNBUDGETED so
   they can never drift apart (v0.68.58). This is the class of bug that produced the user's screenshot: itemized child spend counted
   INSIDE its parent's "used" AND AGAIN as "outside budget", yielding "74% used yet over budget". The lockdown routes every surface
   through budgetedNameSet()/isBudgetedName() — unbudgetedConsumption, the Month headline (renderS2S), the "outside budget" breakdown,
   the "pull into budget" candidates (ledgerUnbudgeted), and WREN'S unbudgeted answer (which still had its own top-level-only set).
   The strongest case is ITEM-UB-008: total consumption == budget-represented + genuinely-unbudgeted, the two sets mutually exclusive.
   The reproduction case drives the REAL Month headline and asserts a coherent story (74% used, NOT over) — the mutation that reverts
   child recognition flips it to the exact absurd "over budget" the user saw. */
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
  await page.waitForFunction(()=>typeof budgetedNameSet==='function'&&typeof isBudgetedName==='function'&&typeof unbudgetedConsumption==='function'&&typeof renderS2S==='function'&&typeof wrenAnalyze==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    var expense=function(day,cat,who,amt){return [2026,8,'2026-08-'+String(day).padStart(2,'0'),'',cat,who,amt,'',''];}; // month column is ALWAYS 8 (August); arg is the day
    // ---------- Base itemized budget: Utilities → Electricity/Water/Gas · Children → Baby Z/Baby B · Rent (top-level) · Food (top-level) ----------
    function build(rows,extra){
      state.cons=[{name:'Pay',bud12:fill(12000),annual:144000}];
      state.cats=[
        {name:'Utilities',mbud:400,bud12:fill(400),annual:4800},
        {name:'Children',mbud:1000,bud12:fill(1000),annual:12000},
        {name:'Rent',mbud:2000,bud12:fill(2000),annual:24000},
        {name:'Food',mbud:600,bud12:fill(600),annual:7200}
      ];
      state.goals=[];state.assets=[];state.debts=[];state.rows=rows||[];
      state.meta={cats:{
        "utilities":{type:'itemized',items:[{name:'Electricity'},{name:'Water'},{name:'Gas'}]},
        "children":{type:'itemized',items:[{name:'Baby Z'},{name:'Baby B'}]}
      },cons:{},goals:[],payees:['Me'],floor:0,startCash:0,prefs:{},hiddenCats:[]};
      if(extra)extra();
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    // ITEM-UB-001: child Electricity under Utilities → counted once in Utilities, $0 unbudgeted.
    build([expense(3,'Electricity','Georgia Power',150)]);
    Rz.ub001={inSet:isBudgetedName('Electricity'),unbud:unbudgetedConsumption(),inParent:catSpend12('Utilities')[7]};
    // ITEM-UB-002: "↳ Electricity" representation → same result.
    build([expense(3,'↳ Electricity','Georgia Power',150)]);
    Rz.ub002={inSet:isBudgetedName('↳ Electricity'),unbud:unbudgetedConsumption(),inParent:catSpend12('Utilities')[7]};
    // ITEM-UB-003: multiple children under one parent → summed once (into the parent), none unbudgeted.
    build([expense(3,'Electricity','GP',150),expense(4,'Water','County',60),expense(5,'Gas','GasSouth',40),expense(6,'Baby Z','Target',120)]);
    Rz.ub003={unbud:unbudgetedConsumption(),utils:catSpend12('Utilities')[7],kids:catSpend12('Children')[7]};
    // ITEM-UB-004: genuinely unknown Parking → unbudgeted once.
    build([expense(3,'Parking','City Lot',30)]);
    Rz.ub004={inSet:isBudgetedName('Parking'),unbud:unbudgetedConsumption()};
    // ITEM-UB-005: blank category → unbudgeted once.
    build([expense(3,'','Amazon',25)]);
    Rz.ub005={blankNotBudgeted:isBudgetedName(''),unbud:unbudgetedConsumption()};
    // ITEM-UB-006: renamed child retains budget membership (recognized by its CURRENT name; the stale old name is not).
    build([expense(3,'Electric Bill','GP',150)],function(){state.meta.cats.utilities.items=[{name:'Electric Bill'},{name:'Water'},{name:'Gas'}];});
    Rz.ub006={newName:isBudgetedName('Electric Bill'),oldName:isBudgetedName('Electricity'),unbud:unbudgetedConsumption(),inParent:catSpend12('Utilities')[7]};
    // ITEM-UB-007: a HIDDEN category that STILL has a budget line is budgeted (product decision) — its spend is NOT "outside budget".
    build([expense(3,'Food','Publix',75)],function(){state.meta.hiddenCats=['Food'];});
    Rz.ub007={hidden:(typeof catHidden==='function')?catHidden('food'):null,stillBudgeted:isBudgetedName('Food'),unbud:unbudgetedConsumption()};
    // ITEM-UB-008: budget-USED + genuinely-UNBUDGETED reconciles EXACTLY to total consumption, sets mutually exclusive.
    build([expense(3,'Electricity','GP',150),expense(4,'Water','County',60),expense(5,'Rent','Landlord',2000),expense(6,'Parking','City',30),expense(7,'','Amazon',25)]);
    var C=monthActualTotals(2026,8).expense;                              // canonical TOTAL consumption
    var budgetRep=0;(state.cats||[]).forEach(function(c){budgetRep+=catSpend12(c.name)[7];}); // sum of budget-USED across categories
    var unb=unbudgetedConsumption();
    Rz.ub008={total:C,budgetRep:r2(budgetRep),unbud:unb,identity:near(C,r2(budgetRep+unb)),expectBud:2210,expectUnb:55};
    // CROSS-SURFACE: Wren's unbudgeted answer must speak from the SAME set — $0 here (all logged rows are budgeted children/parents).
    build([expense(3,'Electricity','GP',150),expense(4,'Baby Z','Target',120),expense(5,'Rent','Landlord',2000)]);
    Rz.wrenZero={ans:wrenAnalyze('how much did I spend unbudgeted this month')};
    // and it reports the real figure when there genuinely is outside-budget spend
    build([expense(3,'Electricity','GP',150),expense(6,'Parking','City',30),expense(7,'','Amazon',25)]);
    Rz.wrenSome={ans:wrenAnalyze('what did I spend outside my budget this month')};
    // REPRODUCTION of the screenshot: Budgeted $9,824.50 · Used $7,270.96 (incl. $3,103.43 itemized-child spend) · $0 truly unbudgeted.
    // Correct → "$2,553.54 left", 74% used, NOT over. The child-recognition mutation flips this to "$549.89 over" at the same 74%.
    build([expense(3,'Electricity','GP',1500),expense(4,'Water','County',903.43),expense(5,'Gas','GasSouth',700),expense(6,'Rent','Landlord',4167.53)],function(){
      state.cats=[
        {name:'Utilities',mbud:3500,bud12:fill(3500),annual:42000},
        {name:'Rent',mbud:4500,bud12:fill(4500),annual:54000},
        {name:'Food',mbud:1824.50,bud12:fill(1824.50),annual:21894}
      ];
      state.meta.cats={"utilities":{type:'itemized',items:[{name:'Electricity'},{name:'Water'},{name:'Gas'}]}};
    });
    if($("s2s")){renderS2S();}var html=($("s2s")&&$("s2s").innerHTML)||"";
    Rz.repro={html:html,notOver:!/over this month.?s budget/.test(html),hasLeft:/left in this month.?s budget/.test(html),
      pct74:/74% used/.test(html),leftAmt:/\$2,553\.54/.test(html),noOutside:!/spent outside budget/.test(html),
      totals:/\$9,824\.50 budgeted · \$7,270\.96 used/.test(html)};
    return Rz;
  });

  ck('ITEM-UB-001 · child "Electricity" is budgeted (counts once in Utilities), $0 unbudgeted',
     R.ub001.inSet&&near(R.ub001.unbud,0)&&near(R.ub001.inParent,150), JSON.stringify(R.ub001));
  ck('ITEM-UB-002 · the "↳ Electricity" arrow form → same result (budgeted, $0 unbudgeted, counts in the parent)',
     R.ub002.inSet&&near(R.ub002.unbud,0)&&near(R.ub002.inParent,150), JSON.stringify(R.ub002));
  ck('ITEM-UB-003 · multiple children under one parent are summed once, none unbudgeted (Utilities $250, Children $120)',
     near(R.ub003.unbud,0)&&near(R.ub003.utils,250)&&near(R.ub003.kids,120), JSON.stringify(R.ub003));
  ck('ITEM-UB-004 · a genuinely unknown "Parking" is unbudgeted once ($30)',
     !R.ub004.inSet&&near(R.ub004.unbud,30), JSON.stringify(R.ub004));
  ck('ITEM-UB-005 · a blank category is unbudgeted once ($25) and never counted as budgeted',
     R.ub005.blankNotBudgeted===false&&near(R.ub005.unbud,25), JSON.stringify(R.ub005));
  ck('ITEM-UB-006 · a renamed child keeps budget membership by its CURRENT name (stale old name is not budgeted)',
     R.ub006.newName===true&&R.ub006.oldName===false&&near(R.ub006.unbud,0)&&near(R.ub006.inParent,150), JSON.stringify(R.ub006));
  ck('ITEM-UB-007 · a HIDDEN category that still has a budget line is budgeted (its $75 is NOT outside budget)',
     R.ub007.hidden===true&&R.ub007.stillBudgeted===true&&near(R.ub007.unbud,0), JSON.stringify(R.ub007));
  ck('ITEM-UB-008 · total consumption == budget-represented + unbudgeted, mutually exclusive ($2,265 = $2,210 + $55)',
     R.ub008.identity&&near(R.ub008.budgetRep,2210)&&near(R.ub008.unbud,55)&&near(R.ub008.total,2265), JSON.stringify(R.ub008));
  ck('cross-surface · Wren reports $0 unbudgeted when every logged row is a budgeted child/parent (matches the Month headline)',
     /No unbudgeted spending/.test(R.wrenZero.ans&&R.wrenZero.ans.answer||''), JSON.stringify(R.wrenZero.ans));
  ck('cross-surface · Wren reports the real figure ($55) when there IS outside-budget spend',
     /\$55\.00/.test(R.wrenSome.ans&&R.wrenSome.ans.answer||''), JSON.stringify(R.wrenSome.ans));
  ck('REPRODUCTION · the Month headline tells one coherent story: 74% used, "$2,553.54 left", NOT over, nothing outside budget',
     R.repro.notOver&&R.repro.hasLeft&&R.repro.pct74&&R.repro.leftAmt&&R.repro.noOutside&&R.repro.totals,
     JSON.stringify({notOver:R.repro.notOver,hasLeft:R.repro.hasLeft,pct74:R.repro.pct74,leftAmt:R.repro.leftAmt,noOutside:R.repro.noOutside,totals:R.repro.totals}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: one budget-membership definition drives used AND unbudgeted on every surface — the "74% used yet over budget" contradiction cannot recur.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

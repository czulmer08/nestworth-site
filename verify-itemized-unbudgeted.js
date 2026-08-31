/* ITEMIZED SUB-ITEMS ARE BUDGETED, NOT "OUTSIDE BUDGET" (v0.68.53). An itemized category (Utilities → Electricity/Water/Gas)
   counts a ledger row tagged with a SUB-ITEM name toward its parent's spend (catSpend12/catBills). The bug: the "unbudgeted" checks
   (unbudgetedConsumption + the Add-screen renderS2S banner) recognized only TOP-LEVEL names, so a sub-item row was counted TWICE —
   in its parent's "used" AND as "spent outside budget" — inflating the total to a false "over budget" and a phantom unbudgeted figure.
   This proves budgetedNameSet() includes the sub-items, both unbudgeted paths use it, and only genuinely-outside rows remain. */
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
  await page.waitForFunction(()=>typeof unbudgetedConsumption==='function'&&typeof budgetedNameSet==='function'&&typeof renderS2S==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // Budget: itemized Utilities (Electricity/Water/Gas) + plain Food. This month: sub-item rows Electricity $150, Water $80, Gas $60,
    // "↳ Water" $20 (the arrow form), Food $200 (top-level) — all BUDGETED. Mortgage $2,000 + a blank-category $50 — genuinely outside.
    state.cons=[{name:'Pay',bud12:fill(9000),annual:108000}];
    state.cats=[{name:'Utilities',mbud:400,mspent:310,mused:310,bud12:fill(400),annual:4800},{name:'Food',mbud:500,mspent:200,mused:200,bud12:fill(500),annual:6000}];
    state.goals=[];state.assets=[];state.debts=[];
    state.rows=[
      [2026,8,'2026-08-03','','Electricity','Georgia Power',150,'',''],
      [2026,8,'2026-08-04','','Water','County Water',80,'',''],
      [2026,8,'2026-08-05','','Gas','Gas South',60,'',''],
      [2026,8,'2026-08-06','','↳ Water','County Water',20,'',''],
      [2026,8,'2026-08-07','','Food','Publix',200,'',''],
      [2026,8,'2026-08-08','','Mortgage','Bank',2000,'',''],
      [2026,8,'2026-08-09','','','Amazon',50,'','']
    ];
    state.meta={cats:{"utilities":{type:'itemized',items:[{name:'Electricity'},{name:'Water'},{name:'Gas'}]}},cons:{},goals:[],payees:['Me'],floor:0,startCash:0,prefs:{}};
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var set=budgetedNameSet();
    renderS2S();var html=$("s2s").innerHTML;
    return {
      setHasParent:!!set['utilities']&&!!set['food'],
      setHasSubs:!!set['electricity']&&!!set['water']&&!!set['gas']&&!!set['↳ water'],
      unbud:unbudgetedConsumption(),                       // should be Mortgage $2,000 + blank $50 = $2,050 (NOT the $310 of sub-items)
      bannerOutside:/\$2,050\.00 spent outside budget/.test(html),
      breakdownExcludesSubs:!/Electricity/.test((html.split('See the')[1]||''))&&!/>Water</.test((html.split('See the')[1]||'')),
      breakdownHasMortgage:/Mortgage/.test((html.split('See the')[1]||''))
    };
  });

  ck('budgetedNameSet() includes the top-level names (Utilities, Food)', R.setHasParent, 'setHasParent='+R.setHasParent);
  ck('budgetedNameSet() ALSO includes the itemized sub-item names (Electricity, Water, Gas) and the "↳ " form', R.setHasSubs, 'setHasSubs='+R.setHasSubs);
  ck('unbudgetedConsumption() = $2,050 (Mortgage + blank) — the $310 of sub-item rows is NOT double-counted as unbudgeted',
     near(R.unbud,2050), 'unbud='+R.unbud+' (was $2,360 before the fix)');
  ck('the Add-screen banner shows "$2,050.00 spent outside budget" (only the genuinely-outside rows)', R.bannerOutside, '');
  ck('the "spent outside budget" breakdown EXCLUDES the sub-item rows (Electricity/Water) and includes the real one (Mortgage)',
     R.breakdownExcludesSubs&&R.breakdownHasMortgage, JSON.stringify({excl:R.breakdownExcludesSubs,mort:R.breakdownHasMortgage}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: a ledger row tagged with an itemized sub-item name is budgeted once (toward its parent) — never double-counted as "outside budget".');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

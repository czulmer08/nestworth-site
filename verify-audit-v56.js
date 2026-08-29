/* Verify the v0.56 deep-audit fixes: as-of cutoff centralized to every actuals path; P+A registers completed fixed-goal
   over/under-funding; renderFeas consumes the shared annual engine; S2S subtracts unbudgeted; secondary analytics use the
   canonical classifier; edited rows are sanitized. */
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
  await page.waitForFunction(()=>typeof computeAnnualPlan==='function'&&typeof actualIE==='function'&&typeof catSpend12==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var R=[];function ok(n,v,d){R.push({n:n,ok:!!v,d:d||''});}
    curYear=function(){return 2026;};bYear=function(){return 2026;};todayISO=function(){return '2026-08-15';};
    var row=function(y,m,d,who,cat,co,amt){return [y,m,d,who,cat,co,amt,'','N'];};
    function reset(){state.meta={startCash:0,floor:0,cats:{},cons:{},goals:[]};state.cons=[];state.cats=[];state.goals=[];state.goalSet={};state.assets=[];state.debts=[];state.rows=[];state.carryIn={};state.spend={};state.dep={};}

    // 1) P+A registers completed fixed-goal OVERFUNDING (agf): plan $500/mo, Jan overfunded to $1,000 → surplus $500 lower
    reset();curMonth=function(){return 3;}; // March: Jan, Feb completed
    state.goalSet={ef:1};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='ef';};
    state.cons=[{name:'Job',bud12:Array(12).fill(2000)}];state.cats=[{name:'Living',bud12:Array(12).fill(0)}];
    state.goals=[{name:'EF',monthly:500,balance:0,target:0,category:'',residual:false,archived:false}];
    state.rows=[row(2026,1,'2026-01-01','','Deposit','Job',2000),row(2026,1,'2026-01-05','','EF','',1000),row(2026,2,'2026-02-01','','Deposit','Job',2000),row(2026,2,'2026-02-05','','EF','',500)]; // income on plan; Jan goal overfunded +500
    var apPlan=computeAnnualPlan(currentPlan(),{mode:'plan'}),apAct=computeAnnualPlan(currentPlan(),{mode:'actual'});
    ok('1 P+A actual surplus is $500 lower than plan (Jan overfunding registers)',Math.abs((apPlan.surplus-apAct.surplus)-500)<0.5,JSON.stringify({plan:apPlan.surplus,actual:apAct.surplus}));
    curYear=function(){return 2026;};

    // 2) renderFeas consumes the shared engine — its actual-mode surplus equals computeAnnualPlan(actual)
    reset();curMonth=function(){return 8;};state._stMode='actual';
    state.goalSet={vac:1};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='vac';};
    state.cons=[{name:'Job',bud12:Array(12).fill(5000),annual:60000}];
    state.cats=[{name:'Living',bud12:Array(12).fill(3000),annual:36000,mbud:3000,mspent:0}];
    state.goals=[{name:'Vac',monthly:0,balance:0,category:'Living',residual:false,archived:false}];
    state.rows=[row(2026,7,'2026-07-01','','Deposit','Job',5000),row(2026,7,'2026-07-06','','Living','Vac',500)]; // July: $500 category-linked goal move
    try{buildIndexes();}catch(e){}
    var apF=computeAnnualPlan(currentPlan(),{mode:'actual'});
    var feasSurplus=null;try{show('appScreen');renderFeas();var ft=$("feasBody").textContent;var mm=ft.match(/([\d,]+\.\d\d)\s*\/yr (surplus|gap)/);if(mm)feasSurplus=(/gap/.test(mm[2])?-1:1)*parseFloat(mm[1].replace(/,/g,''));}catch(e){}
    ok('2 renderFeas surplus equals computeAnnualPlan(actual) surplus',feasSurplus!==null&&Math.abs(feasSurplus-apF.surplus)<0.5,JSON.stringify({feas:feasSurplus,engine:apF.surplus}));
    // and the July category-linked $500 is preserved in the completed-month budget (without agc it'd be $500 lower)
    var apF_noAgc=15000; // Jul completed=0(ae only), Aug current=3000, Sep–Dec=12000 → 15000 if the linked $500 were dropped
    ok('2 completed category-linked goal allocation ($500) is preserved in P+A budget',Math.abs(apF.budget-(apF_noAgc+500))<0.5,JSON.stringify(apF.budget));

    // 3) S2S "left this month" SUBTRACTS unbudgeted spending
    reset();curMonth=function(){return 8;};window.isGoalName=function(){return false;};
    state.cats=[{name:'Food',mbud:1000,mspent:400,bud12:Array(12).fill(1000)}];state.cons=[];state.goals=[];
    state.rows=[row(2026,8,'2026-08-01','','Food','X',400),row(2026,8,'2026-08-02','','','IKEA',250)]; // $250 unbudgeted
    try{buildIndexes();}catch(e){}
    var s2sTxt=null;try{show('appScreen');renderS2S();s2sTxt=$("s2s").textContent;}catch(e){}
    // budget 1000 − spent 400 − unbudgeted 250 = 350 left
    ok('3 S2S left subtracts unbudgeted spending ($350 left, not $600)',s2sTxt&&/\$350\.00 left/.test(s2sTxt),JSON.stringify(s2sTxt&&s2sTxt.slice(0,80)));

    // 4) As-of cutoff is centralized: a future-dated current-month row is excluded from catSpend12 AND goalContribMonth
    reset();curMonth=function(){return 8;};state.goalSet={car:1};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='car';};
    state.cats=[{name:'Food',bud12:Array(12).fill(0)}];
    state.rows=[row(2026,8,'2026-08-10','','Food','X',100),row(2026,8,'2026-08-20','','Food','X',999),row(2026,8,'2026-08-11','','Car','',300),row(2026,8,'2026-08-25','','Car','',777)];
    try{buildIndexes();}catch(e){}
    ok('4 catSpend12 excludes the future-dated (Aug 20 > as-of Aug 15) $999',Math.abs((catSpend12('Food')[7]||0)-100)<0.5,JSON.stringify(catSpend12('Food')[7]));
    ok('4 goalContribMonth excludes the future-dated (Aug 25) $777',Math.abs(goalContribMonth('Car',2026,8)-300)<0.5,JSON.stringify(goalContribMonth('Car',2026,8)));

    // 5) Insights series + topCats exclude a category-linked goal move (Category=Travel, Company=Vacation)
    reset();curMonth=function(){return 8;};state.goalSet={vacation:1};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='vacation';};
    state.rows=[row(2026,8,'2026-08-01','','Travel','Vacation',500),row(2026,8,'2026-08-02','','Food','Store',80)];
    var is=insSeries();
    ok('5 insSeries excludes the category-linked goal move',Math.abs((is.byCat['Travel']||0))<0.01&&Math.abs((is.byCat['Food']||0)-80)<0.5,JSON.stringify(is.byCat));

    // 6) budget USED = consumption + category-linked goal allocation (fixes overstated "left this month")
    reset();curMonth=function(){return 8;};state.goalSet={vacation:1};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='vacation';};
    state.cats=[{name:'Living',bud12:Array(12).fill(700),annual:8400,mbud:700}];state.cons=[];
    state.goals=[{name:'Vacation',monthly:0,balance:0,category:'Living',residual:false,archived:false}];
    state.rows=[row(2026,8,'2026-08-01','','Living','Store',200),row(2026,8,'2026-08-05','','Living','Vacation',500)]; // $200 spent + $500 to a Living-linked goal
    try{buildIndexes();applyBudgetSpend();}catch(e){}
    var lc=state.cats[0];
    ok('6 consumption (mspent) = $200; budget used (mused) = $700',Math.abs(lc.mspent-200)<0.5&&Math.abs(lc.mused-700)<0.5,JSON.stringify({mspent:lc.mspent,mused:lc.mused}));
    ok('6 "left this month" = mbud − mused = $0, not the overstated $500',Math.abs(lc.mbud-lc.mused)<0.5);

    return {R};
  });

  res.R.forEach(function(r){ck(r.n,r.ok,r.d);});
  // static: edited rows sanitized, changelog current
  ck('saveEdit sanitizes edited user text before the write',/var nv=sanitizeRow\(/.test(src),'');
  ck('inline changelog includes the current VERSION',(function(){var m=src.match(/var VERSION="([\d.]+)"/);return m&&src.indexOf('v'+m[1]+' ')>=0;})(),'');
  ck('ledgerRowMatches treats a read failure as NOT verified',/catch\(e\)\{return false;\}\} \/\/ a read failure/.test(src),'');

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  PAGE ERRORS: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed'+(errs.length?(' ('+errs.length+' page errors)'):'')+'.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

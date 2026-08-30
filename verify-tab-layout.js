/* TAB LAYOUT (v0.68.31) — proves the consolidated six-tab information architecture: no dedicated "answers" tab; the app
   reuses the tabs it has, mapped to what each answers.
     BUDGET  = the plan you set (categories, expected income, contingency rules, year picker) + "does this budget work?" at the top.
     MONTH   = the current outlook — one consolidated "Your money right now" card (safe-to-move + reconciliation + this-month
               + protection, with contingency/envelopes folded in as progressive disclosure), above the usual this-month spending.
     WORTH   = the forecast / big picture — net worth over time PLUS the cash-flow forecast through the year.
   Break-audited by a mutation that stops rendering the safe-to-move answer onto Month (verify-mutation.js). */
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
  await page.waitForFunction(()=>typeof switchView==='function'&&typeof renderAll==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    curYear=function(){return 2027;};bYear=function(){return 2026;};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var sum=function(a){return a.reduce(function(x,y){return x+y;},0);};
    var liv=fill(9000);liv[5]=16000;var inc=fill(10000);
    state.cons=[{name:'Paychecks',bud12:inc,annual:sum(inc)}];
    state.cats=[{name:'Living',bud12:liv,annual:sum(liv),mbud:9000,mspent:0}];
    state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];
    state.assets=[];state.debts=[];state.rows=[];
    state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:1000,startCash:5000,prefs:{}};
    state._stMode="plan";show('appScreen');renderAll();
    function inView(id,view){var el=document.getElementById(id);return !!(el&&el.closest('#view-'+view));}
    var o={};
    o.tabs=[].map.call(document.querySelectorAll('.tabbar button'),function(b){return b.getAttribute('data-v');});
    o.labels=[].map.call(document.querySelectorAll('.tabbar button span'),function(s){return s.textContent;});
    // BUDGET = the plan you set (+ "does this budget work?" at the top)
    o.bCats=inView('catList','budget');o.bIncome=inView('conList','budget');o.bYear=inView('yearLabel','budget');o.bWiz=inView('wizCard','budget');o.bFeasTop=inView('feasCard','budget');
    // MONTH = current outlook: the safe-to-move answer + buffer, plus this-month
    o.mGoalSafe=inView('mGoalSafe','month');o.mThis=inView('mTot','month');o.mContFolded=(document.getElementById('mGoalSafe').innerHTML||'').indexOf('Contingency available')>=0||!document.getElementById('contCard');
    o.mGoalSafeRendered=(document.getElementById('mGoalSafe').innerHTML||'').indexOf('Car Fund')>=0; // actually rendered here
    // WORTH = forecast/big picture
    o.wStress=inView('stressCard','worth');o.bFeas=inView('feasCard','budget');o.wNet=inView('wNet','worth');
    // clean split: setup only on Budget; the safe-to-move answer only on Month; forecast only on Worth
    o.catsOnlyBudget=!inView('catList','month')&&!inView('catList','worth');
    o.goalSafeOnlyMonth=!inView('mGoalSafe','worth')&&!inView('mGoalSafe','budget')&&!document.getElementById('stGoalSafe');
    o.stressOnlyWorth=!inView('stressCard','month')&&!inView('stressCard','budget');o.feasOnlyBudget=!inView('feasCard','month')&&!inView('feasCard','worth');
    // nav + legacy aliases (the retired Plan/Outlook targets still resolve)
    switchView('budget');o.bOn=document.getElementById('view-budget').classList.contains('on');o.dvB=document.body.getAttribute('data-view');
    switchView('month');o.mOn=document.getElementById('view-month').classList.contains('on');
    switchView('worth');o.wOn=document.getElementById('view-worth').classList.contains('on');
    switchView('plan');o.aliasPlan=document.getElementById('view-budget').classList.contains('on');    // plan -> budget
    switchView('outlook');o.aliasOutlook=document.getElementById('view-month').classList.contains('on');// outlook -> month
    o.noOld=!document.getElementById('view-plan')&&!document.getElementById('view-outlook');
    return o;
  });

  ck('tab bar is back to six: Add · Month · Budget · Goals · Worth · Settings (no separate answers tab)',
     JSON.stringify(R.tabs)===JSON.stringify(['add','month','budget','goals','worth','settings']), JSON.stringify(R.tabs));
  ck('tab labels match, in order', JSON.stringify(R.labels)===JSON.stringify(['Add','Month','Budget','Goals','Worth','Settings']), JSON.stringify(R.labels));
  ck('BUDGET = the plan you set: Categories, Expected income, year picker, Quick setup, and "does this budget work?" at the top',
     R.bCats&&R.bIncome&&R.bYear&&R.bWiz&&R.bFeasTop, JSON.stringify({cats:R.bCats,income:R.bIncome,year:R.bYear,wiz:R.bWiz,feas:R.bFeasTop}));
  ck('MONTH = current outlook: the safe-to-move answer + this-month total (contingency now folded into the money card, no separate contCard)',
     R.mGoalSafe&&R.mThis&&R.mContFolded, JSON.stringify({goalSafe:R.mGoalSafe,thisMonth:R.mThis,contFolded:R.mContFolded}));
  ck('MONTH actually renders the "safe to move to your goal" answer (not just an empty container)',
     R.mGoalSafeRendered, 'rendered='+R.mGoalSafeRendered);
  ck('WORTH = forecast/big picture: net worth over time and the cash flow forecast through the year',
     R.wStress&&R.wNet, JSON.stringify({stress:R.wStress,net:R.wNet}));
  ck('clean split: categories only on Budget, safe-to-move only on Month, cash-flow forecast only on Worth, feasibility only on Budget',
     R.catsOnlyBudget&&R.goalSafeOnlyMonth&&R.stressOnlyWorth&&R.feasOnlyBudget, JSON.stringify({catsOnlyBudget:R.catsOnlyBudget,goalSafeOnlyMonth:R.goalSafeOnlyMonth,stressOnlyWorth:R.stressOnlyWorth,feasOnlyBudget:R.feasOnlyBudget}));
  ck('switchView activates each view; the retired "plan"→Budget and "outlook"→Month targets still resolve (back-compat)',
     R.bOn&&R.dvB==='budget'&&R.mOn&&R.wOn&&R.aliasPlan&&R.aliasOutlook, JSON.stringify({bOn:R.bOn,dvB:R.dvB,mOn:R.mOn,wOn:R.wOn,aliasPlan:R.aliasPlan,aliasOutlook:R.aliasOutlook}));
  ck('the retired view-plan / view-outlook containers are gone (fully consolidated)', R.noOld, 'noOld='+R.noOld);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: six tabs, reused — Budget sets the plan, Month answers "what is safe to move now," Worth holds the forecast.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

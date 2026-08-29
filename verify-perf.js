/* PERFORMANCE BENCHMARK — a repeatable synthetic scale test at 1k / 10k / 25k / 50k / 100k ledger rows. It times the
   expensive paths (index construction, Month / Budget-table / Goals / Worth renders, Nest Review, a Wren query) so a later
   build can't silently become several times slower without us noticing.
   SCOPE: these are HEADLESS-CHROMIUM timings in a cloud container. They are a REGRESSION BASELINE only — they do NOT
   represent iPhone-class hardware and do NOT prove the app "feels native." The value is relative (v_next vs this baseline),
   not absolute. The gross ceilings below exist only to catch a catastrophic (multi-x) regression, not to certify UX. */
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
  await page.waitForFunction(()=>typeof buildIndexes==='function'&&typeof renderMonth==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const rows=[1000,10000,25000,50000,100000];
  const table=[];
  for(const N of rows){
    const t=await page.evaluate(function(N){
      curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
      // a realistic household: 10 categories, 2 income lines, 5 goals
      var CATS=["Groceries","Mortgage","Travel","Dining","Utilities","Gas","Kids","Health","Shopping","Subscriptions"];
      state.meta={startCash:5000,floor:2000,cats:{},cons:{}};
      state.cons=[{name:"Denzell",annual:53733,mtarget:6200,bud12:[4133,4133,4133,4133,4133,4133,4133,6200,4133,4133,4133,6200]},{name:"Me",annual:36000,mtarget:3000,bud12:[3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000]}];
      state.cats=CATS.map(function(n){return {name:n,mbud:500,mspent:0,mused:0,annual:6000,bud12:[500,500,500,500,500,500,500,500,500,500,500,500]};});
      state.goalSet={vacation:1,car:1,emergency:1,home:1,boat:1};window.isGoalName=function(x){return !!state.goalSet[(""+x).trim().toLowerCase()];};
      state.goals=[{name:"Vacation",target:5000,balance:2000,monthly:300,category:"Travel"},{name:"Car",target:12000,balance:3000,monthly:800,residual:true,residualPct:80},{name:"Emergency",target:3000,balance:3000,monthly:0},{name:"Home",target:20000,balance:5000,monthly:400,account:"Savings"},{name:"Boat",target:9000,balance:500,monthly:100,archived:true}];
      state.assets=[{name:"Checking",bal:15000},{name:"Savings",bal:5000}];state.debts=[{name:"Loan",bal:15000}];
      state.nwHist=[{ym:202607,assets:19000,debts:15500,net:3500},{ym:202608,assets:20000,debts:15000,net:5000}];
      // generate N ledger rows across 3 years, all categories, deposits, goal moves
      var comps=["Store","Amazon","Airline","Cafe","Utility Co","Gas Stn","Target","Clinic","Shop","Netflix"];
      var rr=new Array(N);
      for(var i=0;i<N;i++){var yr=2024+(i%3),mo=1+(i%12),day=1+(i%27),iso=yr+"-"+("0"+mo).slice(-2)+"-"+("0"+day).slice(-2);
        var kind=i%9;
        if(kind===0)rr[i]=[yr,mo,iso,(i%2?"Denzell":"Me"),"Deposit","",2066.67,"","N"];
        else if(kind===1)rr[i]=[yr,mo,iso,"","Travel","Vacation",150,"","N"]; // goal move
        else rr[i]=[yr,mo,iso,"",CATS[i%10],comps[i%10],20+(i%400),"","N"];
      }
      state.rows=rr;state.carryIn={};state.spend={};state.dep={};
      function ms(f){var t0=performance.now();try{f();}catch(e){}return Math.round((performance.now()-t0));}
      var r={N:N};
      r.buildIndexes=ms(function(){buildIndexes();});
      r.applyBudget=ms(function(){applyBudgetSpend();});
      r.loadGoals=ms(function(){loadGoals();});
      r.month=ms(function(){show('appScreen');renderMonth();});
      r.budgetTbl=ms(function(){renderCatTbl();});
      r.goals=ms(function(){renderGoals();});
      r.worth=ms(function(){renderWorth();});
      r.review=ms(function(){try{buildNestReview();}catch(e){}});
      r.wren=ms(function(){try{wrenAnalyze("how much did I spend on groceries this year?");}catch(e){}});
      r.feas=ms(function(){try{renderFeas();}catch(e){}});
      // rough JS heap after (where available)
      r.heapMB=(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null);
      return r;
    },N);
    table.push(t);
  }

  // print the table
  const cols=['buildIndexes','applyBudget','loadGoals','month','budgetTbl','goals','worth','review','wren','feas'];
  const pad=(s,n)=>{s=''+s;return s+' '.repeat(Math.max(0,n-s.length));};
  console.log('  PERFORMANCE (headless Chromium, ms) — regression baseline only, NOT iPhone timings\n');
  console.log('  '+pad('rows',9)+cols.map(c=>pad(c,12)).join('')+pad('heapMB',8));
  console.log('  '+'─'.repeat(9+cols.length*12+8));
  table.forEach(t=>{console.log('  '+pad(t.N.toLocaleString(),9)+cols.map(c=>pad(t[c]+'ms',12)).join('')+pad(t.heapMB==null?'n/a':t.heapMB,8));});
  console.log('');

  // gross ceilings (catch a catastrophic regression; generous, since headless-cloud CPU varies)
  const big=table[table.length-1]; // 100k
  ck('100k-row index construction completes under 12s (gross ceiling)', big.buildIndexes<12000, big.buildIndexes+'ms');
  ck('100k-row Month render completes under 8s (gross ceiling)', big.month<8000, big.month+'ms');
  ck('100k-row Budget table render completes under 8s (gross ceiling)', big.budgetTbl<8000, big.budgetTbl+'ms');
  ck('100k-row Wren query completes under 8s (gross ceiling)', big.wren<8000, big.wren+'ms');
  ck('no errors thrown during any render at scale', errs.length===0, errs.slice(0,2).join(' | '));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  console.log('\n'+pass+' passed, '+fail+' failed. (Baseline for regression tracking — treat absolute ms as relative only.)');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

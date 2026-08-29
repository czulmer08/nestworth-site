/* CASH-FLOW CURRENT-MONTH decomposition (screenshot audit). The "Plan + actual" table showed July ending at −$20,011.96 and
   August a +$20,509.46 net that almost exactly wipes it out. This proves what that current-month ("SO FAR + PLAN") net actually
   is, and that it is NOT double-counting income/plan and NOT an artificial catch-up:
     • current-month income  = max(actual-to-date, planned)   — take the bigger, NEVER the sum
     • current-month outflow = max(actual-to-date, planned)   — the "at least your plan" floor on spending
     • net = income − outflow − one-time                       — income enters ONCE
   Consequence proven below: when a large deposit has already landed but the month's spending hasn't been logged yet, the current
   month pairs REAL (high) income with PLANNED (higher-than-logged) outflow — so the number is real but is the month's most
   optimistic reading; it only SHRINKS as more spending is logged (conservative on outflow), never inflates. */
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
  await page.waitForFunction(()=>typeof computeCashflow==='function'&&typeof actualIE==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;}; // August = current
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // PLAN: $9,000 income/mo, $8,500 expense/mo, no fixed-goal hold.
    var PLAN={cons:[{name:'Inc',bud12:fill(9000)}],cats:[{name:'Living',bud12:fill(8500)}],rows:[],goals:[],startCash:0,goalMonthlyFixed:0,oneTime:null};
    // ACTUALS via a stub (controls ai/ae/ag directly). Jan–Jul each net −$3,000 (→ −$21,000 by Jul). August: a big $29,000 deposit
    // already logged, but only $500 of spending logged so far.
    var AI=fill(0),AE=fill(0),AG=fill(0);
    for(var m=0;m<7;m++){AI[m]=1000;AE[m]=4000;}      // completed months: net −3,000 each
    AI[7]=29000;AE[7]=500;                              // August so far: big income in, little spend logged
    window.actualIE=function(){return {ai:AI.slice(),ae:AE.slice(),ag:AG.slice(),agc:fill(0),agf:fill(0)};};

    var cf=computeCashflow(PLAN,{mode:'actual',year:2026});
    var jul=cf.months[6],aug=cf.months[7],sep=cf.months[8];

    // Variant A — August spending catches up to plan ($8,500 logged): income is final, so net is UNCHANGED (income counted once).
    var AE2=AE.slice();AE2[7]=8500;window.actualIE=function(){return {ai:AI.slice(),ae:AE2.slice(),ag:AG.slice(),agc:fill(0),agf:fill(0)};};
    var augCaught=computeCashflow(PLAN,{mode:'actual',year:2026}).months[7];
    // Variant B — August spending OVERRUNS plan ($11,000 logged): outflow now takes ACTUAL, so the net SHRINKS (conservative).
    var AE3=AE.slice();AE3[7]=11000;window.actualIE=function(){return {ai:AI.slice(),ae:AE3.slice(),ag:AG.slice(),agc:fill(0),agf:fill(0)};};
    var augOver=computeCashflow(PLAN,{mode:'actual',year:2026}).months[7];
    // Variant C — a $1,000 goal move ALSO logged in August (actualOut=1,500, still < plan 8,500): outflow stays at plan → net
    // unchanged. Proves goal moves aren't double-counted on top of the category plan.
    window.actualIE=function(){var g=fill(0);g[7]=1000;return {ai:AI.slice(),ae:AE.slice(),ag:g,agc:fill(0),agf:fill(0)};};
    var augGoal=computeCashflow(PLAN,{mode:'actual',year:2026}).months[7];

    return {julBal:jul.bal,augNet:aug.net,augBal:aug.bal,sepNet:sep.net,
      augCaughtNet:augCaught.net,augOverNet:augOver.net,augGoalNet:augGoal.net};
  });

  // The reproduction: July ≈ −$21,000, August net ≈ +$20,500 wipes it to ≈ −$500 (the screenshot's shape), future months ≈ +$500.
  ck('reproduces the shape: Jul balance −$21,000, Aug net +$20,500 → Aug balance −$500; a normal future month is +$500',
     near(R.julBal,-21000)&&near(R.augNet,20500)&&near(R.augBal,-500)&&near(R.sepNet,500), JSON.stringify(R));
  // NO DOUBLE-COUNT: Aug net = actual income (29,000, > plan) − planned outflow (8,500) = 20,500. Income enters ONCE (max, not sum).
  ck('NO double-count: Aug net = max(actual $29k, plan $9k) − max(actual $500, plan $8.5k) = $29k − $8.5k = $20,500 (income once, not summed)',
     near(R.augNet,20500), 'augNet='+R.augNet);
  // NOT a catch-up artifact: when August spending catches up to plan, the net is UNCHANGED (income was already final) — the deficit
  // isn't being "recovered" by re-counting anything; it's a real $29k deposit against at-least-planned spending.
  ck('NOT a catch-up artifact: Aug spending rising to the full plan leaves the net unchanged ($20,500) — nothing is re-counted',
     near(R.augCaughtNet,20500), 'augCaughtNet='+R.augCaughtNet);
  // CONSERVATIVE on outflow: if actual August spending OVERRUNS plan, the net SHRINKS (uses the higher actual). So the shown number
  // is the month's MOST OPTIMISTIC reading, and only gets smaller as real spending lands — it can't inflate the recovery.
  ck('CONSERVATIVE: if Aug spending overruns plan ($11k), the net SHRINKS to $18,000 (uses actual outflow) — never inflates',
     near(R.augOverNet,18000)&&R.augOverNet<R.augNet-0.005, 'augOverNet='+R.augOverNet);
  // Goal moves not double-counted on top of the category plan (the v0.54 single-quantity-outflow rule still holds mid-month).
  ck('goal moves not double-counted: a $1,000 Aug goal move (actual outflow $1,500 < plan $8,500) leaves the net at $20,500',
     near(R.augGoalNet,20500), 'augGoalNet='+R.augGoalNet);

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the current-month "SO FAR + PLAN" net pairs REAL income already received with AT-LEAST-planned outflow. It is'
    +' arithmetically correct, counts income once, and can only shrink as spending is logged — the ambiguity is the LABEL/baseline, not the math.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

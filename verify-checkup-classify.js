/* FORECAST CHECKUP — the three remaining pieces (v0.68.55): (1) the explicit "What is this envelope for?" purpose question for an
   unclassified envelope with no matching bill; (2) the "A bit of both" split (recurring spend + saving contribution, total unchanged);
   (3) the completion summary with a before/after safe-to-move. All classifications MOVE NO CASH and apply prospectively. */
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
  await page.waitForFunction(()=>typeof forecastCheckup==='function'&&typeof forecastCheckupHTML==='function'&&typeof checkupSetEnvelope==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    function build(){
      var rr=[];for(var mo=1;mo<=8;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-03','Pay','Deposit','',8000,'','']);
      state.cons=[{name:'Pay',bud12:fill(8000),annual:96000}];
      state.cats=[{name:'Vacation',bud12:fill(500),annual:6000},{name:'Living',bud12:fill(6000),annual:72000}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=rr;
      state.meta={cats:{"vacation":{roll:'envelope'}},cons:{},goals:[],payees:['Pay'],floor:1000,startCash:5000}; // Vacation is an envelope, no future bill, unclassified
      window.__SPEND["vacation"]=[500,500,500,0,0,0,0,0,0,0,0,0]; // banked toward nothing specific yet
      window._ckBaseSafe=null;
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    // (1) PURPOSE QUESTION — an unclassified envelope with no bill match is surfaced as needsPurpose
    build();
    var scan=forecastCheckup();
    var vac=scan.envelopes.filter(function(e){return e.cat==='Vacation';})[0];
    Rz.purpose={needs:!!(vac&&vac.needsPurpose),count:scan.counts.purposeReview,hasWork:scan.hasWork};
    var html=forecastCheckupHTML();
    Rz.render={hasQ:/What is this envelope for\?/.test(html)&&/Vacation/.test(html),
      hasSaving:/Saving for a bill/.test(html)&&/ckPurpose\([0-9]+,'sinking'\)/.test(html),
      hasBoth:/A bit of both/.test(html)&&/ckSplit\(/.test(html),
      hasOngoing:/Ongoing spending/.test(html)&&/ckPurpose\([0-9]+,'ongoing'\)/.test(html),
      hasUnsure:/Not sure/.test(html)&&/ckPurpose\([0-9]+,'unsure'\)/.test(html)};
    Rz.handlers=(typeof ckPurpose==='function'&&typeof ckSplit==='function'&&typeof doCheckupFinish==='function');
    // classifying "ongoing" marks it reviewed → drops from the scan
    checkupSetEnvelope('Vacation',{purpose:'ongoing'});checkupMarkDone('purpose','Vacation');
    var scan2=forecastCheckup();
    Rz.afterOngoing={needs:scan2.envelopes.filter(function(e){return e.cat==='Vacation';})[0].needsPurpose,count:scan2.counts.purposeReview,hasWork:scan2.hasWork};
    // (2) SPLIT — "a bit of both": $300 of the $500 budget is saving; total unchanged (consumption = $200)
    build();
    checkupSetEnvelope('Vacation',{purpose:'split',contribution:300});
    Rz.split={purpose:catPurpose('Vacation'),contribution:catContributionMonthly('Vacation',8),consumption:catConsumptionMonthly('Vacation',8),budget:_catBudMonth('Vacation',8)};
    // (3) COMPLETION SUMMARY — hasWork false + a session baseline → the wrap-up with before/after
    build();
    checkupSetEnvelope('Vacation',{purpose:'ongoing'});checkupMarkDone('purpose','Vacation');
    var safeNow=goalSafeToMove().safeToGoal;
    window._ckBaseSafe=r2(safeNow-1500);                       // simulate a lower starting point this session → +$1,500 improvement
    var doneScan=forecastCheckup();
    var summary=forecastCheckupHTML();
    Rz.summary={hasWork:doneScan.hasWork,ready:/Your forecast is ready/.test(summary),hasBeforeAfter:/Safe to move to/.test(summary),
      showsAfter:summary.indexOf(money(r2(safeNow)))>=0,showsDelta:/\+\$1,500\.00/.test(summary),hasDone:/doCheckupFinish\(\)/.test(summary),
      preserved:/Contingency/.test(summary)&&/preserved/.test(summary)};
    return Rz;
  });

  ck('(1) an unclassified envelope with no bill match is surfaced with a "What is this envelope for?" question',
     R.purpose.needs&&R.purpose.count===1&&R.purpose.hasWork, JSON.stringify(R.purpose));
  ck('(1) it offers all four answers — Saving for a bill / A bit of both / Ongoing spending / Not sure — wired to real handlers',
     R.render.hasQ&&R.render.hasSaving&&R.render.hasBoth&&R.render.hasOngoing&&R.render.hasUnsure, JSON.stringify(R.render));
  ck('(1) answering "ongoing" records the answer and drops the item from the scan (won’t re-ask)',
     R.afterOngoing.needs===false&&R.afterOngoing.count===0&&R.afterOngoing.hasWork===false, JSON.stringify(R.afterOngoing));
  ck('(2) "a bit of both" splits the budget: $300 saving + $200 spend = the same $500 total (purpose "split")',
     R.split.purpose==='split'&&near(R.split.contribution,300)&&near(R.split.consumption,200)&&near(R.split.budget,500), JSON.stringify(R.split));
  ck('(3) once everything is reviewed, the completion summary shows "Your forecast is ready", the counts, and Contingency preserved',
     R.summary.hasWork===false&&R.summary.ready&&R.summary.preserved, JSON.stringify(R.summary));
  ck('(3) the summary shows the before → after safe-to-move (a +$1,500 improvement here) with a Done button',
     R.summary.hasBeforeAfter&&R.summary.showsAfter&&R.summary.showsDelta&&R.summary.hasDone, JSON.stringify(R.summary));
  ck('the classification handlers exist (ckPurpose / ckSplit / doCheckupFinish)', R.handlers, 'handlers='+R.handlers);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: envelopes get an explicit purpose question with a split option, and a before/after wrap-up — all cash-neutral.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

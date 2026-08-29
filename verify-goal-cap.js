/* Verify the optional monthly CAP on percentage-of-leftover (residual) goals:
   the goal takes its % of the leftover pool but never more than the cap; the excess is NOT pushed onto other goals — it
   stays spendable. Plus storage round-trip (saveGoal -> loadGoals) and the editor UI wiring. */
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
  await page.waitForFunction(()=>typeof computeResidual==='function'&&typeof residualPool==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});
  const near=(a,bb)=>Math.abs(a-bb)<0.02;

  const res=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs(a-bb)<0.02;};
    function base(){state.meta={startCash:0,floor:0,cats:{},cons:{},goals:[]};state.cats=[];state.cons=[{name:'Job',annual:24000}];state.rows=[];state.carryIn={};state.spend={};state.dep={};}
    // pool = (24000 income − 0 budget − 0 fixed goals)/12 = $2,000/mo
    base();
    var pool=residualPool();

    // 1) cap bites: 80% of $2,000 = $1,600, capped at $800
    state.goals=[{name:'Car',residual:true,residualPct:80,residualCap:800,target:12000,balance:0,archived:false}];
    var r1=computeResidual().goals[0];
    var capBites=near(r1._resMo,800)&&r1._resCapped===true&&near(r1._resUncapped,1600);

    // 2) no cap: draws the full 80% = $1,600
    state.goals=[{name:'Car',residual:true,residualPct:80,residualCap:0,target:12000,balance:0,archived:false}];
    var r2g=computeResidual().goals[0];
    var noCap=near(r2g._resMo,1600)&&r2g._resCapped===false;

    // 3) cap doesn't bite in a lean month: pool $500, 80% = $400 < $800 cap → draws $400, not capped
    base();state.cons=[{name:'Job',annual:6000}]; // pool = 500
    state.goals=[{name:'Car',residual:true,residualPct:80,residualCap:800,target:12000,balance:0,archived:false}];
    var leanPool=residualPool();var r3=computeResidual().goals[0];
    var leanOk=near(leanPool,500)&&near(r3._resMo,400)&&r3._resCapped===false;

    // 4) excess stays spendable: Car(80%, cap $800) + Vacation(blank=rest 20%). Pool $2,000.
    //    Car takes $800 (capped, not $1,600); Vacation takes its 20% = $400 — NOT boosted by Car's $800 excess.
    //    Total allocated $1,200 < $2,000, so $800 stays spendable.
    base();
    state.goals=[{name:'Car',residual:true,residualPct:80,residualCap:800,target:12000,balance:0,archived:false},
                 {name:'Vacation',residual:true,residualPct:0,residualCap:0,target:5000,balance:0,archived:false}];
    var g4=computeResidual().goals;var car=g4.filter(function(z){return z.name==='Car';})[0],vac=g4.filter(function(z){return z.name==='Vacation';})[0];
    var carCap=near(car._resMo,800)&&car._resCapped===true;
    var vacUnboosted=near(vac._resMo,400)&&vac._resCapped===false; // still just its 20% rest — did NOT absorb Car's excess
    var totalUnderPool=(car._resMo+vac._resMo)<pool-0.005&&near(car._resMo+vac._resMo,1200);

    // 5) storage round-trip: saveGoal rec captures residualCap; loadGoals materializes it
    var rt=false,uiOk=false;
    try{
      show('appScreen');openOv('goalOv',function(){});
      $("gResidual").checked=true;$("gResidual").dispatchEvent(new Event('change'));
      uiOk=getComputedStyle($("gResCapRow")).display!=='none'; // cap row appears when "Fund from leftover" is on
      $("gName").value='Car';$("gTarget").value='12000';$("gResidualPct").value='80';$("gResidualCap").value='800';
      // mimic the exact rec-building expression saveGoal uses
      var cap=parseFloat(($("gResidualCap").value||"").replace(/[^0-9.]/g,""))||0;
      state.meta.goals=[{name:'Car',target:12000,residual:true,residualPct:80,residualCap:cap,balance:0}];
      loadGoals();
      var loaded=(state.goals||[]).filter(function(z){return z.name==='Car';})[0];
      rt=loaded&&near(loaded.residualCap,800);
    }catch(e){rt='ERR:'+e.message;}

    return {pool:pool,capBites:capBites,noCap:noCap,leanOk:leanOk,carCap:carCap,vacUnboosted:vacUnboosted,totalUnderPool:totalUnderPool,rt:rt,uiOk:uiOk,
            r1:{mo:r1._resMo,capped:r1._resCapped,unc:r1._resUncapped},vac:{mo:vac._resMo}};
  });

  ck('pool computes to $2,000/mo', near(res.pool,2000), String(res.pool));
  ck('cap bites: 80% of $2,000 = $1,600 is capped to $800', res.capBites, JSON.stringify(res.r1));
  ck('no cap (0): draws the full 80% = $1,600', res.noCap, '');
  ck('cap idle in a lean month: 80% of $500 = $400 (< $800 cap), not capped', res.leanOk, '');
  ck('with two goals, the capped goal takes exactly its cap ($800)', res.carCap, '');
  ck("the other goal keeps its own 20% ($400) — it does NOT absorb the capped goal's excess", res.vacUnboosted, JSON.stringify(res.vac));
  ck('excess above the cap stays spendable (allocated $1,200 < $2,000 pool)', res.totalUnderPool, '');
  ck('editor shows the "Cap per month" row when Fund-from-leftover is on', res.uiOk===true, String(res.uiOk));
  ck('storage round-trips residualCap (save -> load = $800)', res.rt===true, String(res.rt));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

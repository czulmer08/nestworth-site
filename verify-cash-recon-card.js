/* The surplus reconciliation is now VISIBLE on the Contingency card (product step after the engine): a "where this month's cash is
   going" waterfall + a raw/repaired/effective contingency distinction, both drawn from the SAME monthlyCashReconciliation() facts
   (no duplicated math — the helper is stubbed here to control the scenario; its arithmetic is proven in verify-cash-allocation.js).
   Proves: the waterfall line items and interpretation render; the raw→repaired→effective rows appear when a surplus can repair a
   deficit; a no-surplus month shows the reserve draw and NO repair rows; and no deposit yet → no card. */
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
  await page.waitForFunction(()=>typeof renderContingency==='function'&&typeof cashReconCardHTML==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const setup=()=>page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"}},cons:{},goals:[],payees:['Me'],floor:0};
    state.cats=[{name:'Cushion',mbud:500,mused:1000,annual:6000,bud12:fill(500)}];
    window.__SPEND["cushion"]=[300,300,300,300,1200,500,1000,0,0,0,0,0]; // rawBuffer −$400 through Jul
    state.goals=[];state.rows=[];state.assets=[];state.debts=[];
  });

  // CASE A — surplus repairs contingency
  await setup();
  const A=await page.evaluate(()=>{
    monthlyCashReconciliation=function(){return {month:8,income:15000,consumption:11000,protectedGoals:1000,protectedFixed:1000,categoryLinkedGoalFunding:0,
      hasSurplus:true,surplus:3000,contingencyEntering:-400,contingencyEnteringDeficit:400,contingencyRepair:400,contingencyAfterRepair:0,
      residualPlanned:1000,residualFunding:1000,unallocated:1600,reserveDraw:0,drawsReserves:false};};
    renderContingency();return $("contBody").innerHTML;
  });
  ck('waterfall renders the line items (deposits +$15,000, spending −$11,000, protected −$1,000, surplus $3,000)',
     /Where August’s cash is going/.test(A)&&/Deposits received[\s\S]{0,80}\+\$15,000\.00/.test(A)&&/Actual spending[\s\S]{0,80}−\$11,000\.00/.test(A)&&/Surplus to allocate[\s\S]{0,80}\$3,000\.00/.test(A), A.slice(0,120));
  ck('waterfall shows contingency repaired −$400, residual funded −$1,000, remaining projected cash $1,600',
     /Contingency repaired[\s\S]{0,80}−\$400\.00/.test(A)&&/Residual goals funded[\s\S]{0,80}−\$1,000\.00/.test(A)&&/Remaining projected cash[\s\S]{0,80}\$1,600\.00/.test(A), '');
  ck('one-line interpretation reconciles the flow (repaired $400 back to $0, funded $1,000 residual, left $1,600)',
     /first repaired \$400\.00 of negative contingency \(back to \$0\), then funded \$1,000\.00 of residual goals, and left \$1,600\.00 as spendable cash/.test(A), '');
  ck('raw → repaired → effective distinction: raw −$400 total, "can repair +$400", "Effective if applied $0.00"',
     /−\$400\.00/.test(A)&&/This month’s surplus can repair[\s\S]{0,80}\+\$400\.00/.test(A)&&/Effective if applied[\s\S]{0,80}\$0\.00/.test(A), '');

  // CASE B — no surplus (drawing reserves) → shows the reserve draw, NO repair rows
  await setup();
  const B=await page.evaluate(()=>{
    monthlyCashReconciliation=function(){return {month:8,income:9000,consumption:9500,protectedGoals:500,hasSurplus:false,surplus:0,
      contingencyEntering:-400,contingencyEnteringDeficit:400,contingencyRepair:0,contingencyAfterRepair:-400,residualPlanned:1000,residualFunding:0,unallocated:0,reserveDraw:1000,drawsReserves:true};};
    renderContingency();return $("contBody").innerHTML;
  });
  ck('no-surplus month → "Short this month −$1,000", a reserve-draw note, and NO "Contingency repaired" / "can repair" rows',
     /Short this month[\s\S]{0,80}−\$1,000\.00/.test(B)&&/drawing \$1,000\.00 from reserves/.test(B)&&!/Contingency repaired/.test(B)&&!/can repair/.test(B), B.slice(0,120));

  // CASE C — no deposit yet this month → no reconciliation card
  await setup();
  const C=await page.evaluate(()=>{
    monthlyCashReconciliation=function(){return {month:8,income:0,consumption:0,protectedGoals:0,hasSurplus:false,surplus:0,contingencyRepair:0,contingencyAfterRepair:0,reserveDraw:0,drawsReserves:false,residualFunding:0,unallocated:0,residualPlanned:0,contingencyEntering:0,contingencyEnteringDeficit:0};};
    renderContingency();return $("contBody").innerHTML;
  });
  ck('no deposit yet this month → the reconciliation card is not shown', !/cash is going/.test(C)&&!/Deposits received/.test(C), '');

  // screenshot (last — replaces the page body, so run after all DOM-reading cases)
  await page.setViewportSize({width:412,height:1180});
  await page.evaluate((inner)=>{document.body.innerHTML='<div style="max-width:380px;margin:16px auto;padding:16px;background:var(--card,#fff);border-radius:16px"><p class="eyebrow">Contingency &amp; envelopes</p><div>'+inner+'</div></div>';document.body.style.background='var(--bg,#F4F1EA)';},A);
  await page.screenshot({path:path.join(__dirname,'shot-cash-recon.png')});

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.  (screenshot: shot-cash-recon.png)');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

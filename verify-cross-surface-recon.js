/* CROSS-SURFACE reconciliation language (real-use audit: after v0.68.24/.25 the engine knows this month's surplus can repair an
   overspent contingency, but the Cash-Flow verdict, the Month coverage line, and Wren still said "overspent, $0 available, comes
   out of cash / doesn't refill it" — contradicting the Contingency card right below). Every surface now speaks from ONE reconciled
   source (contingencyReconNote/Sentence). This proves that in a month whose surplus fully repairs the deficit, the Cash-Flow
   verdict, the Month buffer-over line, and Wren's deposit answer ALL say the surplus repairs it — and NONE keeps the old
   contradicting "comes out of cash / doesn't refill it / won't move it" language. */
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
  await page.waitForFunction(()=>typeof contingencyReconSentence==='function'&&typeof renderStress==='function'&&typeof coverageHtml==='function'&&typeof wrenAnalyze==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    var SPEND={};window.catSpend12=function(n){return (SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // A buffer overspent to rawBuffer −$400 (entering deficit), and over its Aug budget too.
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"}},cons:{},goals:[],payees:['Me'],floor:0,startCash:0};
    state.cons=[{name:'Inc',annual:120000,bud12:fill(10000)}];
    state.cats=[{name:'Cushion',mbud:500,mused:1000,annual:6000,bud12:fill(500)}];
    SPEND["cushion"]=[300,300,300,300,1200,500,1000,0,0,0,0,0]; // rawBuffer −$400 through Jul; over $500 in Aug
    state.goals=[];state.assets=[];state.debts=[];
    state.rows=[[2026,8,'2026-08-10','','deposit','',30000,'',''],[2026,8,'2026-08-10','','Cushion','',1000,'','']];
    // Force the surplus scenario (engine math proven elsewhere): a big surplus that FULLY repairs the −$400 deficit.
    monthlyCashReconciliation=function(){return {month:8,income:30000,consumption:11000,protectedGoals:0,hasSurplus:true,surplus:19000,
      contingencyEntering:-400,contingencyEnteringDeficit:400,contingencyRepair:400,contingencyAfterRepair:0,contingencyEffective:0,contingencyBuild:0,contingencyTarget:0,residualPlanned:0,residualFunding:0,unallocated:18600,reserveDraw:0,drawsReserves:false};};

    var sentence=contingencyReconSentence();
    renderStress();var verdict=($("stVerdict")&&$("stVerdict").innerHTML)||"";
    var cov=coverageHtml();
    var wr=wrenAnalyze("Can you explain how despite the large deposit in July, I still don't have a contingency?");var wrA=(wr&&(wr.answer||wr.text))||"";
    return {sentence:sentence,verdict:verdict,cov:cov,wren:wrA};
  });

  ck('the shared reconciled SENTENCE says the surplus repairs it to $0 (not "doesn\'t refill it")',
     /covers the \$400\.00 shortfall/.test(R.sentence)&&/effectively at \$0/.test(R.sentence)&&/doesn.t move or rewrite/.test(R.sentence)&&!/doesn.t refill it|no surplus/.test(R.sentence), R.sentence);
  ck('CASH FLOW verdict: surplus repairs it to $0 — NOT "a positive cash trend doesn\'t refill it"',
     /covers the \$400\.00 shortfall/.test(R.verdict)&&/effectively at \$0/.test(R.verdict)&&!/doesn.t refill it/.test(R.verdict), R.verdict);
  ck('MONTH coverage buffer-over line: "surplus is enough to repair… isn\'t actually short of cash" — NOT "comes out of cash"',
     /covered by August’s cash surplus/.test(R.cov)&&/Overall: August’s surplus covers your current overages/.test(R.cov)&&!/so that much comes out of cash/.test(R.cov), (R.cov.match(/Cushion[\s\S]{0,180}/)||[''])[0]);
  ck('WREN deposit answer: "this month you DO have a surplus… repair it back to $0" — NOT "won\'t move it / come in under budget"',
     /this month you DO have a surplus/.test(R.wren)&&/covers the shortfall, bringing your effective contingency to \$0/.test(R.wren)&&/set a contingency target/.test(R.wren)&&!/won.t move it|need to come in under budget/.test(R.wren), R.wren);
  ck('all three surfaces agree with the card (no surface still calls it uncovered/unrepaired)',
     !/(doesn.t refill it|comes out of cash|won.t move it)/.test(R.verdict+R.cov+R.wren), '');

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

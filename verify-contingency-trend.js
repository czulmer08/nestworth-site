/* CONTINGENCY TREND — the month-by-month buffer chart. Since v0.68.34 it is DEMOTED (not deleted): it lives behind the
   "View contingency history" expandable inside the consolidated "Your money right now" card on Month, rather than on a
   standalone Contingency card. This proves both the producer (contingencyTrendHTML) and its integration into the money card. */
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
  await page.waitForFunction(()=>typeof contingencyTrendHTML==='function'&&typeof getContingencyFacts==='function'&&typeof moneyNowHTML==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const setup=()=>page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
  });

  // CASE A — buffer crosses negative in July (200,400,600,800,100,100,−400) — chart via the canonical producer
  await setup();
  const A=await page.evaluate(()=>{
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"}},cons:{},goals:[],payees:['Me'],floor:0};
    state.cats=[{name:'Cushion',mbud:500,mused:1000,annual:6000,bud12:fill(500)}];
    window.__SPEND["cushion"]=[300,300,300,300,1200,500,1000,0,0,0,0,0];
    state.goals=[];state.assets=[];state.debts=[];state.rows=[];
    var html=contingencyTrendHTML();
    return {hasSvg:/<svg /.test(html),rects:(html.match(/<rect /g)||[]).length,monthLabels:(html.match(/<text /g)||[]).length,
      cross:/Went negative in July/.test(html),
      crossHighlight:/font-weight="700">J</.test(html),
      nowShown:/now <b>-\$400\.00<\/b>/.test(html),
      header:/Contingency trend · month-end, Jan–Jul/.test(html)};
  });
  ck('trend chart renders: an <svg> with 7 bars (one per completed month Jan–Jul) and month labels', A.hasSvg&&A.rects===7&&A.monthLabels===7, JSON.stringify({svg:A.hasSvg,rects:A.rects,labels:A.monthLabels}));
  ck('header states the span (month-end, Jan–Jul)', A.header, '');
  ck('caption states the crossing month (Went negative in July) and current balance −$400', A.cross&&A.nowShown, JSON.stringify({cross:A.cross,now:A.nowShown}));
  ck('the crossing month is highlighted in the chart', A.crossHighlight, '');

  // CASE B — healthy buffer, never negative
  await setup();
  const B=await page.evaluate(()=>{
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"}},cons:{},goals:[],payees:['Me'],floor:0};
    state.cats=[{name:'Cushion',mbud:500,mused:0,annual:6000,bud12:fill(500)}];
    window.__SPEND["cushion"]=[300,300,300,300,300,300,300,0,0,0,0,0];
    state.goals=[];state.assets=[];state.debts=[];state.rows=[];
    var html=contingencyTrendHTML();
    return {black:/In the black every month/.test(html),noCross:!/Went negative/.test(html),hasSvg:/<svg /.test(html)};
  });
  ck('healthy buffer: chart renders and caption reads "In the black every month" (no crossing)', B.hasSvg&&B.black&&B.noCross, JSON.stringify(B));

  // CASE C — no buffer set up → no trend chart
  await setup();
  const C=await page.evaluate(()=>{
    state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:0};state.cats=[{name:'Food',mbud:500,mused:200,annual:6000,bud12:[500,500,500,500,500,500,500,500,500,500,500,500]}];
    state.goals=[];state.assets=[];state.debts=[];state.rows=[];
    return {noTrend:!/Contingency trend/.test(contingencyTrendHTML())};
  });
  ck('no buffer category → no trend chart', C.noTrend, '');

  // CASE D — INTEGRATION: the chart is embedded in the money card behind "View contingency history"
  await setup();
  const D=await page.evaluate(()=>{
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"}},cons:{},goals:[],payees:['Me'],floor:1000,startCash:4000};
    state.cons=[{name:'Inc',bud12:fill(3000),annual:36000}];
    state.cats=[{name:'Cushion',mbud:500,mused:1000,annual:6000,bud12:fill(500)}];
    window.__SPEND["cushion"]=[300,300,300,300,1200,500,1000,0,0,0,0,0];
    state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=[];
    var h=moneyNowHTML();
    return {hasHistoryToggle:/View contingency history/.test(h),chartEmbedded:/<svg /.test(h)};
  });
  ck('the money card exposes "View contingency history" with the trend chart embedded (demoted, not deleted)', D.hasHistoryToggle&&D.chartEmbedded, JSON.stringify(D));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

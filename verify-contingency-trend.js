/* CONTINGENCY TREND is now VISIBLE on the Contingency card (screenshot audit: "I don't see the historical trending anywhere").
   The month-by-month pooled-balance history the engine computes (getContingencyFacts) and Wren narrates is now DRAWN as a bar
   sparkline on the card, so the number Wren quotes and the picture agree. Proves: the chart renders with one bar per completed
   month, the month it first went negative is highlighted, the caption states the crossing, and a healthy buffer reads "in the
   black". Also renders a PNG to eyeball. */
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
  await page.waitForFunction(()=>typeof renderContingency==='function'&&typeof getContingencyFacts==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const setup=()=>page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
  });

  // CASE A — buffer crosses negative in July (200,400,600,800,100,100,−400)
  await setup();
  const A=await page.evaluate(()=>{
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"}},cons:{},goals:[],payees:['Me'],floor:0};
    state.cats=[{name:'Cushion',mbud:500,mused:1000,annual:6000,bud12:fill(500)}];
    window.__SPEND["cushion"]=[300,300,300,300,1200,500,1000,0,0,0,0,0];
    state.goals=[];state.assets=[];state.debts=[];state.rows=[];
    renderContingency();
    var html=$("contBody").innerHTML;
    var rects=(html.match(/<rect /g)||[]).length, texts=(html.match(/<text /g)||[]).length;
    return {hasSvg:/<svg /.test(html),rects:rects,monthLabels:texts,
      cross:/Went negative in July/.test(html),
      crossHighlight:/fill="var\(--bad\)" font-weight="700">J</.test(html)||/font-weight="700">J</.test(html),
      nowShown:/now <b>-\$400\.00<\/b>/.test(html),
      header:/Contingency trend · month-end, Jan–Jul/.test(html)};
  });
  await page.setViewportSize({width:412,height:900});
  await page.evaluate(()=>{document.querySelectorAll('.card').forEach(function(c){if(c.id!=='contCard')c.style.display='none';});var cc=$("contCard");if(cc)cc.style.display='block';window.scrollTo(0,0);});
  await page.screenshot({path:path.join(__dirname,'shot-contingency-trend.png')});

  ck('trend chart renders: an <svg> with 7 bars (one per completed month Jan–Jul) and month labels', A.hasSvg&&A.rects===7&&A.monthLabels===7, JSON.stringify({svg:A.hasSvg,rects:A.rects,labels:A.monthLabels}));
  ck('header states the span (month-end, Jan–Jul)', A.header, '');
  ck('caption states the crossing month (Went negative in July) and current balance −$400', A.cross&&A.nowShown, JSON.stringify({cross:A.cross,now:A.nowShown}));
  ck('the crossing month is highlighted in the chart', A.crossHighlight, '');

  // CASE B — buffer positive every month → "in the black", no red crossing text
  await setup();
  const B=await page.evaluate(()=>{
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"}},cons:{},goals:[],payees:['Me'],floor:0};
    state.cats=[{name:'Cushion',mbud:500,mused:200,annual:6000,bud12:fill(500)}];
    window.__SPEND["cushion"]=[200,200,200,200,200,200,200,0,0,0,0,0]; // banks +300/mo, always positive
    state.goals=[];state.rows=[];state.assets=[];state.debts=[];
    renderContingency();var html=$("contBody").innerHTML;
    return {black:/In the black every month/.test(html),noCross:!/Went negative/.test(html),hasSvg:/<svg /.test(html)};
  });
  ck('healthy buffer: chart renders and caption reads "In the black every month" (no crossing)', B.hasSvg&&B.black&&B.noCross, JSON.stringify(B));

  // CASE C — no buffer set up → no trend chart
  await setup();
  const C=await page.evaluate(()=>{
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    state.meta={cats:{"living":{type:"monthly"}},cons:{},goals:[],payees:['Me'],floor:0};
    state.cats=[{name:'Living',mbud:500,mused:400,annual:6000,bud12:fill(500)}];
    state.goals=[];state.rows=[];state.assets=[];state.debts=[];
    renderContingency();return {noTrend:!/Contingency trend/.test($("contBody").innerHTML)};
  });
  ck('no buffer category → no trend chart shown', C.noTrend, '');

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.  (screenshot: shot-contingency-trend.png)');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

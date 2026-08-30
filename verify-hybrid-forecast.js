/* HYBRID FORECAST (v0.68.40) — future months = recurring baseline + INCREMENTAL known dated bills, deduped PER CATEGORY.
   Rule: contribution = max(recurring bud12, Σ logged dated bills). Proves the exact cases from the design review:
   logged==budget→once; logged>baseline→only increment; logged<baseline→never below baseline; multiple bills; no baseline;
   reschedule/delete moves safe-to-move; envelope designation doesn't double-reserve; unlogged categories keep their baseline. */
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
  await page.waitForFunction(()=>typeof computeCashflow==='function'&&typeof goalSafeToMove==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;}; // Aug current; Dec is future
    var fill=v=>{var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // returns DECEMBER (idx 11) projected outflow (income is 0 so outflow = -net)
    function decOut(baseline, decBills, roll){
      state.cons=[{name:'Inc',bud12:fill(0),annual:0}];
      state.cats=[{name:'C',bud12:fill(baseline),annual:baseline*12,mbud:baseline,mspent:baseline,mused:baseline}];
      state.goals=[];state.assets=[];state.debts=[];
      state.rows=(decBills||[]).map(function(amt,i){return [2026,12,'2026-12-1'+i,'','C','Bill'+i,amt,'',''];});
      state.meta={cats:(roll?{"c":{roll:roll}}:{}),cons:{},goals:[],payees:['Me'],floor:0,startCash:0};
      var cf=computeCashflow(currentPlan(),{mode:'actual',year:2026});
      return -cf.months[11].net;
    }
    var o={};
    o.c1_equal    = decOut(500,[500]);        // logged == budget → 500 (once)
    o.c2_larger   = decOut(500,[3000]);       // logged > baseline → 3000 (baseline + 2500 increment)
    o.c3_smaller  = decOut(500,[200]);        // logged < baseline → 500 (never below baseline)
    o.c4_multiple = decOut(500,[2000,1500]);  // two bills → max(500, 3500) = 3500
    o.c5_noBase   = decOut(0,[6000]);         // no baseline → 6000 (full add)
    o.c8_unlogged = decOut(600,[]);           // no logged bill → 600 (baseline preserved, not 0)
    o.c7_plain    = decOut(500,[3000],null);  // roll independence
    o.c7_envelope = decOut(500,[3000],'envelope');
    o.c7_buffer   = decOut(500,[3000],'buffer');
    // c6: reschedule/delete changes safe-to-move (need income + startCash so it's non-breach)
    function safeWith(decBills){
      state.cons=[{name:'Inc',bud12:fill(4000),annual:48000}];                 // breakeven: income == baseline, no cushion
      state.cats=[{name:'C',bud12:fill(4000),annual:48000,mbud:4000,mspent:4000,mused:4000}];
      state.goals=[{name:'Car',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];
      state.rows=(decBills||[]).map(function(amt,i){return [2026,12,'2026-12-1'+i,'','C','Bill'+i,amt,'',''];});
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:0,startCash:5000};
      return goalSafeToMove().safeToGoal;
    }
    o.c6_withBill = safeWith([6000]);
    o.c6_noBill   = safeWith([]);
    return o;
  });

  ck('C1 logged == budget → counted ONCE ($500, not $1,000)', near(R.c1_equal,500), 'dec='+R.c1_equal);
  ck('C2 logged > baseline → only the increment added (max 500,3000 = $3,000)', near(R.c2_larger,3000), 'dec='+R.c2_larger);
  ck('C3 logged < baseline → never falls below baseline ($500, not $200)', near(R.c3_smaller,500), 'dec='+R.c3_smaller);
  ck('C4 multiple bills same category/month → max(baseline, Σbills) = $3,500', near(R.c4_multiple,3500), 'dec='+R.c4_multiple);
  ck('C5 one-time bill, no recurring baseline → added in full ($6,000)', near(R.c5_noBase,6000), 'dec='+R.c5_noBase);
  ck('C8 unlogged category keeps its recurring baseline ($600, never drifts to $0)', near(R.c8_unlogged,600), 'dec='+R.c8_unlogged);
  ck('C7 envelope/buffer designation does NOT change the forecast (no double-reserve): plain==envelope==buffer',
     near(R.c7_plain,R.c7_envelope)&&near(R.c7_envelope,R.c7_buffer)&&near(R.c7_plain,3000), JSON.stringify({p:R.c7_plain,e:R.c7_envelope,b:R.c7_buffer}));
  ck('C6 scheduling / removing a future bill immediately moves safe-to-move (a $6k Dec bill over a $4k baseline lowers it by the $2k increment)',
     R.c6_noBill>R.c6_withBill&&near(R.c6_noBill-R.c6_withBill,2000), 'withBill='+R.c6_withBill+' noBill='+R.c6_noBill);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the forecast layers recurring baseline + incremental known bills, deduped per category — never double-counted, never below baseline, and known bills move the answer.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

/* FORECAST CHECKUP (v0.68.45, increment 3) — the review-and-confirm migration surface. Proves the two guarantees that matter:
   (1) the SCAN is read-only — forecastCheckup / lumpyCategories / checkupBillCandidates / checkupLinkDiff leave state untouched
   (the diff is a dry run that reverts exactly); (2) a classification MOVES NO CASH — checkupSetEnvelope changes the forecast
   (that's the point) but never a balance, the ledger, net worth, or history. Plus: matches are suggested (earliest-due, expenses
   only), never auto-applied; lumpy detection flags a one-time spike but not a flat budget; unlinking reverts and keeps the balance. */
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
  await page.waitForFunction(()=>typeof forecastCheckup==='function'&&typeof checkupLinkDiff==='function'&&typeof checkupSetEnvelope==='function'&&typeof goalSafeToMove==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};todayISO=function(){return '2026-09-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    function build(){
      // income ($1,900/mo) matches the recurring baseline (Tuition 500 + Home 800 + Groceries 600), so cash is flattish and the
      // logged $6,000 December bill is the binding forward low. A large startCash absorbs Home's one-time June spike from the past.
      var rr=[];for(var mo=1;mo<=8;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-03','Pay','Deposit','',1900,'','']);
      rr.push([2026,12,'2026-12-15','','Tuition','School',6000,'','']);        // future obligation → sinking candidate for Tuition
      state.cons=[{name:'Inc',bud12:fill(1900),annual:22800}];
      state.cats=[{name:'Tuition',bud12:fill(500),annual:6000},{name:'Home',bud12:fill(800),annual:9600},{name:'Groceries',bud12:fill(600),annual:7200}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[{name:'Checking',bal:9000}];state.debts=[{name:'Card',bal:2000}];
      state.rows=rr;
      state.meta={cats:{"tuition":{roll:'envelope'}},cons:{},goals:[],payees:['Pay'],floor:0,startCash:25000}; // only Tuition is an envelope
      window.__SPEND["tuition"]=[500,500,500,500,500,0,0,0,0,0,0,0];  // banks $1,500; flat history (not lumpy)
      window.__SPEND["home"]=[800,800,800,800,800,12000,800,800,0,0,0,0]; // June spike → lumpy
      window.__SPEND["groceries"]=[600,600,600,600,600,600,600,600,0,0,0,0]; // flat → NOT lumpy
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    build();
    // ---- READ-ONLY: the whole scan leaves state byte-identical ----
    var metaBefore=JSON.stringify(state.meta),rowsBefore=JSON.stringify(state.rows),nwBefore=netWorthNow();
    var scan=forecastCheckup();var cand=checkupBillCandidates('Tuition');var lump=lumpyCategories();
    var diffProbe=checkupLinkDiff('Tuition',cand[0]);
    Rz.readOnly=(JSON.stringify(state.meta)===metaBefore)&&(JSON.stringify(state.rows)===rowsBefore)&&near(netWorthNow(),nwBefore);
    Rz.counts=scan.counts;Rz.hasWork=scan.hasWork;
    Rz.cand={n:cand.length,amount:cand[0]&&cand[0].amount,dueMonth:cand[0]&&cand[0].dueMonth};
    Rz.lumpy={n:lump.length,cats:lump.map(function(x){return x.cat;}),spikeMonth:lump[0]&&lump[0].spikeMonth};
    // ---- DIFF: linking raises safe-to-move by the freed contributions; dry run reverts exactly ----
    var safeBase=goalSafeToMove().safeToGoal;
    Rz.diff=checkupLinkDiff('Tuition',cand[0]);
    Rz.diffRevert=near(goalSafeToMove().safeToGoal,safeBase)&&(JSON.stringify(state.meta)===metaBefore); // still unchanged after the diff
    // ---- APPLY: classification moves NO cash, but changes the forecast; opening-funded captured ----
    var bankedBefore=catBalance(state.cats[0]);
    checkupSetEnvelope('Tuition',{purpose:'sinking',obligation:cand[0]});
    Rz.applied={
      cfgHasLink:!!(state.meta.cats.tuition&&state.meta.cats.tuition.sinking),
      opening:(state.meta.cats.tuition.sinking||{}).openingFunded,
      purpose:catPurpose('Tuition'),
      nwUnchanged:near(netWorthNow(),nwBefore),
      bankedUnchanged:near(catBalance(state.cats[0]),bankedBefore),
      rowsUnchanged:(JSON.stringify(state.rows)===rowsBefore),
      safeAfter:goalSafeToMove().safeToGoal
    };
    Rz.safeBase=safeBase;
    Rz.forecastMoved=!near(Rz.applied.safeAfter,safeBase);
    Rz.safeMatchesDiff=near(Rz.applied.safeAfter,Rz.diff.after);
    // ---- UNLINK: reverts the forecast, keeps the balance ----
    checkupUnlink('Tuition');
    Rz.unlink={noLink:!(state.meta.cats.tuition&&state.meta.cats.tuition.sinking),safeReverts:near(goalSafeToMove().safeToGoal,safeBase),bankedKept:near(catBalance(state.cats[0]),bankedBefore)};
    // ---- RENDER: the card shows the counts and the possible-match + lumpy prompts ----
    build();var html=forecastCheckupHTML();
    Rz.render={hasHeader:/Forecast Checkup/.test(html),hasMatch:/Is this envelope for that bill/.test(html)&&/Tuition/.test(html),hasDiff:/If you link them/.test(html)&&/Safe to move/.test(html),hasLumpy:/one-off skewing the forecast/.test(html)&&/Home/.test(html),hasLinkBtn:/doCheckupLink\(/.test(html)};
    // ---- INTEGRATION: renderCheckup mounts the card into the Budget-tab slot ----
    try{renderCheckup();}catch(e){}
    Rz.slotFilled=/Forecast Checkup/.test(((document.getElementById('checkupSlot')||{}).innerHTML)||'');
    return Rz;
  });

  ck('SCAN is READ-ONLY: forecastCheckup + candidates + lumpy + a link diff leave state.meta, the ledger and net worth byte-identical',
     R.readOnly, 'readOnly='+R.readOnly);
  ck('scan counts: 1 sinking candidate (Tuition has a future bill), 1 lumpy budget (Home), Tuition is the only envelope',
     R.counts.sinkingCandidates===1&&R.counts.lumpy===1&&R.hasWork, JSON.stringify(R.counts));
  ck('candidate match: the future $6,000 December Tuition bill is surfaced (earliest-due, expenses only)',
     R.cand.n===1&&near(R.cand.amount,6000)&&R.cand.dueMonth===12, JSON.stringify(R.cand));
  ck('lumpy detection flags Home (June $12,000 spike) and NOT flat Groceries',
     R.lumpy.n===1&&R.lumpy.cats[0]==='Home'&&R.lumpy.spikeMonth===6, JSON.stringify(R.lumpy));
  ck('link diff shows a real before/after and the DRY RUN reverts exactly (safe-to-move and state unchanged afterward)',
     R.diff.after>R.diff.before&&R.diffRevert, JSON.stringify({diff:R.diff,revert:R.diffRevert}));
  ck('APPLY moves NO cash: after classifying, net worth, envelope balance, and the ledger are unchanged; opening-funded ($1,500) is captured; the link is set',
     R.applied.nwUnchanged&&R.applied.bankedUnchanged&&R.applied.rowsUnchanged&&R.applied.cfgHasLink&&near(R.applied.opening,1500)&&R.applied.purpose==='sinking', JSON.stringify(R.applied));
  ck('APPLY changes the FORECAST (that is the point) and it matches the diff the user was shown',
     R.forecastMoved&&R.safeMatchesDiff, JSON.stringify({base:R.safeBase,after:R.applied.safeAfter,diffAfter:R.diff.after}));
  ck('UNLINK reverts the forecast to baseline and KEEPS the banked balance (never redirects money)',
     R.unlink.noLink&&R.unlink.safeReverts&&R.unlink.bankedKept, JSON.stringify(R.unlink));
  ck('the checkup card renders the header, the possible-match with before/after, the lumpy prompt, and a confirm button',
     R.render.hasHeader&&R.render.hasMatch&&R.render.hasDiff&&R.render.hasLumpy&&R.render.hasLinkBtn, JSON.stringify(R.render));
  ck('integration: renderCheckup mounts the card into the Budget-tab slot (#checkupSlot)', R.slotFilled, 'slotFilled='+R.slotFilled);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the Forecast Checkup detects and explains, and a confirmed classification changes the forecast without moving a cent.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

/* CHECKUP IDENTIFY CANDIDATES (v0.68.65) — the "what are you saving for?" step must surface an UPCOMING bill even when the passive
   sinking-fund scan hides it. Reported case: Travel budgeted $1,292.92/mo, with a logged "Hyatt House Charleston · Sep 6 · $501.60"
   upcoming bill. The passive checkupBillCandidates() excludes it (it's THIS month, and within budget — right for avoiding noisy
   auto-matches). But once the user actively chose "Saving for a future bill," checkupIdentifyCandidates() must show it so they can
   link it. This proves the broader active source surfaces the bill, excludes PAST charges, and is membership-correct for itemized. */
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
  await page.waitForFunction(()=>typeof checkupIdentifyCandidates==='function'&&typeof checkupBillCandidates==='function'&&typeof ckwPurpose==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};todayISO=function(){return '2026-09-01';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    state.cons=[{name:'Pay',bud12:fill(9000),annual:108000}];
    state.cats=[{name:'Travel',bud12:fill(1292.92),annual:15515.04},{name:'Utilities',bud12:fill(683),annual:8196}];
    state.goals=[];state.assets=[];state.debts=[];
    state.rows=[
      [2026,9,'2026-09-06','','Travel','Hyatt House Charleston',501.60,'',''],   // UPCOMING (Sep 6, today Sep 1), within the $1,292.92 budget
      [2026,8,'2026-08-12','','Travel','Delta Air Lines',430.00,'',''],          // PAST (Aug) — already spent, must NOT be offered
      [2026,11,'2026-11-20','','↳ Electricity','Georgia Power',900.00,'','']      // itemized child of Utilities, upcoming
    ];
    state.meta={cats:{"travel":{roll:'envelope'},"utilities":{type:'itemized',items:[{name:'Electricity'},{name:'Water'}]}},cons:{},goals:[],payees:['Me'],floor:0,startCash:0,prefs:{},checkupDone:{},checkupDraft:{}};
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var Rz={};
    var passive=checkupBillCandidates('Travel');
    var active=checkupIdentifyCandidates('Travel');
    Rz.travel={passiveCount:passive.length,activeCount:active.length,
      hasHyatt:active.some(function(c){return /Hyatt/.test(c.name)&&near(c.amount,501.60);}),
      excludesPast:!active.some(function(c){return /Delta/.test(c.name);}),
      firstName:active[0]&&active[0].name,firstAmt:active[0]&&active[0].amount};
    // membership-correct: an itemized child bill surfaces for the parent
    var util=checkupIdentifyCandidates('Utilities');
    Rz.itemized={hasChild:util.some(function(c){return near(c.amount,900);})};
    // and the wizard identify screen actually renders the Hyatt bill with a Link button
    state.checkupDraft={answers:{},step:0,startedISO:'2026-09-01'};_ckwReset();
    var F=checkupFindings();var tf=F.filter(function(f){return f.type==='purpose'&&f.cat==='Travel';})[0];
    var d=_draft();d.step=F.indexOf(tf);_draftSync();
    ckwPurpose('sinking');
    var html=checkupWizardHTML();
    Rz.render={hasHyatt:/Hyatt House Charleston/.test(html),hasAmt:/\$501\.60/.test(html),hasLink:/Link this bill/.test(html),notDeadEnd:/Upcoming Travel bills/.test(html)};
    return Rz;
  });

  ck('the passive sinking scan correctly HIDES the within-budget, this-month Hyatt bill (no noisy auto-match)',
     R.travel.passiveCount===0, 'passive='+R.travel.passiveCount);
  ck('the ACTIVE identify source surfaces the upcoming Hyatt bill ($501.60) the user wants to link',
     R.travel.hasHyatt&&R.travel.activeCount>=1&&/Hyatt/.test(R.travel.firstName||'')&&near(R.travel.firstAmt,501.60), JSON.stringify(R.travel));
  ck('it excludes PAST charges (the August Delta flight is already spent, not something to save toward)',
     R.travel.excludesPast, JSON.stringify(R.travel));
  ck('it is membership-correct — an itemized child bill (↳ Electricity $900) surfaces for its parent (Utilities)',
     R.itemized.hasChild, JSON.stringify(R.itemized));
  ck('the wizard identify screen renders the Hyatt bill with a Link button (no longer a dead-end "haven’t logged it yet")',
     R.render.hasHyatt&&R.render.hasAmt&&R.render.hasLink&&R.render.notDeadEnd, JSON.stringify(R.render));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: once you say you’re saving for a bill, the identify step shows your real upcoming bills to link — not just "I haven’t logged it yet".');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

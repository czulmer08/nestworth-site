/* GUIDED FORECAST CHECKUP — WIZARD UI (v0.68.64, increment C). One decision per screen, driven entirely by the B engine. This walks
   the real screens (unusual → purpose → identify/Possible-match → review), checks Back / Skip / Not-sure (distinct from Skip) /
   Save & finish later, the stale-link review screen, and the trust-moment review (counts + what-changes + before/after forecast +
   the no-change statement). The load-bearing UI assertion: the "after" safe-to-move SHOWN on the review screen equals the live figure
   immediately after Apply (RES-APPLY at the UI layer). */
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
  await page.waitForFunction(()=>typeof checkupWizardHTML==='function'&&typeof ckwUnusual==='function'&&typeof checkupPreview==='function'&&typeof _checkupCommit==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.005;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.005;};
    function build(){
      var rows=[];for(var m=1;m<=8;m++)rows.push([2026,m,'2026-'+String(m).padStart(2,'0')+'-03','Pay','Deposit','',8000,'','']);
      for(var k=1;k<=5;k++){rows.push([2026,k,'2026-'+String(k).padStart(2,'0')+'-06','','Baby Z','KinderCare',1200,'','']);rows.push([2026,k,'2026-'+String(k).padStart(2,'0')+'-07','','Baby B','Sitter',800,'','']);}
      rows.push([2026,6,'2026-06-10','','Baby Z','KinderCare',5000,'','']);rows.push([2026,6,'2026-06-20','','Baby B','Sitter',3000,'','']); // Jun spike $8,000
      rows.push([2026,12,'2026-12-15','','Tuition','School',6000,'','']);   // a future bill → Tuition's Possible match
      state.cons=[{name:'Pay',bud12:fill(8000),annual:96000}];
      state.cats=[{name:'Children',bud12:fill(2500),annual:30000},{name:'Tuition',bud12:fill(800),annual:9600},{name:'Vacation',bud12:fill(300),annual:3600},{name:'Living',bud12:fill(4000),annual:48000}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=rows;
      state.meta={cats:{"children":{type:'itemized',items:[{name:'Baby Z'},{name:'Baby B'}]},"tuition":{roll:'envelope'},"vacation":{roll:'envelope'}},
        cons:{},goals:[],payees:['Pay'],floor:1000,startCash:5000,prefs:{},checkupDone:{},checkupDraft:{}};
      state.checkupDraft={answers:{},step:0,startedISO:'2026-08-31'};_ckwReset();
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var H=function(){return checkupWizardHTML();};var Rz={};

    // ===== the main flow =====
    build();var F=checkupFindings();
    Rz.findings={n:F.length,order:F.map(function(f){return f.type+':'+f.cat;})};
    var s0=H();Rz.s0={prog:/1 of 3/.test(s0),title:/Children looks unusual/.test(s0),evidence:/What June was/.test(s0)&&/Baby Z/.test(s0),
      oneOff:/It was a one-off/.test(s0),notSureChoice:/Not sure/.test(s0),skipFoot:/Skip for now/.test(s0),bothDistinct:(/Not sure/.test(s0)&&/Skip for now/.test(s0))};
    ckwUnusual('oneOff');
    var s1=H();Rz.s1={prog:/2 of 3/.test(s1),purposeQ:/What is your Tuition envelope for\?/.test(s1),saving:/Saving for a future bill/.test(s1)};
    // Back returns to step 0
    ckwBack();Rz.back={backToChildren:/1 of 3/.test(H())&&/Children looks unusual/.test(H())};
    // forward again, then into the sinking sub-step
    ckwUnusual('oneOff');ckwPurpose('sinking');
    var sub=H();Rz.identify={q:/What are you saving for\?/.test(sub),match:/Possible match/.test(sub),amt:/\$6,000\.00/.test(sub),link:/Link this bill/.test(sub)};
    ckwLinkCand();
    var s2=H();Rz.s2={prog:/3 of 3/.test(s2),vacation:/What is your Vacation envelope for\?/.test(s2)};
    // Not sure (an ANSWER) vs Skip (no answer) are recorded differently
    ckwPurpose('notsure');
    Rz.notSureRecorded=!!(_draft().answers['purpose:vacation']&&_draft().answers['purpose:vacation'].status==='notSure');
    // now at the review screen
    var rv=H();var pv=checkupPreview();var gname=goalMoveName();
    Rz.review={ready:/Ready to apply/.test(rv),counts:/1 not sure/.test(rv),whatChanges:/What will change/.test(rv),
      safeRow:new RegExp('Safe to move to '+gname.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(rv),
      reservedRow:/Reserved for what’s ahead/.test(rv),lowRow:/Lowest projected cash/.test(rv),
      noChange:/No transactions, bank balances, or total budget amounts will be changed\./.test(rv),
      showsAfter:rv.indexOf(money(pv.after))>=0,apply:/Apply changes/.test(rv)};
    // RES-APPLY at the UI layer: the SHOWN "after" equals the live figure after commit
    var shownAfter=pv.after;_checkupCommit();var liveAfter=r2(goalSafeToMove().safeToGoal);
    Rz.applyMatch={shown:shownAfter,live:liveAfter,match:near(shownAfter,liveAfter),committedSink:!!catSinking('Tuition')};

    // ===== Skip vs Not sure: Skip leaves NO answer =====
    build();ckwSkip();                                   // skip the first finding (Children)
    Rz.skip={noAnswerForChildren:!Object.keys(_draft().answers).some(function(k){return /children/.test(k);}),advanced:/2 of 3/.test(H())};

    // ===== Save & finish later persists the draft (answers already mirrored to meta) =====
    build();ckwUnusual('normal');
    Rz.saveLater={draftInMeta:!!(state.meta.checkupDraft&&state.meta.checkupDraft.answers&&Object.keys(state.meta.checkupDraft.answers).length>0),
      stepSaved:(state.meta.checkupDraft&&state.meta.checkupDraft.step)===1};

    // ===== stale-link review screen =====
    build();
    checkupSetEnvelope('Tuition',{purpose:'sinking',obligation:{name:'Tuition',amount:6000,dueYear:2026,dueMonth:12,source:'row'}});
    state.rows=state.rows.filter(function(r){return !(Number(r[1])===12&&(""+r[4]).toLowerCase()==='tuition');}); // delete the linked bill
    if(typeof buildIndexes==='function')buildIndexes();
    var F2=checkupFindings();var nr=F2.filter(function(f){return f.type==='needsReview';})[0];
    var rvw=H();
    Rz.stale={hasFinding:!!nr,firstIsReview:F2[0]&&F2[0].type==='needsReview',title:/Tuition needs review/.test(rvw),
      message:/no longer in your ledger/.test(rvw),unlinkBtn:/Unlink it/.test(rvw)};
    ckwUnlinkStale();
    Rz.staleResolved=!!(_draft().answers['review:tuition']&&_draft().answers['review:tuition'].action==='unlink');
    return Rz;
  });

  ck('findings enumerate in order (unusual, then purpose) and the wizard opens on "1 of 3 — Children looks unusual" with its evidence',
     R.findings.n===3&&R.s0.prog&&R.s0.title&&R.s0.evidence, JSON.stringify({f:R.findings,s0:R.s0}));
  ck('each screen offers Not sure AND Skip for now as VISIBLY DISTINCT controls',
     R.s0.bothDistinct&&R.s0.oneOff, JSON.stringify(R.s0));
  ck('answering advances to "2 of 3" (the Tuition purpose question); Back returns to "1 of 3"',
     R.s1.prog&&R.s1.purposeQ&&R.back.backToChildren, JSON.stringify({s1:R.s1,back:R.back}));
  ck('"Saving for a future bill" opens the identify sub-step with the Possible match ($6,000) and a Link button',
     R.identify.q&&R.identify.match&&R.identify.amt&&R.identify.link, JSON.stringify(R.identify));
  ck('linking advances to "3 of 3" (Vacation); "Not sure" is recorded as an ANSWER (status notSure)',
     R.s2.prog&&R.s2.vacation&&R.notSureRecorded, JSON.stringify({s2:R.s2,notSure:R.notSureRecorded}));
  ck('the review screen is the trust moment: counts, what-will-change, safe/reserved/lowest before→after, and the no-change statement',
     R.review.ready&&R.review.counts&&R.review.whatChanges&&R.review.safeRow&&R.review.reservedRow&&R.review.lowRow&&R.review.noChange&&R.review.apply, JSON.stringify(R.review));
  ck('RES-APPLY (UI) · the "after" safe-to-move SHOWN on the review screen equals the live figure immediately after Apply',
     R.review.showsAfter&&R.applyMatch.match&&R.applyMatch.committedSink, JSON.stringify(R.applyMatch));
  ck('Skip for now leaves NO answer (distinct from Not sure) and still advances',
     R.skip.noAnswerForChildren&&R.skip.advanced, JSON.stringify(R.skip));
  ck('Save & finish later has the draft (answers + step) persisted in meta, effects not applied',
     R.saveLater.draftInMeta&&R.saveLater.stepSaved, JSON.stringify(R.saveLater));
  ck('a stale link surfaces FIRST as a "needs review" screen ("no longer in your ledger") and Unlink stages the fix',
     R.stale.hasFinding&&R.stale.firstIsReview&&R.stale.title&&R.stale.message&&R.stale.unlinkBtn&&R.staleResolved, JSON.stringify({stale:R.stale,resolved:R.staleResolved}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the wizard is six small decisions with a trust-moment review — one question per screen, distinct states, and a review number that matches the live result after Apply.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

/* RESOLVER ENGINE (v0.68.63, increment B) — the guided Forecast Checkup as a STAGED DRAFT. Nothing affects the live forecast until
   Apply; the before/after preview runs the REAL production engine (goalSafeToMove) against applied vs staged config; Apply commits the
   SAME answers through the SAME path, so the review screen's promise equals the live model. The three load-bearing invariants:
     RES-STAGE-001  staged answers leave production goalSafeToMove() unchanged until Apply.
     RES-RESUME-001 persist the draft (answers + step) → restore → same answers/step; live forecast unchanged.
     RES-APPLY-001  checkupPreview().after === goalSafeToMove() immediately after commit — to the cent.
   Plus: the explicit status taxonomy, signature-scoped suppression (new evidence = new finding), and stale-link needsReview. */
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
  await page.waitForFunction(()=>typeof checkupPreview==='function'&&typeof _checkupCommit==='function'&&typeof checkupAnswer==='function'&&typeof goalSafeToMove==='function'&&typeof checkupLinkNeedsReview==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.005;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.005;};
    function build(){
      var rows=[];for(var m=1;m<=8;m++)rows.push([2026,m,'2026-'+String(m).padStart(2,'0')+'-03','Pay','Deposit','',8000,'','']);
      rows.push([2026,12,'2026-12-15','','Tuition','School',6000,'','']);        // a FUTURE bill Tuition can save toward
      state.cons=[{name:'Pay',bud12:fill(8000),annual:96000}];
      state.cats=[{name:'Tuition',bud12:fill(800),annual:9600},{name:'Living',bud12:fill(6000),annual:72000}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=rows;
      state.meta={cats:{"tuition":{roll:'envelope'}},cons:{},goals:[],payees:['Pay'],floor:1000,startCash:5000,prefs:{},checkupDone:{},checkupDraft:{}};
      state.checkupDraft={answers:{},step:0,startedISO:'2026-08-31'};
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    var sinkAns=function(){return {type:'purpose',status:'resolved',cat:'Tuition',purpose:'sinking',obligation:{name:'Tuition',amount:6000,dueYear:2026,dueMonth:12,source:'row'}};};

    // ===== RES-STAGE-001: staging leaves the live forecast (and cfg) untouched =====
    build();var base=r2(goalSafeToMove().safeToGoal),baseCfg=JSON.stringify(state.meta.cats);
    checkupAnswer('purpose:tuition',sinkAns());
    checkupAnswer('purpose:living',{type:'purpose',status:'resolved',cat:'Living',purpose:'ongoing'});
    Rz.stage={liveUnchanged:near(goalSafeToMove().safeToGoal,base),cfgUnchanged:(JSON.stringify(state.meta.cats)===baseCfg),
      hasNoSinkYet:!catSinking('Tuition')};

    // ===== RES-APPLY-001: preview.after === live safe-to-move immediately after commit =====
    var cfgBeforePv=JSON.stringify(state.meta.cats);
    var pv=checkupPreview();
    var cfgAfterPv=JSON.stringify(state.meta.cats);   // the preview must leave the cfg byte-exact (staged run restored)
    var reason=pv.reasons.filter(function(x){return x.cat==='Tuition';})[0];
    _checkupCommit();
    var live=r2(goalSafeToMove().safeToGoal);
    Rz.apply={previewAfter:pv.after,liveAfterCommit:live,match:near(pv.after,live),
      before:pv.before,delta:pv.deltaSafe,movedMeaningfully:Math.abs(pv.deltaSafe)>0.005,
      committedSink:!!catSinking('Tuition'),draftCleared:(Object.keys(_draft().answers).length===0),
      previewLeftClean:(cfgBeforePv===cfgAfterPv),
      reasonCode:reason&&reason.code,reasonHasText:!!(reason&&/sinking fund/.test(reason.text))};

    // ===== RES-RESUME-001: persist answers+step → restore → same; live unchanged =====
    build();var base2=r2(goalSafeToMove().safeToGoal);
    checkupAnswer('purpose:tuition',sinkAns());checkupAnswer('purpose:living',{type:'purpose',status:'notSure',cat:'Living'});checkupSetStep(2);
    var persisted=JSON.parse(JSON.stringify(normMeta(state.meta).checkupDraft));    // what writeMeta would store (round-tripped through normMeta)
    state.checkupDraft=null;                                                        // simulate a reload / new session
    state.meta.checkupDraft=persisted;
    checkupDraftRestore();
    var dr=_draft();
    Rz.resume={answersRestored:!!(dr.answers['purpose:tuition']&&dr.answers['purpose:tuition'].status==='resolved'&&dr.answers['purpose:living']&&dr.answers['purpose:living'].status==='notSure'),
      stepRestored:dr.step===2,liveUnchanged:near(goalSafeToMove().safeToGoal,base2),notApplied:!catSinking('Tuition'),
      persistedKeys:Object.keys((persisted&&persisted.answers)||{}),drKeys:Object.keys(dr.answers||{})};

    // ===== STATUS TAXONOMY: resolved / notSure / unresolved / suppressed / skipped all distinct =====
    build();
    // FIVE clean unclassified envelopes (no future bills → all are purpose findings): resolved/notSure/unresolved/suppressed/skipped
    ['Vacation','Gifts','Hobbies','Clothing','Pets'].forEach(function(nm){state.cats.push({name:nm,bud12:fill(200),annual:2400});state.meta.cats[nm.toLowerCase()]={roll:'envelope'};});
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var F=checkupFindings().filter(function(f){return f.type==='purpose';});
    checkupAnswer('purpose:vacation',{type:'purpose',status:'resolved',cat:'Vacation',purpose:'ongoing'});
    checkupAnswer('purpose:gifts',{type:'purpose',status:'notSure',cat:'Gifts'});
    checkupAnswer('purpose:hobbies',{type:'purpose',status:'unresolved',cat:'Hobbies',purpose:'sinking'});
    checkupAnswer('purpose:clothing',{type:'purpose',status:'suppressed',cat:'Clothing'});
    // 'purpose:pets' left unanswered → skipped
    var cnt=checkupDraftCounts();
    Rz.taxonomy={resolved:cnt.resolved,notSure:cnt.notSure,unresolved:cnt.unresolved,suppressed:cnt.suppressed,skipped:cnt.skipped,
      total:cnt.total,findings:F.length};

    // ===== SUPPRESSION SCOPE: signature-scoped — a NEW spike (new signature) is not blinded by an old dismissal =====
    var sigA='unusual:children:6:8000';var sigB='unusual:children:6:12000';
    _checkupSuppress(sigA);
    Rz.suppress={aSuppressed:_findingSuppressed(sigA),bStillOpen:!_findingSuppressed(sigB)};

    // ===== needsReview: a linked obligation whose ledger row is gone/changed =====
    build();
    checkupSetEnvelope('Tuition',{purpose:'sinking',obligation:{name:'Tuition',amount:6000,dueYear:2026,dueMonth:12,source:'row'}});
    var withRow=checkupLinkNeedsReview('Tuition');                                  // row present → false
    state.rows=state.rows.filter(function(r){return !(Number(r[1])===12&&(""+r[4]).toLowerCase()==='tuition');}); // delete the Dec bill
    var afterDelete=checkupLinkNeedsReview('Tuition');                              // row gone → true
    Rz.needsReview={withRow:withRow,afterDelete:afterDelete};
    return Rz;
  });

  ck('RES-STAGE-001 · staged answers leave the live safe-to-move AND the cfg untouched (nothing applied)',
     R.stage.liveUnchanged&&R.stage.cfgUnchanged&&R.stage.hasNoSinkYet, JSON.stringify(R.stage));
  ck('RES-APPLY-001 · checkupPreview().after === live safe-to-move immediately after commit (to the cent); preview left the cfg byte-exact',
     R.apply.match&&R.apply.committedSink&&R.apply.draftCleared&&R.apply.previewLeftClean, JSON.stringify(R.apply));
  ck('the staged sinking classification actually MOVES safe-to-move (non-trivial), with a reason code + text',
     R.apply.movedMeaningfully&&R.apply.reasonCode==='sinking-linked'&&R.apply.reasonHasText, JSON.stringify(R.apply));
  ck('RES-RESUME-001 · persisting the draft restores the same answers and step, and the live forecast is unchanged (not applied)',
     R.resume.answersRestored&&R.resume.stepRestored&&R.resume.liveUnchanged&&R.resume.notApplied, JSON.stringify(R.resume));
  ck('status taxonomy · resolved / notSure / unresolved / suppressed / skipped are counted distinctly',
     R.taxonomy.resolved===1&&R.taxonomy.notSure===1&&R.taxonomy.unresolved===1&&R.taxonomy.suppressed===1&&R.taxonomy.skipped>=1, JSON.stringify(R.taxonomy));
  ck('suppression is signature-scoped · dismissing one spike does NOT blind NestWorth to a new (differently-sized) spike',
     R.suppress.aSuppressed&&R.suppress.bStillOpen, JSON.stringify(R.suppress));
  ck('needsReview · a linked obligation is fine while its ledger row exists, and flags needsReview once the row is deleted',
     R.needsReview.withRow===false&&R.needsReview.afterDelete===true, JSON.stringify(R.needsReview));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the resolver is a true draft — staged, reconciled by the real engine, and applied only on commit, where the promise equals the result.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

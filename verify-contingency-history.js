/* CONTINGENCY HISTORY / TEMPORAL questions (found by ordinary use — screenshot audit). A TIME question ("WHEN did my contingency
   become overspent?") is a DIFFERENT question from a STATE question ("IS my contingency overspent?") and must not be answered by
   repeating the current balance. getContingencyFacts() exposes the month-by-month pool history + firstNegativeMonth/lastPositiveMonth;
   Wren narrates it (narrator-not-calculator). Also proves the STATE answer ("how much is in my contingency after my bills?") is CLEAN —
   balance + available + why — and no longer dumps uncovered-envelope or year-end lines the user didn't ask for. */
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
  await page.waitForFunction(()=>typeof getContingencyFacts==='function'&&typeof wrenAnalyze==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    var SPEND={};window.catSpend12=function(n){return (SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // A buffer "Cushion" (budget $500/mo) that banks Jan–Apr, drops hard in MAY (biggest single-month drop, but still positive),
    // and finally CROSSES negative in JULY. Cumulative: 200,400,600,800,100,100,−400 → firstNegative = July, last positive = June.
    // A "Children" envelope deeply in the red + heading worse (to prove the STATE answer does NOT drag these in).
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"},"children":{type:"monthly",roll:"envelope"}}};
    state.cats=[
      {name:"Cushion",mbud:500,mused:1000,bud12:fill(500)},
      {name:"Children",mbud:500,mused:900,bud12:fill(500)}];
    SPEND["cushion"] =[300,300,300,300,1200,500,1000,0,0,0,0,0]; // → cumulative 200,400,600,800,100,100,−400 (through Jul)
    SPEND["children"]=[900,900,900,900,900,900,900,900,0,0,0,0]; // bal 7*(500−900)=−2800, at year-end risk
    state.rows=[[2026,8,'2026-08-01','','x','',0,'','N']]; // non-empty so wrenAnalyze runs
    state.goals=[];state.assets=[];state.debts=[];

    var cf=getContingencyFacts();
    var A=function(q){var r=wrenAnalyze(q);return (r&&(r.answer||r.text))||"";};
    return {
      cf:{firstNeg:cf.firstNegativeMonth,firstNegBal:cf.firstNegativeBal,lastPos:cf.lastPositiveMonth,lastPosBal:cf.lastPositiveBal,
          raw:cf.rawBuffer,over:cf.isOverspent,drop:cf.dropMonth,dropAmt:cf.dropAmt,carry:cf.carryIn,histLen:cf.history.length,histLastBal:cf.history[cf.history.length-1].bal},
      whenOver:A("When did my contingency become overspent?"),
      whenNeg:A("What month did my contingency go negative?"),
      lastPos:A("When was my contingency last positive?"),
      before:A("How much contingency did I have before it went negative?"),
      state:A("How much is in my contingency this month after my bills?"),
      isOver:A("Is my contingency overspent?")
    };
  });

  // ENGINE: the month-by-month crossing is computed correctly and reconciles to the current raw balance.
  ck('getContingencyFacts: firstNegativeMonth = July (7), ending ≈ −$400; last positive = June (6) at ≈ $200; history reconciles to rawBuffer',
     R.cf.firstNeg===7&&Math.abs(R.cf.firstNegBal+400)<0.02&&R.cf.lastPos===6&&Math.abs(R.cf.lastPosBal-100)<0.02&&Math.abs(R.cf.raw+400)<0.02&&Math.abs(R.cf.histLastBal-R.cf.raw)<0.02&&R.cf.over===true, JSON.stringify(R.cf));
  ck('getContingencyFacts: biggest single-month drop = May (month 5, ≈ −$700) — distinct from the crossing month',
     R.cf.drop===5&&Math.abs(R.cf.dropAmt+700)<0.02, JSON.stringify({drop:R.cf.drop,amt:R.cf.dropAmt}));

  // ROUTING: a temporal question is answered as a TIME question (names the month), NOT as the current-state repeat.
  ck('"When did my contingency become overspent?" → names the month it first went negative (July), not just the current balance',
     /July/.test(R.whenOver)&&/first went negative|went negative in July/i.test(R.whenOver)&&R.whenOver.indexOf('June')>=0, R.whenOver);
  ck('"What month did my contingency go negative?" → also names July (temporal synonym routes the same)',
     /July/.test(R.whenNeg)&&/negative/i.test(R.whenNeg), R.whenNeg);
  ck('"When was my contingency last positive?" → names June (the last in-the-black month), then the crossing',
     /June/.test(R.lastPos)&&/last positive|in the black/i.test(R.lastPos), R.lastPos);
  ck('"How much did I have before it went negative?" → gives the pre-crossing balance (≈ $100), not the current −$400',
     R.before.indexOf('$100.00')>=0&&R.before.indexOf('-$400.00')>=0&&/before|last positive|June/i.test(R.before), R.before);

  // STATE answer is CLEAN: balance + available + why — and does NOT drag in uncovered-envelope or year-end lines.
  ck('"How much is in my contingency after my bills?" → clean balance/$0-available/why answer',
     /balance is -\$400\.00/.test(R.state)&&/\$0 available/.test(R.state)&&/overspent by \$400\.00/.test(R.state), R.state);
  ck('STATE answer does NOT over-answer (no "Children", no "year-end", no "uncovered" envelope dump)',
     R.state.indexOf('Children')<0&&!/year-end/i.test(R.state)&&!/uncovered/i.test(R.state), R.state);
  ck('the STATE and TEMPORAL answers are DIFFERENT strings (the bug was answering both identically)',
     R.state!==R.whenOver&&R.isOver!==R.whenOver, JSON.stringify({stateEqWhen:R.state===R.whenOver,isOverEqWhen:R.isOver===R.whenOver}));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

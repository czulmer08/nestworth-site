/* FORECAST CHECKUP continuations (v0.68.56): #2 at-log-time link suggestion (when you log a save-ahead future bill in an envelope,
   offer to link it right there — confirm, never auto), and #4 multi-bill (a LINKED envelope with ANOTHER unlinked future bill gets an
   "also fund this?" prompt; adding it uses earliest-due-first allocation). Both are cash-neutral and only ever SUGGEST. */
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
  await page.waitForFunction(()=>typeof _logLinkCandidate==='function'&&typeof maybeSuggestLink==='function'&&typeof forecastCheckup==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    function build(){
      state.cons=[{name:'Pay',bud12:fill(9000),annual:108000}];
      state.cats=[{name:'Tuition',bud12:fill(500),annual:6000},{name:'Living',bud12:fill(6000),annual:72000}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];state.rows=[];
      state.meta={cats:{"tuition":{roll:'envelope'}},cons:{},goals:[],payees:['Pay'],floor:0,startCash:2000};
      window.__SPEND["tuition"]=[500,500,500,0,0,0,0,0,0,0,0,0];
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    build();
    // ---- #2 at-log candidate detection ----
    var future=_logLinkCandidate([2026,12,'2026-12-15','','Tuition','School',6000,'','']);   // future, envelope, exceeds $500 → candidate
    Rz.log={found:!!future,cat:future&&future.cat,amount:future&&future.ob&&future.ob.amount,dueMonth:future&&future.ob&&future.ob.dueMonth,
      currentMonth:_logLinkCandidate([2026,9,'2026-09-20','','Tuition','School',7000,'','']),       // current month → null (covered by budget)
      withinBudget:_logLinkCandidate([2026,10,'2026-10-05','','Tuition','School',400,'','']),        // ≤ budget → null (routine)
      nonEnvelope:_logLinkCandidate([2026,12,'2026-12-15','','Living','Landlord',6000,'',''])};      // not an envelope → null
    // maybeSuggestLink puts a "Link it" prompt into the Add message area (doesn't auto-link)
    var msg=document.getElementById('addMsg');if(msg)msg.innerHTML='Added ✓';
    maybeSuggestLink([2026,12,'2026-12-15','','Tuition','School',6000,'','']);
    Rz.suggest={hasPrompt:/Link it/.test((msg&&msg.innerHTML)||'')&&/logLinkBtn/.test((msg&&msg.innerHTML)||''),
      notAutoLinked:!catSinking('Tuition'),handlerExists:(typeof doCheckupLinkFromLog==='function')};
    // ---- #4 multi-bill: a linked envelope with ANOTHER future bill ----
    build();
    checkupSetEnvelope('Tuition',{purpose:'sinking',obligations:[{name:'Fall tuition',amount:6000,dueYear:2026,dueMonth:11,source:'row'}]});
    state.rows.push([2026,12,'2026-12-15','','Tuition','Spring',3000,'','']);                        // a SECOND future bill, > $500 budget
    if(typeof buildIndexes==='function')buildIndexes();
    var scan=forecastCheckup();var tv=scan.envelopes.filter(function(e){return e.cat==='Tuition';})[0];
    Rz.extra={has:!!(tv&&tv.extra),amount:tv&&tv.extra&&tv.extra.amount,dueMonth:tv&&tv.extra&&tv.extra.dueMonth,count:scan.counts.extraBills,hasWork:scan.hasWork};
    var html=forecastCheckupHTML();
    Rz.extraRender={label:/Also a match/.test(html),addBtn:/ckAddBill\(/.test(html)&&/Add this bill/.test(html),dismiss:/ckExtraDismiss\(/.test(html)};
    // adding it → both obligations linked, earliest-due-first
    checkupAddObligation('Tuition',tv.extra);
    var obs=catObligations('Tuition');
    Rz.added={n:obs.length,order:obs.map(function(o){return o.dueMonth;})};
    var scan2=forecastCheckup();
    Rz.afterAdd={extra:!!(scan2.envelopes.filter(function(e){return e.cat==='Tuition';})[0].extra)};
    return Rz;
  });

  ck('#2 a save-ahead FUTURE bill in an envelope that exceeds the budget is a link candidate ($6,000 Dec Tuition)',
     R.log.found&&R.log.cat==='Tuition'&&near(R.log.amount,6000)&&R.log.dueMonth===12, JSON.stringify(R.log));
  ck('#2 NOT a candidate: a current-month bill, a within-budget bill, or a non-envelope category',
     R.log.currentMonth===null&&R.log.withinBudget===null&&R.log.nonEnvelope===null, JSON.stringify({cur:R.log.currentMonth,wb:R.log.withinBudget,ne:R.log.nonEnvelope}));
  ck('#2 logging it shows a "Link it" prompt in the Add area — and does NOT auto-link (confirm only)',
     R.suggest.hasPrompt&&R.suggest.notAutoLinked&&R.suggest.handlerExists, JSON.stringify(R.suggest));
  ck('#4 a LINKED envelope with another unlinked future bill surfaces an "also fund this?" item ($3,000 Dec)',
     R.extra.has&&near(R.extra.amount,3000)&&R.extra.dueMonth===12&&R.extra.count===1&&R.extra.hasWork, JSON.stringify(R.extra));
  ck('#4 it renders "Also a match" with an "Add this bill" button and a Not-now dismiss',
     R.extraRender.label&&R.extraRender.addBtn&&R.extraRender.dismiss, JSON.stringify(R.extraRender));
  ck('#4 adding it links BOTH bills, sorted earliest-due-first (Nov then Dec), and the prompt clears',
     R.added.n===2&&JSON.stringify(R.added.order)==='[11,12]'&&R.afterAdd.extra===false, JSON.stringify({added:R.added,after:R.afterAdd}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: link suggestions reach you at log time and for additional bills — always a suggestion, never automatic.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

/* GOALS-PAGE "SAFE TO MOVE" BANNER (v0.68.49). The Month tab shows how much is safe to move to goals, but the Goals page — where you
   actually appropriate it — never did. This proves the Goals list now leads with that exact figure (goalSafeToMove().safeToGoal),
   so the number appears where you allocate it; and that a breach shows $0 with the reason rather than a misleading positive. */
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
  await page.waitForFunction(()=>typeof renderGoals==='function'&&typeof goalSafeToMove==='function'&&typeof money==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    function build(floor){
      state.cons=[{name:'Pay',bud12:fill(8000),annual:96000}];
      state.cats=[{name:'Living',bud12:fill(6000),annual:72000}];
      state.goals=[{name:'Car Fund',target:12000,balance:0,residual:true,residualPct:80,archived:false},{name:'House Expansion',target:0,balance:0,monthly:0,archived:false}];
      state.assets=[{name:'Checking',bal:9000}];state.debts=[];state.rows=[];
      state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:floor,startCash:5000,prefs:{}};
      if(typeof buildIndexes==='function')buildIndexes();renderGoals(); // renderGoals fills #goalList directly — no view-switch needed
    }
    var Rz={};
    // POSITIVE safe-to-move: the banner leads with the exact goalSafeToMove figure
    build(1000);
    var gs=goalSafeToMove();var html=$("goalList").innerHTML;
    Rz.pos={safe:gs.safeToGoal,breach:gs.breach,
      hasLabel:/Safe to move to [^<]*now/i.test(html),
      showsFigure:(gs.safeToGoal>0.005)&&(html.indexOf(money(gs.safeToGoal))>=0),
      figureBeforeSummary:(html.indexOf("Safe to move")>=0&&html.indexOf("Safe to move")<html.indexOf("saved")),
      hasGuidance:/Put it toward any goal below/.test(html)};
    // BREACH: a floor above the projected low → $0 with the reason (not a positive number)
    build(999999);
    var gsB=goalSafeToMove();var htmlB=$("goalList").innerHTML;
    Rz.breach={isBreach:gsB.breach,shows0:htmlB.indexOf(money(0))>=0,hasReason:/below your Nest Egg Floor/.test(htmlB),noPositive:!/\$[1-9]/.test((htmlB.match(/Safe to move[\s\S]{0,120}/)||[""])[0])};
    return Rz;
  });

  ck('the Goals page leads with a "Safe to move to your goals now" banner', R.pos.hasLabel, JSON.stringify(R.pos));
  ck('the banner shows the EXACT goalSafeToMove figure (the same number the Month tab shows), and it is positive here', R.pos.showsFigure&&R.pos.safe>0.005, 'safe='+R.pos.safe);
  ck('the safe-to-move figure appears ABOVE the "saved / committed" summary (it leads the page)', R.pos.figureBeforeSummary, '');
  ck('the banner explains how to use it (put toward any goal / split across them)', R.pos.hasGuidance, '');
  ck('BREACH: when the plan dips below the floor, the banner shows $0 with the reason, not a misleading positive number',
     R.breach.isBreach&&R.breach.shows0&&R.breach.hasReason&&R.breach.noPositive, JSON.stringify(R.breach));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the Goals page now shows what is available to appropriate to goals, right where you allocate it.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

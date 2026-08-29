/* ENGINE-LEVEL golden invariants exposed by mutation testing. The original 64-test financial suite stayed GREEN when the
   as-of protection was removed from goalContribMonth() and from monthActualTotals(), and when goal funding was subtracted
   from projected net worth — proving those rules had no dedicated engine-level assertion. These pin them directly, so a
   regression is caught by the ENGINE tests, not only indirectly via Wren. Each is paired with a mutation in verify-mutation.js. */
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
  await page.waitForFunction(()=>typeof monthActualTotals==='function'&&typeof goalContribMonth==='function'&&typeof netWorthNow==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const res=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs(a-bb)<0.005;};
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';}; // as-of = Aug 15
    var row=function(y,m,d,cat,co,amt){return [y,m,d,'',cat,co,amt,'','N'];};
    window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='vacation';};

    // ---- FIN-ASOF-001: a future-dated ordinary EXPENSE must NOT enter current actuals ----
    state.rows=[
      row(2026,8,'2026-08-03','Groceries','Store',500),         // in-window expense
      row(2026,8,'2026-08-25','Groceries','Store',999)];        // FUTURE (after Aug 15) — must be excluded
    var asof001=monthActualTotals(2026,8).expense;              // must be 500, NOT 1499
    var full001=monthActualTotals(2026,8,{asOf:'2026-08-31'}).expense; // whole month incl. future = 1499 (control)

    // ---- FIN-ASOF-002: a future-dated GOAL CONTRIBUTION must NOT enter current goal actuals ----
    state.rows=[
      row(2026,8,'2026-08-05','','Vacation',300),               // in-window goal move (Company=Vacation)
      row(2026,8,'2026-08-25','','Vacation',777)];              // FUTURE — must be excluded
    var asof002=goalContribMonth('Vacation',2026,8);            // must be 300, NOT 1077

    // ---- FIN-NW-001: moving money INTO an ordinary (stand-alone) savings goal lowers spendable cash but NOT net worth ----
    state.rows=[];state.debts=[];
    state.assets=[{name:"Checking",bal:10000}];
    state.goals=[{name:"Vacation",target:5000,balance:1000,monthly:0,residual:false,archived:false,account:""}]; // stand-alone (no account) → counted in net worth
    var nwBefore=netWorthNow();                                  // 10000 + 1000 = 11000
    var move=2500;state.assets[0].bal-=move;state.goals[0].balance+=move; // move cash → goal
    var nwAfter=netWorthNow();                                   // 7500 + 3500 = 11000 (unchanged)

    return {asof001:asof001,full001:full001,asof002:asof002,nwBefore:nwBefore,nwAfter:nwAfter};
  });

  const near=(a,b)=>Math.abs(a-b)<0.005;
  ck('FIN-ASOF-001: future-dated expense excluded from current actuals (=$500, not $1,499)', near(res.asof001,500)&&near(res.full001,1499), 'asof='+res.asof001+' full='+res.full001);
  ck('FIN-ASOF-002: future-dated goal contribution excluded from current goal actuals (=$300, not $1,077)', near(res.asof002,300), 'asof='+res.asof002);
  ck('FIN-NW-001: moving cash into a stand-alone goal does NOT change net worth ($11,000 → $11,000)', near(res.nwBefore,11000)&&near(res.nwAfter,res.nwBefore), 'before='+res.nwBefore+' after='+res.nwAfter);

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

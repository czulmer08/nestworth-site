/* ENVELOPE COVERAGE — upcoming bills per envelope with a covered/short indicator (v0.68.50). Proves envelopeUpcoming() gathers the
   right bills (linked obligations if any, else upcoming logged expenses in the category, this month forward), allocates the CURRENT
   banked balance earliest-due-first (a banked dollar funds the nearest bill first — never double-counted), marks each covered/short
   correctly, and rolls up "$X still needed" / "all covered". An overspent envelope shows its bills unfunded. Display-only, no engine change. */
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
  await page.waitForFunction(()=>typeof envelopeUpcoming==='function'&&typeof moneyNowHTML==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // Travel envelope banks $2,900; three upcoming logged Travel bills (Oct $1,200, Nov $1,500, Dec $500) → first two covered, third short $300.
    // Children envelope is OVERSPENT (negative) with an upcoming bill → unfunded.
    function build(){
      var rr=[];for(var mo=1;mo<=8;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-03','Pay','Deposit','',5000,'','']);
      rr.push([2026,10,'2026-10-14','','Travel','Flights',1200,'','']);
      rr.push([2026,11,'2026-11-14','','Travel','Hotel',1500,'','']);
      rr.push([2026,12,'2026-12-14','','Travel','Car rental',500,'','']);
      rr.push([2026,11,'2026-11-20','','Children','Tuition',680,'','']); // Children overspent → this bill unfunded
      state.cons=[{name:'Inc',bud12:fill(5000),annual:60000}];
      state.cats=[{name:'Travel',bud12:fill(400),annual:4800},{name:'Children',bud12:fill(500),annual:6000}];
      state.goals=[];state.assets=[];state.debts=[];state.rows=rr;
      state.meta={cats:{"travel":{roll:'envelope'},"children":{roll:'envelope'}},cons:{},goals:[],payees:['Pay'],floor:0,startCash:2000};
      // Travel: budget $400/mo × 8 completed months − $300 spent = $2,900 banked → covers Oct $1,200 + Nov $1,500, leaves $200 for Dec $500 (short $300).
      window.__SPEND["travel"]=[300,0,0,0,0,0,0,0,0,0,0,0];
      window.__SPEND["children"]=[2000,2000,2000,2000,1000,0,0,0,0,0,0,0]; // heavy overspend → negative envelope
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    build();
    var tv=envelopeUpcoming('Travel');
    Rz.travel={banked:tv.banked,n:tv.bills.length,order:tv.bills.map(function(x){return x.dueMonth;}),
      covered:tv.bills.map(function(x){return x.covered;}),shorts:tv.bills.map(function(x){return x.short;}),
      totalBills:tv.totalBills,totalShort:tv.totalShort,allCovered:tv.allCovered};
    var cv=envelopeUpcoming('Children');
    Rz.children={banked:cv.banked,n:cv.bills.length,firstCovered:cv.bills[0]&&cv.bills[0].covered,firstShort:cv.bills[0]&&cv.bills[0].short};
    // a linked envelope uses its OBLIGATIONS as the bill list (not raw rows)
    checkupSetEnvelope('Travel',{purpose:'sinking',obligations:[{name:'Big Trip',amount:4000,dueYear:2026,dueMonth:12,source:'manual'}]});
    var tl=envelopeUpcoming('Travel');
    Rz.linked={n:tl.bills.length,name:tl.bills[0]&&tl.bills[0].name,linked:tl.bills[0]&&tl.bills[0].linked};
    // it renders in the money card's "View envelopes"
    build();var html=moneyNowHTML();
    Rz.render={hasEnvelopes:/View envelopes/.test(html),hasCovered:/✓/.test(html),hasShort:/to go/.test(html),hasRollup:/still needed across|upcoming bills covered|upcoming bill covered/.test(html)};
    return Rz;
  });

  ck('Travel envelope lists its 3 upcoming bills in earliest-due order (Oct, Nov, Dec)',
     R.travel.n===3&&JSON.stringify(R.travel.order)==='[10,11,12]', JSON.stringify(R.travel));
  ck('coverage is allocated earliest-due-first against the banked balance: the first bills are covered, the last is short',
     R.travel.covered[0]===true&&R.travel.covered[1]===true&&R.travel.covered[2]===false, JSON.stringify(R.travel.covered));
  ck('the shortfall on the last bill equals total upcoming − banked (no banked dollar funds two bills)',
     near(R.travel.totalShort,Math.max(0,R.travel.totalBills-R.travel.banked))&&R.travel.totalShort>0.005, JSON.stringify({short:R.travel.totalShort,bills:R.travel.totalBills,banked:R.travel.banked}));
  ck('an OVERSPENT (negative) envelope shows its upcoming bill as unfunded (banked < 0 → covers nothing)',
     R.children.banked<-0.005&&R.children.n>=1&&R.children.firstCovered===false&&near(R.children.firstShort,680), JSON.stringify(R.children));
  ck('a LINKED envelope uses its obligations as the bill list (curated), not the raw rows',
     R.linked.n===1&&R.linked.name==='Big Trip'&&R.linked.linked===true, JSON.stringify(R.linked));
  ck('the money card "View envelopes" renders the bills with covered (✓) / short (to go) marks and a per-envelope roll-up',
     R.render.hasEnvelopes&&R.render.hasCovered&&R.render.hasShort&&R.render.hasRollup, JSON.stringify(R.render));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: each envelope now shows the bills it covers, checked or flagged short against what is actually banked.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

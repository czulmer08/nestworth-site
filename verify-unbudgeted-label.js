/* ADD-SCREEN "SPENT OUTSIDE BUDGET" CLARITY (v0.68.51). The banner fragment used to read "+$X unbudgeted" (looked like a COUNT).
   It is a DOLLAR total of this month's spending in categories that aren't budget lines. This proves the relabel ("$X spent outside
   budget"), the tappable per-category breakdown (largest first; blank category → "Uncategorized"), and that a transaction counts as
   budgeted ONLY when its category matches a BUDGET category name — so a category in the ledger that isn't a budget line stays outside. */
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
  await page.waitForFunction(()=>typeof renderS2S==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // Budget has Food + Travel. This month: Food $200 (budgeted); Mortgage $2,000, PetSmart · Dog Food $99, and a blank-category $100
    // are NOT budget lines → "spent outside budget" = $2,199.
    state.cons=[{name:'Pay',bud12:fill(9000),annual:108000}];
    state.cats=[{name:'Food',mbud:500,mspent:200,mused:200,bud12:fill(500),annual:6000},{name:'Travel',mbud:300,mspent:0,mused:0,bud12:fill(300),annual:3600}];
    state.goals=[];state.assets=[];state.debts=[];
    state.rows=[
      [2026,8,'2026-08-05','','Food','Publix',200,'',''],
      [2026,8,'2026-08-06','','Mortgage','Bank',2000,'',''],
      [2026,8,'2026-08-07','','','Something',100,'',''],
      [2026,8,'2026-08-08','','PetSmart - Dog Food','PetSmart',99,'','']
    ];
    state.meta={cats:{},cons:{},goals:[],payees:['Me'],floor:0,startCash:0,prefs:{}};
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    renderS2S();
    var html=$("s2s").innerHTML;
    return {html:html,
      hasNewLabel:/\$2,199\.00 spent outside budget/.test(html),
      noOldLabel:!/\+\$[0-9,]+\.[0-9]{2} unbudgeted/.test(html),   // the old count-like "+$X unbudgeted" fragment is gone
      hasSummary:/See the \$2,199\.00 spent outside your budget/.test(html),
      hasMortgage:/Mortgage/.test(html)&&/\$2,000\.00/.test(html),
      hasUncategorized:/Uncategorized/.test(html)&&/\$100\.00/.test(html),
      hasPetSmart:/PetSmart - Dog Food/.test(html)&&/\$99\.00/.test(html),
      foodNotListed:!(html.split('See the')[1]||'').match(/\$200\.00/),  // Food is budgeted → its $200 is NOT in the outside-budget breakdown
      // largest-first: Mortgage appears before Uncategorized appears before PetSmart in the breakdown
      order:(function(){var d=html.split('See the')[1]||'';return d.indexOf('Mortgage')<d.indexOf('Uncategorized')&&d.indexOf('Uncategorized')<d.indexOf('PetSmart');})()};
  });

  ck('the fragment is now a clear DOLLAR label — "$2,199.00 spent outside budget" — and the count-like "+$X unbudgeted" is gone',
     R.hasNewLabel&&R.noOldLabel, JSON.stringify({newLabel:R.hasNewLabel,noOld:R.noOldLabel}));
  ck('a tappable breakdown "See the $2,199.00 spent outside your budget" is present', R.hasSummary, '');
  ck('the breakdown lists each non-budget category with its total: Mortgage $2,000, Uncategorized $100, PetSmart · Dog Food $99',
     R.hasMortgage&&R.hasUncategorized&&R.hasPetSmart, JSON.stringify({m:R.hasMortgage,u:R.hasUncategorized,p:R.hasPetSmart}));
  ck('a BUDGETED category (Food) is NOT in the outside-budget breakdown — only categories with no budget line are',
     R.foodNotListed, 'foodNotListed='+R.foodNotListed);
  ck('the breakdown is ordered largest-first (Mortgage → Uncategorized → PetSmart)', R.order, 'order='+R.order);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: "spent outside budget" is a clear dollar figure with a per-category breakdown — no longer mistakable for a count.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

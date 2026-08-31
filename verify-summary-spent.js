/* ACCOUNT SUMMARY "SPENT" ROBUSTNESS (v0.68.54). The per-month Spent SUMIFS gate on an "as of" helper cell ($AC$1). A blank
   $AC$1 (e.g. a freshly-copied year tab whose helper wasn't set) made every Spent cell read 0 across the whole year. Fix: the
   formula degrades gracefully — a blank $AC$1 falls back to end-of-month, so it never blanks the year — while still using $AC$1
   as the "spent so far" cutoff when set. This checks the generated formulas (sumifTerm / bill / parent) carry the graceful guard. */
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
  await page.waitForFunction(()=>typeof sumifTerm==='function'&&typeof billSpentF==='function'&&typeof parentSpentF==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    var term=sumifTerm("$A5",null,8);            // a plain category's August term
    var bill=billSpentF("Utilities","Electricity",8);
    var parent=parentSpentF(5,["Electricity","Water"],8);
    return {
      term:term,
      // graceful: the $AC$1 cutoff is wrapped so a blank helper falls back to end-of-month (never a bare "<="&$AC$1) )
      termGraceful:term.indexOf('"<="&IF($AC$1="",EOMONTH(DATE($B$2,8,1),0),$AC$1)')>=0,
      termNoBareCutoff:term.indexOf('"<="&$AC$1)')<0,          // the fragile bare-$AC$1 cutoff is gone
      stillUsesAsOf:term.indexOf('$AC$1')>=0,                   // still references the helper when it IS set (non-volatile)
      keepsMonthBounds:term.indexOf('">="&DATE($B$2,8,1)')>=0&&term.indexOf('"<="&EOMONTH(DATE($B$2,8,1),0)')>=0,
      matchesCat:term.indexOf("'Account Ledger'!$E:$E,$A5")>=0&&term.indexOf("'Account Ledger'!$G:$G")>=0,
      billGraceful:(bill.match(/IF\(\$AC\$1=""/g)||[]).length===3,   // bill formula = 3 SUMIFS terms, each graceful
      parentGraceful:parent.indexOf('IF($AC$1="",')>=0
    };
  });

  ck('the Spent SUMIFS still sums Amount ($G) by Category ($E) within the month bounds', R.matchesCat&&R.keepsMonthBounds, JSON.stringify({cat:R.matchesCat,bounds:R.keepsMonthBounds}));
  ck('the "as of" cutoff is GRACEFUL: a blank $AC$1 falls back to end-of-month, so a blank helper can never zero the year', R.termGraceful&&R.termNoBareCutoff, R.term);
  ck('it still references $AC$1 as the "spent so far" cutoff when the helper IS set (formulas stay non-volatile)', R.stillUsesAsOf, '');
  ck('a bill sub-row formula carries the graceful guard on all three of its SUMIFS terms', R.billGraceful, '');
  ck('an itemized parent formula carries the graceful guard', R.parentGraceful, '');

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: a blank "as of" helper cell can no longer blank the whole Account Summary Spent column.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

/* Verify the Recent list is sorted by DATE (newest first), not ledger position, and honors the category filter. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof renderRecent==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    window.isGoalName=function(){return false;};window.reimbTag=function(){return "";};window.openEdit=function(){};
    window.money=function(n){return "$"+(Number(n)||0).toFixed(2);};
    window.todayISO=function(){return "2026-09-01";}; // pin "today" so the test is deterministic
    // rows deliberately OUT of date order in the array (a Jan row sits LAST, like after an import).
    // The Dec row is FUTURE (annual bill logged ahead) — it must NOT appear in the unfiltered "recent" list.
    state={rows:[
      [2026,8,'2026-08-20','Me','Food','Aug Diner',10,'',''],
      [2026,3,'2026-03-05','Me','Food','Mar Cafe',20,'',''],
      [2026,12,'2026-12-01','Me','Organization Memberships','AAFEA',125,'',''],  // FUTURE
      [2026,8,'2026-08-25','Me','Food','Late Aug',30,'',''],
      [2026,1,'2026-01-02','Me','Food','Jan Bakery',40,'','']   // newest by POSITION, oldest by DATE
    ]};
    document.getElementById('depFields').style.display='none';
    document.getElementById('fCategory').value='';
    renderRecent();
    var comps=[].map.call(document.querySelectorAll('#elist .eitem .co'),function(e){return e.textContent;});
    return {order:comps};
  });
  // expected newest-first by date, future EXCLUDED: Late Aug (8-25), Aug Diner (8-20), Mar Cafe (3-05), Jan Bakery (1-02)
  ck('Recent list sorted newest-date first (not ledger order)',
     JSON.stringify(res.order)===JSON.stringify(['Late Aug','Aug Diner','Mar Cafe','Jan Bakery']), JSON.stringify(res.order));
  ck('future-dated entries (Dec annual bill) are NOT in the unfiltered recent list', res.order.indexOf('AAFEA')<0, JSON.stringify(res.order));
  ck('most recent shown is the latest PAST entry (not the future one)', res.order[0]==='Late Aug', JSON.stringify(res.order));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

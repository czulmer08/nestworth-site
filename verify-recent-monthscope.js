/* Verify the filtered Recent list is scoped to the feedback line's month (from the date field), not all months. */
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
    window.curYear=function(){return 2026;};window.curMonth=function(){return 8;};window.isGoalName=function(){return false;};
    window.reimbTag=function(){return "";};window.openEdit=function(){};window.money=function(n){return "$"+(Number(n)||0).toFixed(2);};
    state={rows:[
      [2026,6,'2026-06-01','Denzell','Deposit','Denzell',2651.39,'',''],  // JUNE
      [2026,6,'2026-06-15','Denzell','Deposit','Denzell',2651.39,'',''],  // JUNE
      [2026,7,'2026-07-02','Denzell','Deposit','Denzell',2651.39,'',''],  // July (should be hidden)
      [2026,8,'2026-08-01','Denzell','Deposit','Denzell',2066.67,'','']   // Aug (should be hidden)
    ]};
    // deposit mode, source Denzell, date set to June
    document.getElementById('depFields').style.display='block';
    document.getElementById('expFields').style.display='none';
    var s=document.getElementById('dSource'); s.innerHTML='<option>Denzell</option>'; s.value='Denzell';
    document.getElementById('dDate').value='2026-06-01';
    renderRecent();
    var count=document.querySelectorAll('#elist .eitem').length;
    var hdr=document.getElementById('recentHdr').textContent;
    return {count:count, hdr:hdr};
  });

  ck('only June deposits show (2), not July/Aug', res.count===2, JSON.stringify(res));
  ck('header names the source + month', /Denzell/.test(res.hdr)&&/Jun/.test(res.hdr), res.hdr);

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

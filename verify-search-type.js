/* Verify search type filter: deposit-tab search shows only deposits; expense shows only expenses. */
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
  await page.waitForFunction(()=>typeof renderSearch==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    window.isGoalName=function(){return false;};window.reimbTag=function(){return "";};window.openEdit=function(){};
    window.money=function(n){return "$"+(Number(n)||0).toFixed(2);};
    state={rows:[
      [2026,8,'2026-08-01','Me','Food','Publix',50,'',''],
      [2026,8,'2026-08-02','Me','Gas','Shell',40,'',''],
      [2026,8,'2026-08-03','Denzell','Deposit','Denzell',2000,'',''],
      [2026,8,'2026-08-04','Candice','Deposit','Candice',3000,'','']
    ]};
    function run(type){document.getElementById('srchType').value=type;document.getElementById('searchInput').value='';renderSearch();return [].map.call(document.querySelectorAll('#searchResults .eitem .co'),function(e){return e.textContent;});}
    return {dep:run('deposit'), exp:run('expense'), all:run('')};
  });
  ck('type=deposit shows only deposits (2)', res.dep.length===2&&res.dep.indexOf('Denzell')>=0&&res.dep.indexOf('Publix')<0, JSON.stringify(res.dep));
  ck('type=expense shows only expenses (2)', res.exp.length===2&&res.exp.indexOf('Publix')>=0&&res.exp.indexOf('Denzell')<0, JSON.stringify(res.exp));
  ck('type=all shows everything (4)', res.all.length===4, JSON.stringify(res.all));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

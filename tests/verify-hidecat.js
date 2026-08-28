/* Verify hiding/unhiding a used-but-unbudgeted category from the picker + sheet dropdown (data/history untouched). */
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
  await page.waitForFunction(()=>typeof renderCatPicker==='function'&&typeof hideCat==='function'&&typeof unhideCat==='function'&&typeof ddList==='function'&&typeof catHidden==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    window.isGoalName=function(){return false;};window.catBills=function(){return [];};window.topCats=function(){return [];};window.catCfg=function(){return null;};
    window.writeMeta=async function(){};window.syncDropdowns=async function(){};
    state.cats=[{name:'Food'},{name:'Travel'}];state.goals=[];state.cons=[];state.meta={cats:{},cons:{},prefs:{},hiddenCats:[]};
    state.rows=[[2026,8,'2026-08-01','Me','Food','x',10,'',''],[2026,8,'2026-08-02','Me','Direct TV','x',80,'',''],[2026,7,'2026-07-02','Me','Couples Counseling','x',150,'','']];
    renderCatPicker('');
    var xBtns=[].map.call(document.querySelectorAll('#catPickBody .tilehide'),b=>b.getAttribute('data-n')).sort();
    var budgetedHasX=!![].find.call(document.querySelectorAll('#catPickBody .tilewrap'),w=>/>Food<|>Travel</.test(w.innerHTML));
    // hide Direct TV
    [].find.call(document.querySelectorAll('#catPickBody .tilehide'),b=>b.getAttribute('data-n')==='Direct TV').click();
    var afterHide=[].map.call(document.querySelectorAll('#catPickBody .pickgrid .pick-cat'),e=>e.getAttribute('data-n'));
    var inMeta=(state.meta.hiddenCats||[]).indexOf('Direct TV')>=0;
    var inDropdown=ddList().cats.indexOf('Direct TV')>=0;
    var dataIntact=state.rows.some(r=>r[4]==='Direct TV'); // transactions untouched
    var chip=!![].find.call(document.querySelectorAll('#catPickBody .pick-unhide'),b=>b.getAttribute('data-n')==='Direct TV');
    // unhide
    [].find.call(document.querySelectorAll('#catPickBody .pick-unhide'),b=>b.getAttribute('data-n')==='Direct TV').click();
    var afterUnhide=[].map.call(document.querySelectorAll('#catPickBody .pickgrid .pick-cat'),e=>e.getAttribute('data-n'));
    return {xBtns, budgetedHasX, afterHide, inMeta, inDropdown, dataIntact, chip, afterUnhide, metaEmpty:(state.meta.hiddenCats||[]).length===0};
  });

  ck('✕ hide control shows only on used-but-unbudgeted categories', JSON.stringify(res.xBtns)==='["Couples Counseling","Direct TV"]', JSON.stringify(res.xBtns));
  ck('budget categories (Food/Travel) get no ✕', res.budgetedHasX===false, String(res.budgetedHasX));
  ck('hiding removes it from the picker list', res.afterHide.indexOf('Direct TV')<0, JSON.stringify(res.afterHide));
  ck('hidden category recorded in meta (syncs per budget)', res.inMeta, String(res.inMeta));
  ck('hidden category dropped from the sheet dropdown too', res.inDropdown===false, String(res.inDropdown));
  ck('transactions/history are untouched (nothing deleted)', res.dataIntact, String(res.dataIntact));
  ck('a Hidden restore chip appears', res.chip, String(res.chip));
  ck('tapping the chip unhides it (back in the list, meta cleared)', res.afterUnhide.indexOf('Direct TV')>=0&&res.metaEmpty, JSON.stringify(res.afterUnhide));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* Verify itemized PARENT categories are moved out of All/Frequent and shown as a selectable chip beside their bills
   section, with an ✕ to hide (per-category, restorable) that also drops them from the sheet dropdown. */
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
  await page.waitForFunction(()=>typeof renderCatPicker==='function'&&typeof hideCat==='function'&&typeof ddList==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    window.isGoalName=()=>false;window.topCats=()=>['Utilities','Food'];window.ledgerCatsUsed=()=>[];
    window.catHidden=n=>((state.meta.hiddenCats||[]).map(x=>(''+x).toLowerCase()).indexOf((''+n).toLowerCase())>=0);
    window.catCfg=n=>{n=(''+n).toLowerCase();if(n==='utilities')return{type:'itemized',items:[{name:'Electricity'},{name:'Phone Bill'},{name:'Water'}]};return null;};
    window.catBills=n=>{var c=window.catCfg(n);return c&&c.items?c.items.map(i=>i.name):[];};
    window.writeMeta=async()=>{};window.syncDropdowns=async()=>{};
    state.cats=[{name:'Utilities'},{name:'Food'},{name:'Mortgage'}];state.goals=[];state.meta={cats:{},cons:{},prefs:{},hiddenCats:[]};state.rows=[];
    renderCatPicker('');
    var all=[].map.call(document.querySelectorAll('#catPickBody .pickgrid .pick-cat:not(.parent-opt)'),e=>e.getAttribute('data-n'));
    var freq=[].map.call(document.querySelectorAll('#catPickBody .pickchips .pick-cat'),e=>e.getAttribute('data-n'));
    var chip=[].find.call(document.querySelectorAll('#catPickBody .parent-opt'),e=>e.getAttribute('data-n')==='Utilities');
    var chipInBillsHeader=!!(chip&&chip.closest('.picksec.itemhdr'));
    var ddHasParent=ddList().cats.indexOf('Utilities')>=0;
    // hide the parent
    [].find.call(document.querySelectorAll('#catPickBody .tilewrap-inline .tilehide'),b=>b.getAttribute('data-n')==='Utilities').click();
    var chipGone=![].some.call(document.querySelectorAll('#catPickBody .parent-opt'),e=>e.getAttribute('data-n')==='Utilities');
    var billsStill=[].map.call(document.querySelectorAll('#catPickBody .pick-bill'),e=>e.getAttribute('data-b'));
    var ddParentAfter=ddList().cats.indexOf('Utilities')>=0;
    var restoreChip=!![].find.call(document.querySelectorAll('#catPickBody .pick-unhide'),b=>b.getAttribute('data-n')==='Utilities');
    // restore
    [].find.call(document.querySelectorAll('#catPickBody .pick-unhide'),b=>b.getAttribute('data-n')==='Utilities').click();
    var chipBack=!![].find.call(document.querySelectorAll('#catPickBody .parent-opt'),e=>e.getAttribute('data-n')==='Utilities');
    return {all,freq,chipInBillsHeader,ddHasParent,chipGone,billsStill,ddParentAfter,restoreChip,chipBack};
  });

  ck('itemized parent NOT in the All grid', res.all.indexOf('Utilities')<0&&res.all.indexOf('Food')>=0, JSON.stringify(res.all));
  ck('itemized parent NOT in Frequent (even if frequently used)', res.freq.indexOf('Utilities')<0, JSON.stringify(res.freq));
  ck('parent shown as a selectable chip beside its bills-section title', res.chipInBillsHeader, String(res.chipInBillsHeader));
  ck('parent is in the sheet dropdown while shown', res.ddHasParent===true, String(res.ddHasParent));
  ck('hiding the parent removes its chip but keeps the bills', res.chipGone&&res.billsStill.indexOf('Phone Bill')>=0, JSON.stringify({gone:res.chipGone,bills:res.billsStill}));
  ck('hidden parent drops from the sheet dropdown too', res.ddParentAfter===false, String(res.ddParentAfter));
  ck('hidden parent appears in the Hidden restore row, and restoring brings the chip back', res.restoreChip&&res.chipBack, JSON.stringify({r:res.restoreChip,back:res.chipBack}));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

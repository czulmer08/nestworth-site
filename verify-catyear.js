/* Verify the category picker only surfaces ad-hoc/history categories used in the CURRENT year, while budget categories
   (state.cats) always show — even with no transactions yet this year. Uses the REAL ledgerCatsUsed / topCats. */
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
  await page.waitForFunction(()=>typeof renderCatPicker==='function'&&typeof ledgerCatsUsed==='function'&&typeof topCats==='function'&&typeof curYear==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),P=Y-1; // this year and last year
    window.isGoalName=()=>false;window.catCfg=()=>null;window.catBills=()=>[];window.catHidden=()=>false;
    window.writeMeta=async()=>{};window.syncDropdowns=async()=>{};
    state.goals=[];state.meta={cats:{},cons:{},prefs:{},hiddenCats:[]};
    state.cats=[{name:'Food'},{name:'Gas'}]; // Gas is a budget category with NO rows this year
    state.rows=[
      [Y,3,Y+'-03-01','Me','Food','Publix',50,'','N'],       // budget cat, this year
      [Y,4,Y+'-04-01','Me','Dining','Cafe',20,'','N'],       // ad-hoc, this year
      [P,5,P+'-05-01','Me','OldStuff','X',10,'','N'],        // ad-hoc, LAST year only
      [P,6,P+'-06-01','Me','Business/Tutoring','Y',30,'','N']// ad-hoc, LAST year only
    ];
    renderCatPicker('');
    var all=[].map.call(document.querySelectorAll('#catPickBody .pickgrid .pick-cat'),e=>e.getAttribute('data-n'));
    var freq=[].map.call(document.querySelectorAll('#catPickBody .pickchips .pick-cat'),e=>e.getAttribute('data-n'));
    return {all,freq};
  });

  const all=res.all,freq=res.freq;
  ck('budget categories always show (Food used this year, Gas not used at all)', all.indexOf('Food')>=0&&all.indexOf('Gas')>=0, JSON.stringify(all));
  ck('an ad-hoc category used THIS year shows (Dining)', all.indexOf('Dining')>=0, JSON.stringify(all));
  ck('ad-hoc categories from PRIOR years are filtered out (OldStuff, Business/Tutoring)', all.indexOf('OldStuff')<0&&all.indexOf('Business/Tutoring')<0, JSON.stringify(all));
  ck('Frequent reflects this year only (no prior-year categories)', freq.indexOf('OldStuff')<0&&freq.indexOf('Business/Tutoring')<0, JSON.stringify(freq));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* Verify itemized-bill logging: picking a bill tags Category=bill (Company left free), and the month view folds bill
   spend into its parent (no separate $0-budget line). */
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
  await page.waitForFunction(()=>typeof renderCatPicker==='function'&&typeof renderMonthDetail==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // ---------- picking an itemized bill tags Category=bill, leaves Company free ----------
  const pick=await page.evaluate(()=>{
    window.isGoalName=()=>false;window.topCats=()=>[];window.ledgerCatsUsed=()=>[];window.catHidden=()=>false;
    window.catCfg=function(n){return (""+n).toLowerCase()==="utilities"?{type:"itemized",items:[{name:"Phone Bill"},{name:"Water"}]}:null;};
    state.cats=[{name:"Utilities"}];state.goals=[];state.meta={cats:{utilities:{type:"itemized",items:[{name:"Phone Bill"},{name:"Water"}]}},cons:{},prefs:{},hiddenCats:[]};state.rows=[];
    var fc=document.getElementById("fCompany"); if(fc)fc.value=""; var fcat=document.getElementById("fCategory"); if(fcat)fcat.value="";
    renderCatPicker('');
    var billBtn=[].find.call(document.querySelectorAll('#catPickBody .pick-bill'),b=>b.getAttribute('data-b')==='Phone Bill');
    billBtn.click();
    return {category:(document.getElementById('fCategory')||{}).value, company:(document.getElementById('fCompany')||{}).value};
  });
  ck('picking "Phone Bill" sets Category = the bill name (not the parent)', pick.category==='Phone Bill', JSON.stringify(pick));
  ck('Company is left free for the merchant (not auto-filled with the bill)', (pick.company||'')==='' , JSON.stringify(pick));

  // ---------- month view folds bill spend into its parent ----------
  const md=await page.evaluate(()=>{
    window.curYear=()=>2026;window.curMonth=()=>8;window.isGoalName=()=>false;
    window.catBills=function(n){return (""+n).toLowerCase()==="utilities"?["Phone Bill","Water"]:[];};
    var bud=[0,0,0,0,0,580,0,0,0,0,0,0]; // Utilities June budget 580
    state.cats=[{name:"Utilities",bud12:bud}];state.cons=[];
    state.rows=[
      [2026,6,'2026-06-05','Me','Utilities','Gas South',446.07,'',''],  // tagged to parent
      [2026,6,'2026-06-10','Me','Phone Bill','AT&T',144.43,'',''],       // tagged to the BILL name
      [2026,6,'2026-06-12','Me','Water','City',30,'','']                 // another bill
    ];
    var html=renderMonthDetail(6,2026);
    return {html};
  });
  var hasUtil=/Utilities/.test(md.html);
  var utilActual=/\$620\.50/.test(md.html); // 446.07+144.43+30 = 620.50 folded
  var noSeparatePhone=!/>Phone Bill<\/span>/.test(md.html);
  ck('parent "Utilities" line present with folded actual $620.50 (446.07+144.43+30)', hasUtil&&utilActual, md.html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,240));
  ck('bill "Phone Bill" does NOT appear as its own separate line', noSeparatePhone, String(noSeparatePhone));

  // ---------- the table below filters to the bill (name-matched) + feedback shows the bill's budget ----------
  const flt=await page.evaluate(()=>{
    window.curYear=()=>2026;window.curMonth=()=>8;window.isGoalName=()=>false;window.todayISO=()=>"2026-08-31";
    window.money=n=>"$"+(Number(n)||0).toFixed(2);window.reimbTag=()=>"";window.openEdit=()=>{};window.typedAmt=()=>0;window.catRoll=()=>"none";
    window.catCfg=n=>(""+n).toLowerCase()==="utilities"?{type:"itemized",items:[{name:"Phone Bill",amount:150,cadence:"Monthly",month:1},{name:"Water",amount:40,cadence:"Monthly",month:1}]}:null;
    window.catBills=n=>(""+n).toLowerCase()==="utilities"?["Phone Bill","Water"]:[];
    state.cats=[{name:"Utilities",bud12:[0,0,0,0,0,0,0,0,0,0,0,0]},{name:"Food"}];state.goals=[];state.cons=[];
    state.rows=[
      [2026,8,'2026-08-05','Me','Phone Bill','AT&T',144.43,'',''],       // tagged as the bill
      [2026,8,'2026-08-06','Me','Utilities','Phone Bill',144.00,'',''],  // legacy: parent + company=bill
      [2026,8,'2026-08-07','Me','Food','Publix',20,'','']                // unrelated
    ];
    document.getElementById('depFields').style.display='none';
    document.getElementById('fDate').value='2026-08-15';
    document.getElementById('fCategory').value='Phone Bill';
    renderRecent();
    var companies=[].map.call(document.querySelectorAll('#elist .eitem .co'),e=>e.textContent);
    renderCatTbl();
    var tbl=document.getElementById('catTbl').textContent;
    return {companies, tbl};
  });
  ck('table filters to the bill and includes both bill-tagged AND parent+company rows', flt.companies.length===2&&flt.companies.indexOf('AT&T')>=0&&flt.companies.indexOf('Phone Bill')>=0&&flt.companies.indexOf('Publix')<0, JSON.stringify(flt.companies));
  ck('feedback shows the BILL\'s own budget ($150) and name-matched spent ($288.43)', /\$288\.43/.test(flt.tbl)&&/\$150\.00/.test(flt.tbl), flt.tbl.replace(/\s+/g,' ').slice(0,160));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

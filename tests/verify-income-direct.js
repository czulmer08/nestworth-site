/* Verify pulling income sources directly from an old budget's Contributions section, merged into wizard suggestions. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();if(u.includes('google'))return r.fulfill({status:200,contentType:'application/json',body:'{}'});return r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'application/javascript',body:''});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof readOldBudgetIncome==='function'&&typeof wizApplySuggestions==='function'&&typeof scanMarkers==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) readOldBudgetIncome parses the Contributions section of an old budget's summary
  const r1=await page.evaluate(async()=>{
    // fake old budget: 2025 Account Summary, income at rows 39..40, TOTAL CONTRIBUTIONS at 44
    var colA=[];for(var i=0;i<60;i++)colA.push([""]);
    colA[34]=["TOTAL"]; colA[36]=["CONTRIBUTIONS — who funds this"]; colA[37]=["Contributor"];
    colA[38]=["Salary"]; colA[39]=["Rental"]; colA[43]=["TOTAL CONTRIBUTIONS"];
    // income row values: A + 12 monthly budget cols at index 4,6,8,...(E,G,...); Salary $6000/mo, Rental $800/mo
    function incRow(name,mo){var r=[name,0,0,0];for(var k=0;k<12;k++){r.push(mo);r.push(0);}return r;}
    window.api=async(url)=>{
      var d=decodeURIComponent(url);
      if(/fields=sheets\.properties/.test(d))return {sheets:[{properties:{title:"2025 Account Summary"}},{properties:{title:"Account Ledger"}}]};
      if(/!A1:A400/.test(d))return {values:colA};
      if(/!A39:AB43/.test(d))return {values:[incRow("Salary",6000),incRow("Rental",800)]};
      return {values:[]};
    };
    var res=await readOldBudgetIncome("oldid");
    return res;
  });
  ck('readOldBudgetIncome: Salary $6000/mo + Rental $800/mo from Contributions section',
     r1.length===2&&r1.find(x=>x.name==='Salary'&&Math.abs(x.monthly-6000)<0.5)&&r1.find(x=>x.name==='Rental'&&Math.abs(x.monthly-800)<0.5), JSON.stringify(r1));

  // 2) wizApplySuggestions merges direct income (defined) with deposit-derived, defined amount winning on name clash
  const r2=await page.evaluate(async()=>{
    window.isGoalName=()=>false;
    window.state={cats:[],cons:[],goals:[],rows:[
      // a deposit from "Salary" of 5000/mo (2 checks) AND from "SideGig"
      [2013,1,'2013-01-05','Salary','Deposit','',2500,'',''],
      [2013,1,'2013-01-20','Salary','Deposit','',2500,'',''],
      [2013,1,'2013-01-15','SideGig','Deposit','',400,'',''],
      [2013,1,'2013-01-06','','Groceries','Publix',300,'','']
    ],meta:{cats:{},cons:{},goals:[],carry:{}}};
    window.IMP_INCOME=[{name:'Salary',monthly:6000},{name:'Rental',monthly:800}]; // defined: Salary 6000 (overrides deposit 5000), Rental 800 (new)
    window.WZ={step:1,packs:{},cats:[],incomes:[{name:'Me',type:'paycheck',freq:26,perCheck:'',keepMode:'all',pct:100,monthly:'',annual:'',month:1}]};
    window.askConfirm=async()=>true; window.hasOlderData=()=>false; window.renderWizard=()=>{};
    if(!document.getElementById('wizMsg')){var m=document.createElement('div');m.id='wizMsg';document.body.appendChild(m);}
    await wizApplySuggestions();
    return WZ.incomes.map(i=>({n:i.name,m:i.monthly}));
  });
  const sal=r2.find(x=>x.n==='Salary'), rent=r2.find(x=>x.n==='Rental'), side=r2.find(x=>x.n==='SideGig');
  ck('merge: Salary uses DEFINED $6000 (not deposit $5000)', sal&&sal.m==='6000', JSON.stringify(r2));
  ck('merge: Rental (defined-only) and SideGig (deposit-only) both present', !!rent&&rent.m==='800'&&!!side&&Math.abs(Number(side.m)-400)<0.5, JSON.stringify(r2));
  ck('merge: blank default "Me" replaced, no dup', !r2.find(x=>x.n==='Me'), JSON.stringify(r2));

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

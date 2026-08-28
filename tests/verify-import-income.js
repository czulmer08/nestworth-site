/* Verify the old-budget import now brings deposits in as income, feeding the wizard's income suggestion. */
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
  await page.waitForFunction(()=>typeof impDoImport==='function'&&typeof renderImpReview==='function'&&typeof suggestIncomeFromSpending==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) impDoImport writes deposit rows with source in Payee + "Deposit" category
  const r1=await page.evaluate(async()=>{
    window.__appended=[];
    window.state={cats:[],cons:[],goals:[],assets:[],debts:[],rows:[],meta:{cats:{},cons:{},goals:[],carry:{}}};
    window.vappend=async(range,vals)=>{Array.prototype.push.apply(window.__appended,vals);return {updates:{updatedRange:"'Account Ledger'!A2:I3"}};};
    window.loadAll=async()=>{}; window.renderAll=()=>{}; window.askConfirm=async()=>false; window.closeOv=()=>{};
    window._impFromTab=false; window._impSkipDup=true;
    window.IMPTX=[
      {date:'2013-01-05',isDep:true,category:'Deposit',payee:'Employer',amount:2000,company:''},
      {date:'2013-01-20',isDep:true,category:'Deposit',payee:'Employer',amount:2000,company:''},
      {date:'2013-01-06',category:'Groceries',amount:100,company:'Publix'}
    ];
    await impDoImport();
    return window.__appended.map(v=>({y:v[0],payee:v[3],cat:v[4],amt:v[6]}));
  });
  const dep=r1.filter(x=>x.cat==='Deposit');
  ck('deposits written with source in Payee col + "Deposit" category', dep.length===2&&dep.every(x=>x.payee==='Employer'&&x.amt===2000), JSON.stringify(r1));
  ck('expense row still written normally', r1.some(x=>x.cat==='Groceries'&&x.amt===100), JSON.stringify(r1));

  // 2) with those deposit rows in the ledger, suggestIncomeFromSpending finds the income
  const r2=await page.evaluate(()=>{
    window.isGoalName=()=>false;
    state.rows=[
      [2013,1,'2013-01-05','Employer','Deposit','',2000,'',''],
      [2013,1,'2013-01-20','Employer','Deposit','',2000,'',''],
      [2013,1,'2013-01-06','','Groceries','Publix',100,'','']
    ];
    return suggestIncomeFromSpending('all').map(x=>({n:x.name,a:x.amount}));
  });
  ck('income suggested from the imported deposits (Employer $4000/mo)', r2.length===1&&r2[0].n==='Employer'&&Math.abs(r2[0].a-4000)<0.5, JSON.stringify(r2));

  // 3) renderImpReview shows income count and doesn't crash on deposit rows
  const r3=await page.evaluate(()=>{
    window.state.cats=[{name:'Groceries'}];
    window.IMPTX=[
      {date:'2013-01-05',isDep:true,category:'Deposit',payee:'Employer',amount:2000,company:''},
      {date:'2013-01-06',category:'Groceries',amount:100,company:'Publix'}
    ];
    // ensure the review DOM nodes exist
    ['impRevCount','impRevDup','impRevCats','impRevList','impRevGo'].forEach(function(id){if(!document.getElementById(id)){var e=document.createElement(id==='impRevGo'?'button':'div');e.id=id;document.body.appendChild(e);}});
    renderImpReview();
    var html=document.getElementById('impRevList').innerHTML;
    var selectCount=document.getElementById('impRevList').querySelectorAll('.improw-cat').length;
    return {count:document.getElementById('impRevCount').textContent, hasIncomeTag:/income<\/span>/.test(html), selectCount:selectCount, go:document.getElementById('impRevGo').textContent};
  });
  ck('review: income tag on deposit, exactly one category dropdown (the expense), header mentions income', /income entr/.test(r3.count)&&r3.hasIncomeTag&&r3.selectCount===1, JSON.stringify(r3));

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

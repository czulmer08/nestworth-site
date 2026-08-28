/* Verify the wizard suggests income sources from imported deposits. */
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
  await page.waitForFunction(()=>typeof suggestIncomeFromSpending==='function'&&typeof wizApplySuggestions==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // seed: deposits from "Employer" (2 checks/mo) and "Rental" (1/mo) across Jan-Mar 2013; plus some expenses
  const setup=()=>{
    window.state=window.state||{};
    window.isGoalName=()=>false;
    state.rows=[
      // deposits (col4 = Deposit, col3 = source, col6 = amount)
      [2013,1,'2013-01-05','Employer','Deposit','ACME',2000,'',''],
      [2013,1,'2013-01-20','Employer','Deposit','ACME',2000,'',''],
      [2013,2,'2013-02-05','Employer','Deposit','ACME',2000,'',''],
      [2013,2,'2013-02-20','Employer','Deposit','ACME',2000,'',''],
      [2013,1,'2013-01-01','Rental','Deposit','Tenant',800,'',''],
      [2013,2,'2013-02-01','Rental','Deposit','Tenant',800,'',''],
      // an expense so category suggestion also has data
      [2013,1,'2013-01-06','','Groceries','Publix',300,'','']
    ];
    state.cats=[];state.cons=[];state.goals=[];state.meta={cats:{},cons:{},goals:[],carry:{}};
  };

  // 1) suggestIncomeFromSpending groups deposits by source, monthly average
  const r1b=await page.evaluate((s)=>{ eval('('+s+')')();
    var inc=suggestIncomeFromSpending('all');
    return inc.map(x=>({name:x.name,amount:x.amount}));
  }, setup.toString());
  const emp=r1b.find(x=>x.name==='Employer');
  const rent=r1b.find(x=>x.name==='Rental');
  // Employer: $8000 over 2 months w/ data = $4000/mo ; Rental: $1600/2 = $800/mo
  ck('income suggested from deposits, grouped by source, monthly avg', emp&&Math.abs(emp.amount-4000)<0.5&&rent&&Math.abs(rent.amount-800)<0.5, JSON.stringify(r1b));

  // 2) wizApplySuggestions populates BOTH categories and incomes
  const r2=await page.evaluate(async(s)=>{
    eval('('+s+')')();
    window.WZ={step:1,packs:{},cats:[],incomes:[{name:'Me',type:'paycheck',freq:26,perCheck:'',keepMode:'all',pct:100,setaside:'',monthly:'',annual:'',month:1}]};
    window.askConfirm=async()=>true; // "use entire history"
    window.hasOlderData=()=>false;
    if(!document.getElementById('wizMsg')){var m=document.createElement('div');m.id='wizMsg';document.body.appendChild(m);}
    window.renderWizard=()=>{}; // avoid DOM churn
    await wizApplySuggestions();
    return {cats:WZ.cats.map(c=>c.name), incomes:WZ.incomes.map(i=>({n:i.name,t:i.type,m:i.monthly})), msg:document.getElementById('wizMsg').textContent};
  }, setup.toString());
  ck('wizard suggestion adds income sources (Employer, Rental) as monthly',
     r2.incomes.some(i=>i.n==='Employer'&&i.t==='monthly')&&r2.incomes.some(i=>i.n==='Rental')&&!r2.incomes.some(i=>i.n==='Me'), JSON.stringify(r2.incomes));
  ck('wizard suggestion still adds categories (Groceries)', r2.cats.indexOf('Groceries')>=0, JSON.stringify(r2.cats));
  ck('suggestion message mentions income', /income source/.test(r2.msg), r2.msg);

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

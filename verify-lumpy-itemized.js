/* CHECKUP "Unusual budget" EVIDENCE TABLE for ITEMIZED categories (v0.68.61). The spike AMOUNT comes from spentByMonth()=catSpend12,
   which includes an itemized category's sub-item rows; but the transaction scan matched the PARENT name only, so an itemized category
   (Children → Baby Z/Baby B; Home Services) showed a big spike with an EMPTY "What <month> was" table — the user literally couldn't
   decide "one-off or normal?" This proves the scan now matches the SAME set as catSpend12 (parent + child names + "↳ " forms), the
   table populates with the real child transactions, and the two "what this does" hints render. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const src=fs.readFileSync(APP,'utf8');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(src);return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof lumpyCategories==='function'&&typeof forecastCheckupHTML==='function'&&typeof catSpend12==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-31';};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};var near=function(a,bb){return Math.abs((a||0)-(bb||0))<0.02;};
    var row=function(mo,day,cat,payee,amt){return [2026,mo,'2026-'+String(mo).padStart(2,'0')+'-'+String(day).padStart(2,'0'),'',cat,payee,amt,'',''];};
    // Children is ITEMIZED (Baby Z / Baby B). Jan–May ~$2,000/mo via child rows; Jun spikes to $8,000 (Baby Z $5,000 + Baby B $3,000).
    var rows=[];for(var m=1;m<=5;m++){rows.push(row(m,3,'Baby Z','KinderCare',1200));rows.push(row(m,4,'Baby B','Sitter',800));}
    rows.push(row(6,10,'Baby Z','KinderCare',5000));rows.push(row(6,20,'Baby B','Sitter',3000));
    rows.push(row(6,15,'Rent','Landlord',1234)); // an UNRELATED June expense — must NOT appear in Children's evidence table (proves the category filter)
    state.cons=[{name:'Pay',bud12:fill(12000),annual:144000}];
    state.cats=[{name:'Children',bud12:fill(2500),annual:30000},{name:'Travel',bud12:fill(500),annual:6000}];
    state.goals=[];state.assets=[];state.debts=[];state.rows=rows;
    state.meta={cats:{"children":{type:'itemized',items:[{name:'Baby Z'},{name:'Baby B'}]},"travel":{roll:'envelope'}},
      cons:{},goals:[],payees:['Me'],floor:0,startCash:0,prefs:{},checkupDone:{}};
    if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    var Rz={};
    var sp=catSpend12('Children');
    Rz.spike={jun:sp[5],includesChildren:near(sp[5],8000)};
    var L=lumpyCategories().filter(function(x){return x.cat==='Children';})[0];
    Rz.lumpy={found:!!L,spikeMonth:L&&L.spikeMonth,spikeAmount:L&&L.spikeAmount,txnCount:L&&L.txns.length,
      sum:L&&L.txns.reduce(function(a,t){return a+t.amount;},0),
      top:L&&L.txns[0]&&L.txns[0].name,topAmt:L&&L.txns[0]&&L.txns[0].amount,
      hasBabyZ:!!(L&&L.txns.some(function(t){return /Baby Z/.test(t.name);})),hasBabyB:!!(L&&L.txns.some(function(t){return /Baby B/.test(t.name);})),
      noRent:!(L&&L.txns.some(function(t){return /Rent|Landlord/.test(t.name);}))};
    var html=forecastCheckupHTML();
    Rz.render={hasTable:/What Jun was/.test(html),showsBabyZ:/Baby Z/.test(html),showsAmt:/\$5,000\.00/.test(html),
      lumpyHint:/<b>One-off<\/b> opens this category/.test(html)&&/keeps it as it is/.test(html),
      purposeHint:/only sets how the money set aside here is treated/.test(html)};
    return Rz;
  });

  ck('the itemized spike AMOUNT includes the sub-item rows (Children Jun = $8,000 via catSpend12)',
     R.spike.includesChildren, JSON.stringify(R.spike));
  ck('lumpyCategories now finds the Jun spike AND its transaction list is non-empty (was empty before the fix)',
     R.lumpy.found&&R.lumpy.spikeMonth===6&&R.lumpy.txnCount>=2&&near(R.lumpy.spikeAmount,8000), JSON.stringify(R.lumpy));
  ck('the transactions are the actual sub-item rows, summing to the spike ($5,000 + $3,000 = $8,000), largest first — and an unrelated June row (Rent) is NOT included',
     near(R.lumpy.sum,8000)&&near(R.lumpy.topAmt,5000)&&R.lumpy.hasBabyZ&&R.lumpy.hasBabyB&&R.lumpy.noRent, JSON.stringify(R.lumpy));
  ck('the sub-item name is shown (e.g. "Baby Z · KinderCare"), not just the parent',
     /Baby Z/.test(R.lumpy.top||''), 'top='+R.lumpy.top);
  ck('the "What Jun was" evidence table renders in the checkup with the child transactions ($5,000)',
     R.render.hasTable&&R.render.showsBabyZ&&R.render.showsAmt, JSON.stringify(R.render));
  ck('the "what this does" hints render — the Unusual-budget consequence and the purpose consequence',
     R.render.lumpyHint&&R.render.purposeHint, JSON.stringify({lumpy:R.render.lumpyHint,purpose:R.render.purposeHint}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: an itemized category’s "unusual budget" prompt now shows the real transactions that made the month unusual — a look, not a guess — and each answer says what it does.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

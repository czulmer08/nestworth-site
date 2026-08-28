/* Verify Wren's free on-device analytics: totals, per-category spend (budget + ad-hoc), biggest categories, income,
   and what you kept — all computed from state.rows, no API. */
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
  await page.waitForFunction(()=>typeof wrenAnalyze==='function'&&typeof buildIndexes==='function'&&typeof catSpend12==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth(),M2=(M>1?M-1:M+1);
    state.meta={cats:{},cons:{},prefs:{},goals:[]};state.goals=[];
    state.cats=[{name:'Groceries'},{name:'Gas'}];
    state.rows=[
      [Y,M,'d','Me','Groceries','Publix',100,'','N'],
      [Y,M2,'d','Me','Groceries','Publix',100,'','N'],   // another month this year → year total 200
      [Y,M,'d','Me','Gas','Shell',50,'','N'],
      [Y,M,'d','Me','Dining','Cafe',30,'','N'],           // ad-hoc category
      [Y,M,'d','Me','Deposit','Employer',1000,'','N']     // income
    ];
    buildIndexes();
    var A=function(q){var r=wrenAnalyze(q);return r?r.answer:null;};
    return {
      catMonth:A('how much did I spend on groceries this month'),
      catYear:A('how much on groceries this year'),
      adhoc:A('how much did I spend on dining'),
      biggest:A("what's my biggest category this month"),
      income:A('how much did I make this month'),
      saved:A('how much did I save this month'),
      total:A('how much did I spend this month'),
      help:A('how do I add an expense')
    };
  });

  ck('per-category spend this month (Groceries = $100)', /Groceries/.test(res.catMonth)&&/\$100\.00/.test(res.catMonth), JSON.stringify(res.catMonth));
  ck('per-category spend this year sums the months (Groceries = $200)', /\$200\.00/.test(res.catYear), JSON.stringify(res.catYear));
  ck('ad-hoc category spend works too (Dining = $30)', /Dining/.test(res.adhoc)&&/\$30\.00/.test(res.adhoc), JSON.stringify(res.adhoc));
  ck('biggest category is Groceries at the top', /Groceries \(\$100\.00\)/.test(res.biggest)&&res.biggest.indexOf('Groceries')<res.biggest.indexOf('Gas'), JSON.stringify(res.biggest));
  ck('income question returns the deposit total ($1,000)', /\$1,000\.00/.test(res.income), JSON.stringify(res.income));
  ck('what you kept = income − spending ($1000 − $180 = $820)', /kept \$820\.00/.test(res.saved), JSON.stringify(res.saved));
  ck('total spend this month ($180)', /\$180\.00 total/.test(res.total), JSON.stringify(res.total));
  ck('a how-to question is NOT hijacked by analytics (returns null)', res.help===null, JSON.stringify(res.help));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

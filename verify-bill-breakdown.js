/* Verify per-bill spent helpers + that the Budget and Month views break an itemized category down bill-by-bill. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof billSpentYr==='function'&&typeof billSpentMonth==='function'&&typeof renderCats==='function'&&typeof renderMonth==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // seed: itemized category "Subscriptions" with two bills, tagged in the ledger via the Company column
  await page.evaluate(()=>{
    var THIS=(new Date()).getFullYear(), M=(new Date()).getMonth()+1;
    window.__Y=THIS; window.__M=M;
    window.bYear=function(){return THIS;};
    window.curYear=function(){return THIS;};
    window.curMonth=function(){return M;};
    window.catCfg=function(n){return (n==='Subscriptions')?{type:'itemized',items:[
      {name:'Netflix',amount:20,cadence:'Monthly',month:1,day:5},
      {name:'Amazon Prime',amount:139,cadence:'Annual',month:M,day:1}
    ]}:null;};
    state={rows:[
      [THIS,M, THIS+'-0'+M+'-05','Me','Subscriptions','Netflix',20,'',''],
      [THIS,M, THIS+'-0'+M+'-10','Me','Subscriptions','Netflix',20,'',''],   // two Netflix charges this month
      [THIS,M, THIS+'-0'+M+'-01','Me','Subscriptions','Amazon Prime',139,'',''] // annual prime paid this month
    ], cats:[{name:'Subscriptions',row:5,annual:379,remaining:200,mbud:31.58,mspent:179,bud12:[]}], cons:[], goals:[], meta:{cats:{}}};
  });

  const r1=await page.evaluate(()=>({netflixYr:billSpentYr('Subscriptions','Netflix'),primeYr:billSpentYr('Subscriptions','Amazon Prime'),netflixMo:billSpentMonth('Subscriptions','Netflix',window.__Y,window.__M),none:billSpentYr('Subscriptions','Nonexistent')}));
  ck('billSpentYr/Month sum only rows tagged to that bill', r1.netflixYr===40&&r1.primeYr===139&&r1.netflixMo===40&&r1.none===0, JSON.stringify(r1));

  // Budget card shows each bill with spent / budget
  const r2=await page.evaluate(()=>{
    window.typeLabel=function(){return 'Itemized · 2 bills';};window.catRoll=function(){return 'none';};
    window.catBalance=function(){return 0;};window.hasPriorYearData=function(){return false;};
    renderCats();
    var bills=[].map.call(document.querySelectorAll('#catList .cc-bill'),function(el){return el.textContent;});
    return {bills:bills};
  });
  ck('Budget card lists both bills with spent amounts', r2.bills.length>=2&&r2.bills.join(' ').indexOf('Netflix')>=0&&/\$40/.test(r2.bills.join(' '))&&/\$139/.test(r2.bills.join(' ')), JSON.stringify(r2));

  // Month view breaks the itemized category into per-bill spent / this-month budget
  const r3=await page.evaluate(()=>{
    window.incomeThisMonth=function(){return 5000;};window.renderInsights=function(){};window.renderReminders=function(){};window.isGoalName=function(){return false;};
    renderMonth();
    var bills=[].map.call(document.querySelectorAll('#mBody .cc-bill'),function(el){return el.textContent;});
    return {bills:bills};
  });
  ck('Month view shows per-bill breakdown for the itemized category', r3.bills.length>=2&&/Netflix/.test(r3.bills.join(' '))&&/Amazon Prime/.test(r3.bills.join(' ')), JSON.stringify(r3));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

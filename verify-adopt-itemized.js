/* Verify adoptSheetItemized: ↳ rows built/edited in the sheet are picked up as itemized bills; untouched ones don't drift. */
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
  await page.waitForFunction(()=>typeof adoptSheetItemized==='function'&&typeof billMonths==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // Case 1: category built in the sheet (meta has it as plain monthly) -> becomes itemized with the ↳ bills
  const r1=await page.evaluate(()=>{
    state={cats:[{name:'Subscriptions'}],meta:{cats:{subscriptions:{type:'monthly',amount:100}}},
      _sheetSubs:{subscriptions:[{name:'Netflix',b12:[20,20,20,20,20,20,20,20,20,20,20,20]},{name:'Prime',b12:[139,0,0,0,0,0,0,0,0,0,0,0]}]}};
    adoptSheetItemized();
    var c=state.meta.cats.subscriptions;
    return {type:c.type, n:(c.items||[]).length, names:(c.items||[]).map(function(x){return x.name;}), netflix:(c.items||[]).filter(function(x){return x.name==='Netflix';})[0]};
  });
  ck('sheet-built category becomes itemized with its bills', r1.type==='itemized'&&r1.n===2&&r1.names.indexOf('Netflix')>=0&&r1.names.indexOf('Prime')>=0, JSON.stringify(r1));
  ck('bill cadence inferred (Netflix monthly $20)', r1.netflix&&r1.netflix.cadence==='Monthly'&&Math.abs(r1.netflix.amount-20)<0.01, JSON.stringify(r1.netflix));

  // Case 2: app-managed and unchanged in the sheet -> meta preserved (incl. due-day), no drift
  const r2=await page.evaluate(()=>{
    var items=[{name:'Netflix',cadence:'Monthly',amount:20,month:1,day:5}];
    state={cats:[{name:'Subscriptions'}],meta:{cats:{subscriptions:{type:'itemized',items:items}}},
      _sheetSubs:{subscriptions:[{name:'Netflix',b12:billMonths(items)}]}};
    adoptSheetItemized();
    var it=state.meta.cats.subscriptions.items[0];
    return {day:it.day, amount:it.amount};
  });
  ck('untouched app category keeps its due-day (no drift)', r2.day===5&&Math.abs(r2.amount-20)<0.01, JSON.stringify(r2));

  // Case 3: user edited the ↳ amount in the sheet -> picked up, due-day preserved by name
  const r3=await page.evaluate(()=>{
    var items=[{name:'Netflix',cadence:'Monthly',amount:20,month:1,day:5}];
    state={cats:[{name:'Subscriptions'}],meta:{cats:{subscriptions:{type:'itemized',items:items}}},
      _sheetSubs:{subscriptions:[{name:'Netflix',b12:[25,25,25,25,25,25,25,25,25,25,25,25]}]}}; // edited to $25/mo in the sheet
    adoptSheetItemized();
    var it=state.meta.cats.subscriptions.items[0];
    return {amount:it.amount, day:it.day};
  });
  ck('edited sheet amount is picked up ($25), due-day preserved', Math.abs(r3.amount-25)<0.01&&r3.day===5, JSON.stringify(r3));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

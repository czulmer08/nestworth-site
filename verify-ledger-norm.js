/* Verify hand-entered ledger rows are recognized: month name -> number, and blank Year/Month backfilled from the Date column. */
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
  await page.waitForFunction(()=>typeof normLedgerRows==='function'&&typeof monthNum==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const r0=await page.evaluate(()=>({aug:monthNum('August'),ab:monthNum('Aug'),sep:monthNum('Sept'),num:monthNum(8),str:monthNum('8'),bad:monthNum('nonsense'),blank:monthNum('')}));
  ck('monthNum parses names, abbreviations, numbers', r0.aug===8&&r0.ab===8&&r0.sep===9&&r0.num===8&&r0.str===8&&r0.bad===0&&r0.blank===0, JSON.stringify(r0));

  const r1=await page.evaluate(()=>{
    // row with the month typed as a NAME (the user's actual mistake), Year present
    var rows=[[2026,'August','2026-08-15','Me','Groceries','Publix',52,'','']];
    normLedgerRows(rows);
    return {y:rows[0][0], m:rows[0][1]};
  });
  ck('month name "August" -> 8 (row now buckets into August)', r1.y===2026&&r1.m===8, JSON.stringify(r1));

  const r2=await page.evaluate(()=>{
    // blank Year AND Month, only a Date filled
    var rows=[['','', '2026-07-03','Me','Gas','Shell',40,'','']];
    normLedgerRows(rows);
    return {y:rows[0][0], m:rows[0][1]};
  });
  ck('blank Year+Month backfilled from Date (2026-07 -> 2026, 7)', r2.y===2026&&r2.m===7, JSON.stringify(r2));

  const r3=await page.evaluate(()=>{
    // date as a Google serial number (UNFORMATTED_VALUE), month blank
    // 2026-03-10 -> serial 46091
    var rows=[[2026,'', 46091,'Me','Dining','Chipotle',20,'','']];
    normLedgerRows(rows);
    return {y:rows[0][0], m:rows[0][1]};
  });
  ck('serial-number date fills the month (March -> 3)', r3.y===2026&&r3.m===3, JSON.stringify(r3));

  const r4=await page.evaluate(()=>{
    // already-correct numeric rows are untouched; goal/empty rows survive
    var rows=[[2026,8,'2026-08-01','Me','Groceries','Aldi',30,'',''],[]];
    normLedgerRows(rows);
    return {y:rows[0][0], m:rows[0][1], secondEmpty:rows[1].length};
  });
  ck('numeric rows unchanged; empty row safe', r4.y===2026&&r4.m===8&&r4.secondEmpty===0, JSON.stringify(r4));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

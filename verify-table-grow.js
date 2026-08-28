/* Verify the ledger table grows with the data: appending past its edge issues an updateTable that extends the range. */
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
  await page.waitForFunction(()=>typeof vappend==='function'&&typeof ensureLedgerTable==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    window.ssBase=function(){return "https://x";};
    window.LEDGER_GID=5;
    window.__updates=[];window.__batch=[];
    // ledger currently has 2000 data rows in column A (scan), table covers rows 0..2000 (endRowIndex 2000)
    var colA={};for(var i=1;i<=2000;i++)colA[i]=i;
    window.vgetU=async function(rng){var m=rng.match(/!A(\d+)(?::A(\d+))?/);var s=+m[1],e=m[2]?+m[2]:s;var mx=0;Object.keys(colA).forEach(function(k){if(+k>mx)mx=+k;});var end=Math.min(e,Math.max(mx,s));var o=[];for(var r=s;r<=end;r++)o.push([colA[r]!=null?colA[r]:'']);return {values:o};};
    window.vBatchUpdate=async function(d){Array.prototype.push.apply(window.__updates,d);d.forEach(function(x){var m=x.range.match(/!A(\d+)/);if(m)colA[+m[1]]=x.values[0][0];});};
    window.api=async function(url,opts){
      if(/tables\(tableId/.test(decodeURIComponent(url))) return {sheets:[{properties:{sheetId:5},tables:[{tableId:"tbl9",range:{sheetId:5,startRowIndex:0,endRowIndex:2000,startColumnIndex:0,endColumnIndex:9}}]}]};
      if(/:batchUpdate$/.test(url)){window.__batch.push(JSON.parse(opts.body));return {};}
      return {};
    };
    var r=await vappend("Account Ledger!A:I",[[2026,9,'2026-09-01','Me','Gas','Shell',40,'','']]);
    var upd=null;window.__batch.forEach(function(bd){(bd.requests||[]).forEach(function(rq){if(rq.updateTable)upd=rq.updateTable;});});
    return {writeRange:window.__updates[0]&&window.__updates[0].range, upd:upd, ret:r.updates&&r.updates.updatedRange};
  });

  ck('new row written right after the data (row 2001)', /!A2001$/.test(res.writeRange||''), JSON.stringify({w:res.writeRange}));
  ck('updateTable issued to extend the table past the new row', !!res.upd && res.upd.table.tableId==='tbl9' && res.upd.fields==='range', JSON.stringify(res.upd));
  ck('table extended to cover the new row (endRowIndex > 2000)', res.upd && res.upd.table.range.endRowIndex>=2001, JSON.stringify(res.upd&&res.upd.table.range));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

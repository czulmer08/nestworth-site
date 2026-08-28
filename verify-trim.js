/* Verify trimLedger compacts transactions to the top and deletes the leftover empty grid rows (deleteDimension). */
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
  await page.waitForFunction(()=>typeof trimLedger==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    window.__cleared=[]; window.__writes=[]; window.__batch=[];
    window.LEDGER_GID=5;
    window.ssBase=function(){return "https://x";};
    window.vBatchClear=async function(rgs){Array.prototype.push.apply(window.__cleared,rgs);};
    window.vBatchUpdate=async function(d){Array.prototype.push.apply(window.__writes,d);};
    window.loadAll=async function(){};window.renderAll=function(){};
    window.api=async function(url,opts){
      if(/fields=sheets\(properties/.test(url)) return {sheets:[{properties:{sheetId:5,gridProperties:{rowCount:1048576}}}]};
      if(/:batchUpdate$/.test(url)){window.__batch.push(JSON.parse(opts.body));return {};}
      return {};
    };
    // 3 real rows + gaps + a stranded row
    state={rows:[
      [2026,1,'2026-01-01','Me','Groceries','Publix',50,'',''],
      [],
      [2026,2,'2026-02-01','Me','Gas','Shell',40,'',''],
      [2026,3,'2026-03-01','Me','Rent','LL',1500,'','']
    ]};
    var r=await trimLedger();
    var del=null;
    window.__batch.forEach(function(bd){(bd.requests||[]).forEach(function(rq){if(rq.deleteDimension)del=rq.deleteDimension;});});
    return {ret:r, cleared:window.__cleared, firstWriteRange:window.__writes[0]&&window.__writes[0].range, writeCount:window.__writes.length, del:del};
  });

  ck('cleared the whole ledger data range (A2:I)', res.cleared.some(x=>/Account Ledger'?!A2:I/.test(x)), JSON.stringify(res.cleared));
  ck('rewrote 3 real transactions starting at row 2', res.writeCount===3 && /!A2$/.test(res.firstWriteRange||''), JSON.stringify({n:res.writeCount,first:res.firstWriteRange}));
  ck('deleteDimension issued on the ledger sheet, ROWS', !!res.del && res.del.range.sheetId===5 && res.del.range.dimension==='ROWS', JSON.stringify(res.del));
  ck('keeps 2000 rows (header+3+buffer, min 2000), deletes the rest to 1,048,576', res.del && res.del.range.startIndex===2000 && res.del.range.endIndex===1048576, JSON.stringify(res.del));
  ck('returns before/after/rows summary', res.ret && res.ret.before===1048576 && res.ret.after===2000 && res.ret.rows===3, JSON.stringify(res.ret));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

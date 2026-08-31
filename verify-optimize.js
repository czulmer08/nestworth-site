/* Verify optimizeSheet: compacts+trims the ledger and rewrites summary SUMIFS from $X$1:$X$1048361 to whole-column $X:$X. */
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
  await page.waitForFunction(()=>typeof optimizeSheet==='function'&&typeof colA1==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const cola=await page.evaluate(()=>[colA1(1),colA1(6),colA1(26),colA1(27),colA1(28)]);
  ck('colA1: 1=A, 6=F, 26=Z, 27=AA, 28=AB', JSON.stringify(cola)===JSON.stringify(['A','F','Z','AA','AB']), JSON.stringify(cola));

  const res=await page.evaluate(async()=>{
    window.LEDGER_GID=5; window.ssBase=function(){return "https://x";};
    window.__cleared=[];window.__writes=[];window.__batch=[];
    window.vBatchClear=async function(r){Array.prototype.push.apply(window.__cleared,r);};
    window.vBatchUpdate=async function(d){Array.prototype.push.apply(window.__writes,d);};
    window.loadAll=async function(){};window.renderAll=function(){};
    var F="=SUMIFS('Account Ledger'!$G$1:$G$1048361,'Account Ledger'!$E$1:$E$1048361,$A5,'Account Ledger'!$C$1:$C$1048361,\">=\"&DATE($B$2,1,1),'Account Ledger'!$C$1:$C$1048361,\"<=\"&TODAY())";
    window.api=async function(url,opts){
      var d=decodeURIComponent(url);
      if(/gridProperties\(rowCount/.test(d)) return {sheets:[{properties:{sheetId:5,gridProperties:{rowCount:1048576}}}]};
      if(/sheets.properties\(title\)/.test(d)) return {sheets:[{properties:{title:"2026 Account Summary"}}]};
      if(/valueRenderOption=FORMULA/.test(d)) return {values:[["CATEGORY"],["", F]]}; // row2 col B has the formula
      if(/:batchUpdate$/.test(url)){window.__batch.push(JSON.parse(opts.body));return {};}
      return {};
    };
    state={rows:[[2026,1,'1/1/2026','Me','Groceries','Publix',50,'',''],[2026,2,'2026-02-01','Me','Gas','Shell',40,'','']]}; // row1 has a US TEXT date to exercise the repair
    var r=await optimizeSheet();
    // find the formula write-back (a vBatchUpdate whose value contains SUMIFS)
    var fw=window.__writes.filter(function(w){return w.values&&(""+w.values[0][0]).indexOf("SUMIFS")>=0;});
    var del=null,fmtAB=null,fmtC=null;window.__batch.forEach(function(bd){(bd.requests||[]).forEach(function(rq){if(rq.deleteDimension)del=rq.deleteDimension;
      if(rq.repeatCell&&rq.repeatCell.cell&&rq.repeatCell.cell.userEnteredFormat&&rq.repeatCell.cell.userEnteredFormat.numberFormat){var rg=rq.repeatCell.range;if(rg.startColumnIndex===0)fmtAB=rq.repeatCell;else if(rg.startColumnIndex===2)fmtC=rq.repeatCell;}});});
    var acWrite=window.__writes.filter(function(w){return /AC1$/.test(w.range||"");})[0]||null;
    var rowW=window.__writes.filter(function(w){return /!A2$/.test(w.range||"")&&w.values&&w.values[0].length>=3;})[0]||null;
    return {ret:r, fw:fw, del:del, fmtAB:fmtAB, fmtC:fmtC, cleared:window.__cleared, acWrite:acWrite, rowW:rowW};
  });

  ck('ledger cleared + trimmed (deleteDimension issued)', res.cleared.some(x=>/A2:I/.test(x))&&!!res.del&&res.del.range.dimension==='ROWS', JSON.stringify({c:res.cleared,d:res.del}));
  ck('summary formula rewritten to whole-column (no 1048361, has $G:$G)', res.fw.length>0 && res.fw[0].values[0][0].indexOf('1048361')<0 && res.fw[0].values[0][0].indexOf('$G:$G')>=0 && res.fw[0].values[0][0].indexOf('$E:$E')>=0, JSON.stringify(res.fw[0]&&res.fw[0].values[0][0]));
  ck('volatile TODAY() re-pointed at the non-volatile $AC$1 helper', res.fw.length>0 && res.fw[0].values[0][0].indexOf('TODAY(')<0 && res.fw[0].values[0][0].indexOf('$AC$1')>=0, JSON.stringify(res.fw[0]&&res.fw[0].values[0][0]));
  ck('optimize stamps the AC1 helper date', res.acWrite&&/\d{4}-\d{2}-\d{2}/.test(''+res.acWrite.values[0][0]), JSON.stringify(res.acWrite));
  ck('reports cells streamlined', res.ret&&res.ret.cells>=1, JSON.stringify(res.ret));
  ck('Year/Month columns (A:B) reset to plain-number format', !!res.fmtAB&&res.fmtAB.range.startColumnIndex===0&&res.fmtAB.range.endColumnIndex===2&&res.fmtAB.cell.userEnteredFormat.numberFormat.type==='NUMBER'&&res.fmtAB.cell.userEnteredFormat.numberFormat.pattern==='0', JSON.stringify(res.fmtAB&&res.fmtAB.range));
  ck('rewritten rows get self-maintaining Year/Month formulas off the Date', !!res.rowW&&/^=IFERROR\(YEAR\(C2\)/.test(''+res.rowW.values[0][0])&&/^=IFERROR\(MONTH\(C2\)/.test(''+res.rowW.values[0][1]), JSON.stringify(res.rowW&&res.rowW.values[0].slice(0,3)));
  ck('Date column (C) is forced to a DATE number-format (so a text-formatted import can’t keep dates as text)', !!res.fmtC&&res.fmtC.range.startColumnIndex===2&&res.fmtC.range.endColumnIndex===3&&res.fmtC.cell.userEnteredFormat.numberFormat.type==='DATE', JSON.stringify(res.fmtC&&res.fmtC.range));
  ck('the DATE REPAIR normalizes a text date to real-date ISO ("1/1/2026" → "2026-01-01" in the rewritten row)', !!res.rowW&&(''+res.rowW.values[0][2])==='2026-01-01', JSON.stringify(res.rowW&&res.rowW.values[0][2]));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

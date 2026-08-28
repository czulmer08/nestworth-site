/* Verify: table-safe append writes to the top free row; compaction pulls stranded rows up; stranding is detected. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof vappend==='function'&&typeof compactLedger==='function'&&typeof maybeOfferTidy==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) vappend writes to the first free row from the TOP (header + 3 data -> row 5), via batchUpdate, not the API append
  const r1=await page.evaluate(async()=>{
    window.__writes=[]; window.__usedApiAppend=false;
    window.ssBase=()=>"https://x";
    var colA={1:'Year',2:2026,3:2026,4:2026}; // header + 3 data rows -> first free is row 5
    window.vgetU=async(rng)=>{var m=rng.match(/!A(\d+)(?::A(\d+))?/);var s=+m[1],e=m[2]?+m[2]:s;var mx=0;Object.keys(colA).forEach(k=>{if(+k>mx)mx=+k;});var end=Math.min(e,Math.max(mx,s));var o=[];for(var r=s;r<=end;r++)o.push([colA[r]!=null?colA[r]:'']);return {values:o};};
    window.vBatchUpdate=async(data)=>{Array.prototype.push.apply(window.__writes,data);data.forEach(d=>{var m=d.range.match(/!A(\d+)/);if(m)colA[+m[1]]=d.values[0][0];});};
    window.ensureLedgerTable=async()=>{};
    window.api=async(url)=>{ if(/:append/.test(url))window.__usedApiAppend=true; return {updates:{updatedRange:"x!A9:I9"}}; };
    var res=await vappend("Account Ledger!A:I",[[2027,2,'2027-02-01','','Gas','Shell',40,'','']]);
    var dataWrite=window.__writes.filter(w=>w.values[0].length>1)[0]; // the real transaction write (not the nonce reservation)
    return {writeRange:dataWrite&&dataWrite.range, usedApiAppend:window.__usedApiAppend, updatedRange:res.updates.updatedRange};
  });
  ck('append writes to row 5 (first free from top), not Google append', /!A5$/.test(r1.writeRange||'')&&!r1.usedApiAppend&&/A5:I5/.test(r1.updatedRange||''), JSON.stringify(r1));

  // 2) vappend falls back to the API append if the scan read fails (never loses a write)
  const r2=await page.evaluate(async()=>{
    window.__usedApiAppend=false;
    window.vgetU=async()=>{throw new Error("boom");};
    window.api=async(url)=>{ if(/:append/.test(url)){window.__usedApiAppend=true;return {updates:{updatedRange:"Account Ledger!A9:I9"}};} return {}; };
    await vappend("Account Ledger!A:I",[[2027,2,'2027-02-01','','Gas','Shell',40,'','']]);
    return {usedApiAppend:window.__usedApiAppend};
  });
  ck('append falls back to Google append when the scan fails', r2.usedApiAppend, JSON.stringify(r2));

  // 3) compactLedger: clears the ledger and rewrites real transactions from row 2 (stranded row included, gaps dropped)
  const r3=await page.evaluate(async()=>{
    window.__cleared=[]; window.__writes=[];
    window.state={rows:[
      [2026,1,'2026-01-01','','Groceries','Publix',100,'',''],  // real
      [],                                                        // empty gap
      [2026,2,'2026-02-01','','Gas','Shell',40,'',''],           // real
      [2026,3,'2026-03-01','','Rent','LL',1500,'','']            // real (imagine it was stranded far down)
    ]};
    window.vBatchClear=async(r)=>{Array.prototype.push.apply(window.__cleared,r);};
    window.vBatchUpdate=async(d)=>{Array.prototype.push.apply(window.__writes,d);};
    window.loadAll=async()=>{}; window.renderAll=()=>{};
    await compactLedger();
    return {cleared:window.__cleared, rows:window.__writes.map(w=>({range:w.range,cat:w.values[0][4]}))};
  });
  const okClear=r3.cleared.some(x=>/Account Ledger'?!A2:I/.test(x));
  const seq=r3.rows.map(x=>x.range);
  ck('compact clears A2:I and rewrites 3 real txns at rows 2,3,4 (gap dropped)',
     okClear&&r3.rows.length===3&&/!A2$/.test(seq[0])&&/!A3$/.test(seq[1])&&/!A4$/.test(seq[2])&&r3.rows[0].cat==='Groceries'&&r3.rows[2].cat==='Rent', JSON.stringify(r3));

  // 4) maybeOfferTidy shows the bar only when rows are stranded (span >> real count)
  const r4=await page.evaluate(()=>{
    function has(){return !!document.getElementById('tidyBar');}
    // stranded: 3 real txns but the array spans 1000 rows
    var big=[]; for(var i=0;i<1000;i++)big.push([]); big[0]=[2026,1,'2026-01-01','','A','',10,'','']; big[500]=[2026,2,'2026-02-01','','B','',20,'','']; big[999]=[2026,3,'2026-03-01','','C','',30,'',''];
    var bb=document.getElementById('tidyBar'); if(bb)bb.remove(); window._tidyOffered=false;
    window.state={rows:big}; maybeOfferTidy(); var stranded=has();
    // healthy: 3 real txns, array length 3
    var bb2=document.getElementById('tidyBar'); if(bb2)bb2.remove(); window._tidyOffered=false;
    window.state={rows:[[2026,1,'2026-01-01','','A','',10,'',''],[2026,2,'2026-02-01','','B','',20,'',''],[2026,3,'2026-03-01','','C','',30,'','']]}; maybeOfferTidy(); var healthy=has();
    return {stranded:stranded, healthy:healthy};
  });
  ck('tidy bar appears when stranded, not when healthy', r4.stranded&&!r4.healthy, JSON.stringify(r4));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* parseLedgerDate (v0.68.66) — the testable core of the Optimize "repair ledger dates" fix. A ledger imported from a spreadsheet can
   arrive with its Date column stored as TEXT, which silently zeroes the Account Summary's Spent SUMIFS (date criteria can't match
   text). Optimize now normalizes every Date cell to a real-date ISO string (and forces the column to a date format) so the write
   re-parses text → real dates. This proves the parser handles ISO, US M/D/Y (2- and 4-digit year, slash/dash), serial numbers, and
   rejects junk. */
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
  await page.waitForFunction(()=>typeof parseLedgerDate==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    var serial=Math.round(Date.UTC(2026,8,6)/86400000)+25569; // Sheets/Excel serial for 2026-09-06
    return {
      iso:parseLedgerDate('2026-01-15'),
      isoShort:parseLedgerDate('2026-1-5'),
      isoTime:parseLedgerDate('2026-12-15T10:30:00'),
      usSlash:parseLedgerDate('9/6/2026'),
      usPad:parseLedgerDate('01/05/2026'),
      us2yr:parseLedgerDate('9/6/26'),
      usDash:parseLedgerDate('1-15-2026'),
      num:parseLedgerDate(serial),
      empty:parseLedgerDate(''),
      nul:parseLedgerDate(null),
      junk:parseLedgerDate('not a date')
    };
  });

  ck('ISO passes through canonicalized ("2026-01-15", "2026-1-5" → "2026-01-05")',
     R.iso==='2026-01-15'&&R.isoShort==='2026-01-05', JSON.stringify({iso:R.iso,short:R.isoShort}));
  ck('ISO with a time suffix keeps just the date ("2026-12-15T10:30:00" → "2026-12-15")', R.isoTime==='2026-12-15', 'got '+R.isoTime);
  ck('US M/D/Y (4-digit) → ISO ("9/6/2026" → "2026-09-06", "01/05/2026" → "2026-01-05")',
     R.usSlash==='2026-09-06'&&R.usPad==='2026-01-05', JSON.stringify({s:R.usSlash,p:R.usPad}));
  ck('US M/D/Y with a 2-digit year and dash separators ("9/6/26" → "2026-09-06", "1-15-2026" → "2026-01-15")',
     R.us2yr==='2026-09-06'&&R.usDash==='2026-01-15', JSON.stringify({y:R.us2yr,d:R.usDash}));
  ck('a real date serial NUMBER → ISO (the already-real-date case round-trips to "2026-09-06")', R.num==='2026-09-06', 'got '+R.num);
  ck('blank / null / junk → "" (left as-is, never a bogus date)', R.empty===''&&R.nul===''&&R.junk==='', JSON.stringify({e:R.empty,n:R.nul,j:R.junk}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: Optimize can normalize any common ledger date shape to a real date, so a text-dated import stops blanking the Spent column.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

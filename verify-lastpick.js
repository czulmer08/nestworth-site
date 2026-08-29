/* Verify the deposit Source and expense Payee default to your LAST pick, not always the first line — the "keeps defaulting
   to Denzell" bug. Also confirms the save paths record the pick. */
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
  await page.waitForFunction(()=>typeof fillPayeeSource==='function'&&typeof setLastPick==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    try{localStorage.removeItem("nw_last_source_");localStorage.removeItem("nw_last_payee_");localStorage.setItem("nw_active","");}catch(e){}
    state.cons=[{name:'Denzell'},{name:'me'}];       // Denzell is first (the old default)
    state.meta={payees:['Me','Denzell']};state.rows=[];

    // 1) with no last pick, the deposit Source falls back to the first line (Denzell)
    $("dSource").value="";fillPayeeSource();
    var beforeSrc=$("dSource").value;

    // 2) after choosing "me" once, a fresh deposit form defaults to "me" — not back to Denzell
    setLastPick("source","me");$("dSource").value="";fillPayeeSource();
    var afterSrc=$("dSource").value;

    // 3) same for the expense Payee
    $("fPayee").value="";fillPayeeSource();var beforePay=$("fPayee").value;
    setLastPick("payee","Denzell");$("fPayee").value="";fillPayeeSource();var afterPay=$("fPayee").value;

    // 4) an explicit current selection always wins over the remembered one
    $("dSource").value="Denzell";fillPayeeSource();var explicitWins=$("dSource").value;

    // 5) a remembered source that no longer exists is ignored (falls back), never crashes
    setLastPick("source","GhostJob");$("dSource").value="";fillPayeeSource();var ghost=$("dSource").value;

    return {beforeSrc,afterSrc,beforePay,afterPay,explicitWins,ghost,
      persisted:lastPick("source"),
      savesSource:/setLastPick\("source",src\)/.test(document.documentElement.outerHTML)||true};
  });

  // static source checks (the save paths record the pick)
  const savesSource=/setLastPick\("source",src\)/.test(src);
  const savesPayee=/if\(payee\)setLastPick\("payee",payee\)/.test(src);

  ck('with no history, deposit Source falls back to the first line (Denzell)', res.beforeSrc==='Denzell', res.beforeSrc);
  ck('after picking "me" once, the deposit Source defaults to "me" (not Denzell)', res.afterSrc==='me', res.afterSrc);
  ck('with no history, expense Payee falls back to the first person (Me)', res.beforePay==='Me', res.beforePay);
  ck('after picking "Denzell" once, the expense Payee defaults to Denzell', res.afterPay==='Denzell', res.afterPay);
  ck('an explicit current selection still wins over the remembered pick', res.explicitWins==='Denzell', res.explicitWins);
  ck('a remembered source that no longer exists is ignored, no crash', res.ghost!=='GhostJob', res.ghost);
  ck('the last pick persists (localStorage)', res.persisted==='GhostJob'||res.persisted==='me', res.persisted);
  ck('addDeposit records the chosen source', savesSource, String(savesSource));
  ck('addEntry records the chosen payee', savesPayee, String(savesPayee));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

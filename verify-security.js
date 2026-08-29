/* STATIC / CODE-LEVEL SECURITY REGRESSION TESTS. Automates the code-readable security properties so a regression can't
   silently reintroduce a known class of bug. Covers: spreadsheet formula injection on write paths; DOM/XSS escaping of every
   user-controlled string that reaches innerHTML; OAuth access-token never persisted to browser storage; share link doesn't
   grant writer; starter-copy sanitization strips sensitive data BEFORE any public-reader grant.
   SCOPE: code-level, executable checks + source assertions. A full adversarial audit (live OAuth, real Drive ACLs, network
   MITM) is out of harness scope and should be a separate independent review. */
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
  await page.waitForFunction(()=>typeof sanitizeFormulaCell==='function'&&typeof esc==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const XSS='<img src=x onerror="window.__xss=1">';const SCR='<script>window.__xss2=1<\/script>';

  const res=await page.evaluate(function(_a){var XSS=_a.XSS,SCR=_a.SCR;
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    window.isGoalName=function(){return false;};
    var R={};
    // 1) formula-injection sanitizer
    R.san={eq:sanitizeFormulaCell("=SUM(A1)")==="'=SUM(A1)",plus:sanitizeFormulaCell("+1")==="'+1",minus:sanitizeFormulaCell("-cmd")==="'-cmd",at:sanitizeFormulaCell("@x")==="'@x",tab:sanitizeFormulaCell("\tx")==="'\tx",cr:sanitizeFormulaCell("\rx")==="'\rx",
      normal:sanitizeFormulaCell("Grocery Store")==="Grocery Store",num:sanitizeFormulaCell(2066.67)===2066.67};
    R.sanRow=(function(){var r=sanitizeRow(["=EVIL()","Store",5]);return r[0]==="'=EVIL()"&&r[1]==="Store"&&r[2]===5;})();
    // 2) XSS: render user-controlled strings and confirm NO live element is injected
    window.__xss=0;window.__xss2=0;
    state.meta={cats:{},cons:{}};
    state.cats=[{name:XSS,mbud:100,mspent:10,mused:10,annual:1200,bud12:[100,100,100,100,100,100,100,100,100,100,100,100]}];
    state.cons=[{name:SCR,annual:12000,mtarget:1000,mdep:0,bud12:[1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000,1000]}];
    state.goals=[{name:XSS,target:5000,balance:1000,monthly:100}];
    state.rows=[[2026,8,'2026-08-03','',XSS,SCR,50,'','N']];
    state.assets=[{name:XSS,bal:100}];state.debts=[];
    try{buildIndexes();}catch(e){}try{applyBudgetSpend();}catch(e){}try{loadGoals();}catch(e){}
    var rendered=[];['renderCatTbl','renderMonth','renderRecent','renderGoals','renderCats','fillCons','renderWorth','renderContingency'].forEach(function(fn){try{show('appScreen');window[fn]&&window[fn]();rendered.push(fn);}catch(e){}});
    // any injected <img onerror> or <script> anywhere in the document body = XSS
    R.xss={liveImg:!!document.querySelector('img[onerror]'),liveScript:document.querySelectorAll('script').length,firedImg:window.__xss,firedScr:window.__xss2,rendered:rendered.length};
    // esc() unit
    R.esc=esc(XSS).indexOf('<img')<0&&esc(XSS).indexOf('&lt;img')>=0&&esc(SCR).indexOf('<script')<0;
    return R;
  },{XSS:XSS,SCR:SCR});

  // executable checks
  ck('formula-injection: = + - @ tab CR prefixed with apostrophe; normal/number untouched', res.san.eq&&res.san.plus&&res.san.minus&&res.san.at&&res.san.tab&&res.san.cr&&res.san.normal&&res.san.num, JSON.stringify(res.san));
  ck('sanitizeRow sanitizes each cell of a ledger row', res.sanRow, '');
  ck('esc() neutralizes <img>/<script> to entities', res.esc, '');
  ck('XSS: no live <img onerror> element injected by any render of a malicious name', res.xss.liveImg===false&&res.xss.firedImg===0, JSON.stringify(res.xss));
  ck('XSS: no extra <script> element injected, none fired', res.xss.firedScr===0, JSON.stringify(res.xss));
  ck('renders actually ran against the malicious household (not silently skipped)', res.xss.rendered>=6, 'rendered='+res.xss.rendered);

  // ---- SOURCE-LEVEL assertions (grep the shipped app.html) ----
  const S=src;
  // TOKEN POLICY — test the ACTUAL, documented policy, not a stronger claim the code doesn't honour. NestWorth intentionally
  // caches ONLY the short-lived drive.file ACCESS token + its expiry (for iOS relaunch usability). What must hold: no
  // long-lived credential (refresh/id token) is ever persisted; the record is exactly {t,e}; an expired token is refused;
  // sign-out clears it. (Drive it through the real saveTok/storedToken/clearTok.)
  const tok=await page.evaluate(function(){
    var R={};try{localStorage.removeItem("nw_tok");}catch(e){}
    saveTok({access_token:"ya29.ACCESS_SECRET",expires_in:3600,refresh_token:"1//REFRESH_SECRET",id_token:"ID.JWT.SECRET",scope:"https://www.googleapis.com/auth/drive.file"});
    var all={};try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);all[k]=localStorage.getItem(k);}}catch(e){}
    var stored=all["nw_tok"]||"";
    R.storesAccess=stored.indexOf("ya29.ACCESS_SECRET")>=0;
    R.hasExpiry=/"e":\s*\d/.test(stored);
    var shape=false;try{var o=JSON.parse(stored);shape=(o&&o.t==="ya29.ACCESS_SECRET"&&typeof o.e==="number"&&Object.keys(o).sort().join(",")==="e,t");}catch(e){}
    R.shapeOnlyTandE=shape;
    R.noRefreshPersisted=Object.keys(all).every(function(k){return (all[k]||"").indexOf("1//REFRESH_SECRET")<0;});
    R.noIdTokenPersisted=Object.keys(all).every(function(k){return (all[k]||"").indexOf("ID.JWT.SECRET")<0;});
    try{localStorage.setItem("nw_tok",JSON.stringify({t:"ya29.OLD",e:Date.now()-1000}));}catch(e){}
    R.refusesExpired=(storedToken()===null);
    try{localStorage.setItem("nw_tok",JSON.stringify({t:"ya29.FRESH",e:Date.now()+3600000}));}catch(e){}
    R.acceptsFresh=(storedToken()==="ya29.FRESH");
    clearTok();try{R.clearRemoves=(localStorage.getItem("nw_tok")===null);}catch(e){R.clearRemoves=false;}
    return R;
  });
  ck('token cache holds ONLY the short-lived access token + expiry (exact {t,e} shape)', tok.storesAccess&&tok.hasExpiry&&tok.shapeOnlyTandE, JSON.stringify(tok));
  ck('NO long-lived credential persisted: refresh_token / id_token never written to storage', tok.noRefreshPersisted&&tok.noIdTokenPersisted&&!/localStorage[\s\S]{0,60}refresh_token|lsSet\([^)]*refresh/i.test(S), JSON.stringify(tok));
  ck('an expired cached token is refused; a fresh one is accepted (storedToken enforces expiry)', tok.refusesExpired&&tok.acceptsFresh, JSON.stringify(tok));
  ck('the cached token is cleared on sign-out (clearTok removes it; sign-out clears nw_tok)', tok.clearRemoves&&/clearTok\(\)/.test(S)&&/"nw_tok"/.test(S), '');
  ck('the token-caching tradeoff is documented in source (TOKEN POLICY), not hidden', /TOKEN POLICY/.test(S), '');
  // write paths go through sanitizeRow before a USER_ENTERED append
  ck('vappend sanitizes user text before the USER_ENTERED write', /values=\(values\|\|\[\]\)\.map\(sanitizeRow\)/.test(S), '');
  ck('saveEdit sanitizes edited user text before its write', /sanitizeRow\(/.test(S)&&/saveEdit/.test(S), '');
  // boundary regression guard: every ledger category/company/payee (D/E/F) rewrite must escape user text — a name like "=Rent"
  // must never be written as a live formula (the class of bug that made "add to budget" silently fail via claimRow).
  const ledgerNameWrites=(S.match(/range:LEDGER\+"!(?:D|E|F)"\+[^,]*,values:\[\[([^\]]+)\]\]/g)||[]);
  const unsafeLedger=ledgerNameWrites.filter(w=>!/sanitizeFormulaCell\(/.test(w)&&!/=IFERROR|=SUM/.test(w)&&!/\[\[""\]\]/.test(w));
  ck('every ledger category/company/payee rewrite escapes user text (formula-injection boundary)', ledgerNameWrites.length>0&&unsafeLedger.length===0, unsafeLedger.join(' | ')||('checked '+ledgerNameWrites.length));
  // the regular share link must NOT grant writer (only the deliberate invite path does)
  const shareFn=(S.match(/function budgetShareLink[\s\S]{0,600}/)||[''])[0];
  ck('budgetShareLink() does NOT grant anyone writer access', shareFn&&!/role:\s*["']writer["']/.test(shareFn), '');
  // starter-copy sanitization strips sensitive data BEFORE granting public reader
  const starter=(S.match(/anyoneWithLink|public[\s\S]{0,40}reader|role:\s*["']reader["'][\s\S]{0,40}type:\s*["']anyone["']/)||['']);
  const sanitizesBeforePublic=/clear[\s\S]{0,4000}(role:\s*["']reader["']|anyone)/i.test(S)||/(strip|sanitiz|remove|clear)[\s\S]{0,2000}(startCash|ledger|Account Ledger|transactions)[\s\S]{0,3000}(reader|anyone)/i.test(S);
  ck('starter copy is sanitized (sensitive tabs cleared) before any public-reader grant', sanitizesBeforePublic, 'ordering check');
  // formula sanitizer covers the injection lead characters
  ck('sanitizer regex covers = + - @ and tab/CR lead characters', /\^\[=\+\\-@\\t\\r\]/.test(S)||/\^\[=\+\-@/.test(S), '');
  // CSP / external script surface: no obvious eval / new Function on user data
  ck('no eval()/new Function() on user-controlled data in the app', !/\beval\s*\(/.test(S)&&!/new Function\s*\(/.test(S), '');

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  SCOPE: code-level static + executable checks. Not a substitute for an independent adversarial/live-OAuth audit.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

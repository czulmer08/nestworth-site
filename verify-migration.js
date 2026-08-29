/* SCHEMA MIGRATION & COMPATIBILITY. Proves NestWorth can open a Nest created by an OLDER generation and still (a) migrate it
   deterministically and IDEMPOTENTLY, (b) preserve its data, (c) preserve its FINANCIAL MEANING (the strong oracle: the
   authoritative engine must compute the same household facts before and after migration — not merely the same cells), and
   (d) FAIL SAFE on a Nest created by a NEWER version (refuse, never downgrade or discard). Historical fixtures represent real
   NestWorth generations, not synthetic malformed JSON. SCOPE: single-client; the migration is data-preserving at v1. */
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
  await page.waitForFunction(()=>typeof migrateMeta==='function'&&typeof normMeta==='function'&&typeof netWorthNow==='function'&&typeof monthActualTotals==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  // Historical fixtures — loaded from the CHECKED-IN corpus in fixtures/meta/. Each file is a META document as an older
  // NestWorth generation would have written it (unversioned = v0). Dropping a real prior-generation doc into that directory
  // adds it to this suite automatically. Paired with a fixed ledger/accounts so the financial oracle has something to compute.
  const ROWS=[
    [2026,8,'2026-08-01','Denzell','Deposit','',3000,'',''],   // income
    [2026,8,'2026-08-03','','Groceries','Publix',220,'',''],   // budgeted expense
    [2026,8,'2026-08-04','','Pets','Chewy',40,'',''],          // unbudgeted expense (still counts in actuals)
    [2026,8,'2026-08-06','','Travel','Vacation',150,'','']     // category-linked goal move
  ];
  const FIXDIR=path.join(__dirname,'fixtures','meta');
  const FIX={};let fixCount=0;
  fs.readdirSync(FIXDIR).filter(f=>f.endsWith('.json')).sort().forEach(f=>{FIX[f]=JSON.parse(fs.readFileSync(path.join(FIXDIR,f),'utf8'));fixCount++;});
  if(!fixCount){console.log('  no fixtures found in fixtures/meta/');process.exit(1);}
  const ACC={assets:[{name:'Checking',bal:8000},{name:'Savings',bal:5000}],debts:[{name:'Loan',bal:2000}]};

  // Fingerprint: authoritative household FACTS via the real engine, driven by a given meta doc.
  const run=await page.evaluate(async({FIX,ROWS,ACC})=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    window.isGoalName=function(x){return /^(car|vacation|emergency|house)$/i.test((''+x).trim());};
    function loadDoc(doc){
      state.meta=normMeta(JSON.parse(JSON.stringify(doc)));
      state.rows=JSON.parse(JSON.stringify(ROWS));state.assets=JSON.parse(JSON.stringify(ACC.assets));state.debts=JSON.parse(JSON.stringify(ACC.debts));
      state.goals=(state.meta.goals||[]).map(function(g){return JSON.parse(JSON.stringify(g));});
      state.cats=Object.keys(state.meta.cats||{}).map(function(k){return {name:k,mbud:(state.meta.cats[k]&&state.meta.cats[k].amount)||0};});
      state.cons=Object.keys(state.meta.cons||{}).map(function(k){return {name:k};});
      try{buildIndexes&&buildIndexes();}catch(e){}try{loadGoals&&loadGoals();}catch(e){}
    }
    function fp(){
      var ma=monthActualTotals(2026,8);var roll=null;try{roll=computeRollover();}catch(e){}
      return {nw:r2(netWorthNow()),exp:r2(ma.expense),inc:r2(ma.income),goalBal:r2((state.goals||[]).reduce(function(s,g){return s+(Number(g.balance)||0);},0)),uncov:roll?r2(roll.totalUncoveredDeficit||0):0};
    }
    var R={fixtures:{}};
    Object.keys(FIX).forEach(function(name){
      var doc=FIX[name];
      loadDoc(doc);var before=fp();                 // facts read straight from the OLD (normMeta'd, unmigrated) doc
      var mig=migrateMeta(normMeta(JSON.parse(JSON.stringify(doc))));
      var mig2=migrateMeta(JSON.parse(JSON.stringify(mig))); // migrate the already-migrated doc → must be identical (idempotent)
      // reload the app from the MIGRATED doc and recompute facts
      state.meta=mig;state.goals=(mig.goals||[]).map(function(g){return JSON.parse(JSON.stringify(g));});
      state.cats=Object.keys(mig.cats||{}).map(function(k){return {name:k,mbud:(mig.cats[k]&&mig.cats[k].amount)||0};});
      try{buildIndexes&&buildIndexes();loadGoals&&loadGoals();}catch(e){}
      var after=fp();
      // data preservation: every field of the normMeta'd original survives except the stamped schemaVersion
      var origNorm=normMeta(JSON.parse(JSON.stringify(doc)));var preserved=true;
      Object.keys(origNorm).forEach(function(k){if(k==='schemaVersion')return;if(JSON.stringify(origNorm[k])!==JSON.stringify(mig[k]))preserved=false;});
      R.fixtures[name]={before:before,after:after,fpSame:JSON.stringify(before)===JSON.stringify(after),
        stamped:mig.schemaVersion===CURRENT_SCHEMA_VERSION,idempotent:JSON.stringify(mig)===JSON.stringify(mig2),preserved:preserved};
    });
    // Interpretation checks — the current engine must read old shapes correctly.
    loadDoc(FIX['03-old-account-earmarked-goal.json']);R.acctGoalNW=r2(netWorthNow());        // House is earmarked to Savings ⇒ NOT added on top of the account
    loadDoc(FIX['02-old-goals-no-residual-cap-link.json']);R.standaloneNW=r2(netWorthNow()); // Vacation+Emergency have no account ⇒ standalone savings, DO count
    R.standaloneGoalSum=r2((state.goals||[]).reduce(function(s,g){return s+(Number(g.balance)||0);},0)); // engine-derived (ledger) balances, not the meta's stored starting balance
    // FAIL-SAFE: a Nest newer than this build must throw NEWER_SCHEMA and never be silently downgraded.
    var newer={code:null};try{migrateMeta({schemaVersion:CURRENT_SCHEMA_VERSION+5,cats:{}});}catch(e){newer.code=e.code;newer.from=e.from;}
    R.newer=newer;
    // BACKUP: migrating a v0 doc records a pre-migration backup before transforming.
    try{localStorage.removeItem('nw_meta_backup');}catch(e){}
    migrateMeta(normMeta({startCash:99}));
    var bkRaw=null;try{bkRaw=JSON.parse(localStorage.getItem('nw_meta_backup')||'null');}catch(e){}
    R.backup={present:!!bkRaw,from:bkRaw&&bkRaw.from};
    // DEFENSIVE: malformed shapes (wrong types) must not throw and must coerce to safe defaults.
    var bad={};try{var nm=normMeta({goals:'not-an-array',cats:42,payees:{},startCash:'oops'});bad={goals:Array.isArray(nm.goals),cats:(nm.cats&&typeof nm.cats==='object'&&!Array.isArray(nm.cats)),payees:Array.isArray(nm.payees)&&nm.payees.length>=1,startCash:nm.startCash===0};}catch(e){bad.threw=e.message;}
    R.defensive=bad;
    // NEWER remote mid-session must lock writes (schemaTooNew) — check the lock + no write.
    _schemaLocked=false;var wrote=0;window.vBatchUpdate=async function(){wrote++;return {};};
    schemaTooNew({from:99});var lockedWrite=await writeMeta();
    R.lock={locked:_schemaLocked===true,writeRefused:lockedWrite===false&&wrote===0,bar:!!document.getElementById('schemaBar')};
    return R;
  },{FIX,ROWS,ACC});

  // Per-fixture assertions
  Object.keys(run.fixtures).forEach(name=>{const f=run.fixtures[name];
    ck('fixture ['+name+'] migrates: stamped to current, idempotent, data preserved', f.stamped&&f.idempotent&&f.preserved, JSON.stringify(f));
    ck('fixture ['+name+'] preserves FINANCIAL MEANING (engine facts identical before/after migration)', f.fpSame, JSON.stringify({before:f.before,after:f.after}));
  });
  // Interpretation
  ck('old account-earmarked goal is NOT double-counted in net worth (assets − debts only)', run.acctGoalNW===8000+5000-2000, String(run.acctGoalNW));
  ck('old standalone goals (no account) DO count toward net worth (assets − debts + engine-derived goal balances)', run.standaloneNW===Math.round((8000+5000-2000+run.standaloneGoalSum)*100)/100, JSON.stringify({nw:run.standaloneNW,goalSum:run.standaloneGoalSum}));
  // Fail-safe / backup / defensive / lock
  ck('FAIL SAFE: a Nest newer than this build throws NEWER_SCHEMA (never downgraded)', run.newer.code==='NEWER_SCHEMA'&&run.newer.from===run.newer.from, JSON.stringify(run.newer));
  ck('a pre-migration BACKUP is recorded before transforming a v0 doc', run.backup.present&&run.backup.from===0, JSON.stringify(run.backup));
  ck('normMeta is defensive: malformed shapes coerce to safe defaults, never throw', run.defensive.goals&&run.defensive.cats&&run.defensive.payees&&run.defensive.startCash&&!run.defensive.threw, JSON.stringify(run.defensive));
  ck('a NEWER schema seen mid-session LOCKS writes (schemaTooNew) — writeMeta refuses, banner shown', run.lock.locked&&run.lock.writeRefused&&run.lock.bar, JSON.stringify(run.lock));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  SCOPE: v1 migration is data-preserving; the framework enforces idempotency, fail-safe, backup, and financial-meaning preservation for future versioned migrations.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

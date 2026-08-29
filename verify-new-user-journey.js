/* NEW-USER JOURNEY — a clean-start household walked end to end, with the strong oracle at every checkpoint:
   WHAT THE USER SEES  ==  WHAT THE ENGINE COMPUTES  ==  WHAT PERSISTED (to the simulated Sheet).
   Jordan's household, from an empty Nest: record a grocery purchase, a partial refund of it, create a residual savings goal,
   ask Wren what they spent, correct a mistyped amount, then "reload" and confirm nothing was lost or duplicated.
   Drives the REAL write/read/engine/render functions against an in-memory Sheets backend that also applies row edits.
   SCOPE: single-client, simulated backend + mocked auth — it exercises the app's own logic end to end, but it is NOT real
   OAuth/Drive, NOT real-device UX, and NOT the human study. Those are BETA_STUDY.md. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const src=fs.readFileSync(APP,'utf8');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(src);return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof addEntry==='function'&&typeof addGoal==='function'&&typeof monthActualTotals==='function'&&typeof renderCatTbl==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(async()=>{
    accessToken='tok';sheetId='sid';_ledgerTxnColOk=false;
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    window.isGoalName=function(x){return (state.meta.goals||[]).some(function(g){return g&&g.name&&g.name.toLowerCase()===(""+x).trim().toLowerCase();});};window.catBills=function(){return [];};window.topCats=function(){return [];};
    // ---- in-memory Sheet: LEDGER rows (append + row-range edits both applied) ----
    var LEDGER=[];  // each row 9 or 10 wide; amount at index 6, category at 4, company at 5
    function Jr(s,b){return {ok:s>=200&&s<300,status:s,json:async function(){return b;},text:async function(){return JSON.stringify(b);}};}
    window.fetch=async function(url,opts){url=String(url);opts=opts||{};var body={};try{body=JSON.parse(opts.body||'{}');}catch(e){}
      if(/\?fields=sheets/.test(url))return Jr(200,{sheets:[{properties:{title:'Account Ledger',sheetId:1,gridProperties:{columnCount:10}}}]});
      if(/:append/.test(url)){(body.values||[]).forEach(function(r){LEDGER.push(r.slice());});return Jr(200,{updates:{updatedRange:"'Account Ledger'!A"+(LEDGER.length+1)}});}
      if(/\/values\/[^:?]*A1(%3A|:)A/.test(url))return Jr(403,{});   // force append fallback for claimRows
      if(/values:batchUpdate/.test(url)){ // apply row edits to the store (saveEdit writes A{n}:I{n})
        (body.data||[]).forEach(function(d){var m=decodeURIComponent(d.range||"").match(/!A(\d+):I\1$/);if(m){var idx=(+m[1])-2;if(LEDGER[idx])LEDGER[idx]=d.values[0].slice();}});
        return Jr(200,{});}
      if(/\/values\/[^?]*!A(\d+):I\1/.test(decodeURIComponent(url))){ // ledgerRowMatches read of one row
        var mm=decodeURIComponent(url).match(/!A(\d+):I\1/);var idx=(+mm[1])-2;return Jr(200,{values:LEDGER[idx]?[LEDGER[idx].slice(0,9)]:[]});}
      return Jr(200,{});
    };
    window.setYMFormula=function(){};window.writeMeta=async function(){return true;};window.loadAll=async function(){};window.loadGoals=function(){};window.closeOv=function(){};window.showAddedUndo=function(){};window.syncAfterWrite=async function(){};window.refreshLocal=function(){};window.syncDropdowns=async function(){};
    // engine + persisted views of monthly spending (Aug 2026), computed INDEPENDENTLY of each other
    function persistedExpense(){return Math.round(LEDGER.reduce(function(s,r){var cat=(""+(r[4]||"")).trim().toLowerCase();if(cat==="deposit"||/^vacation$/.test(cat))return s;var y=+r[0],m=+r[1];if(y===2026&&m===8)return s+(Number(r[6])||0);return s;},0)*100)/100;}
    function engineExpense(){return r2(monthActualTotals(2026,8).expense);}
    function seesValue(v){try{show('appScreen');}catch(e){}try{buildIndexes&&buildIndexes();applyBudgetSpend&&applyBudgetSpend();}catch(e){}try{renderCatTbl();}catch(e){}var el=document.getElementById('catTbl')||document.getElementById('appScreen')||document.body;var txt=(el.innerText||el.textContent||"");return txt.indexOf(money(v))>=0;} // the engine's number actually appears on the Budget/Month surface

    // fresh Nest
    state.rows=[];state.cats=[{name:'Groceries',mbud:600,mused:0,mspent:0,bud12:[600,600,600,600,600,600,600,600,600,600,600,600]}];state.cons=[];state.goals=[];state.assets=[];state.debts=[];
    state.meta={cats:{groceries:{type:'monthly',amount:600}},cons:{},goals:[],payees:['Me']};
    var Rz={};

    function expForm(o){['fAmount','fCategory','fDate','fCompany','fDesc'].forEach(function(id){var el=document.getElementById(id);if(el)el.value=(o[id]!=null?o[id]:'');});var fr=document.getElementById('fReimb');if(fr)fr.checked=false;var fc=document.getElementById('fCredit');if(fc)fc.checked=!!o.credit;try{if(typeof applyCreditUI==='function')applyCreditUI();}catch(e){}}
    window.askConfirm=async function(){return true;};window.hasDupExpense=function(){return false;};window.suggestCatFor=function(){return '';};window.companyMap=function(){return {};};

    // CHECKPOINT 1 — record a $184.72 grocery purchase at Costco
    expForm({fAmount:'184.72',fCategory:'Groceries',fDate:'2026-08-05',fCompany:'Costco'});
    await addEntry();
    Rz.grocery={persisted:persistedExpense(),engine:engineExpense(),sees:seesValue(184.72),rows:LEDGER.length};

    // CHECKPOINT 2 — they return $42.19 of it (a refund / credit)
    expForm({fAmount:'42.19',fCategory:'Groceries',fDate:'2026-08-06',fCompany:'Costco',credit:true});
    await addEntry();
    Rz.refund={persisted:persistedExpense(),engine:engineExpense(),sees:seesValue(142.53),rows:LEDGER.length}; // 184.72 − 42.19 = 142.53

    // CHECKPOINT 3 — create a residual vacation goal ($5,000 by next June, 20% of leftover, up to $800)
    ['gName','gTarget','gDate','gMonthly','gNote','gAccount','gCategory','gDebt','gResidualPct','gResidualCap','gStart'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('gName').value='Vacation';document.getElementById('gTarget').value='5000';document.getElementById('gDate').value='2027-06';
    document.getElementById('gResidualPct').value='20';document.getElementById('gResidualCap').value='800';var gr=document.getElementById('gResidual');if(gr)gr.checked=true;window.gEdit=null;
    await addGoal();
    var gv=(state.meta.goals||[]).filter(function(g){return g.name.toLowerCase()==='vacation';})[0]||{};
    Rz.goal={persistedInMeta:!!gv.name,residual:gv.residual===true,pct:gv.residualPct,cap:gv.residualCap,target:gv.target};

    // CHECKPOINT 4 — ask Wren what they spent on groceries this month; Wren must report the ENGINE's number, not its own
    var wrenTxt="";try{var _wr=wrenAnalyze("how much did I spend on groceries this month?");wrenTxt=(_wr&&(_wr.answer||_wr.text))?(_wr.answer||_wr.text):(""+_wr);}catch(e){wrenTxt="ERR:"+e.message;}
    Rz.wren={mentionsEngine:wrenTxt.indexOf(money(142.53))>=0,text:wrenTxt.slice(0,160)};

    // CHECKPOINT 5 — they mistyped the grocery; correct it from $184.72 to $200.00
    edIdx=0;state.rows[0]&&(state.rows[0]=state.rows[0].slice(0,9)); // the edit editor targets the first ledger row
    ['edAmount','edDate','edDesc'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('edAmount').value='200';document.getElementById('edDate').value='2026-08-05';
    var eco=document.getElementById('edCompany');if(eco)eco.value='Costco';
    var ec=document.getElementById('edCategory');if(ec){var has=false;for(var i=0;i<ec.options.length;i++)if(ec.options[i].value==='Groceries')has=true;if(!has){var op=document.createElement('option');op.value='Groceries';op.textContent='Groceries';ec.appendChild(op);}ec.value='Groceries';}
    var es=document.getElementById('edSave');if(es)es.disabled=false;window.closeEdit=function(){};
    await saveEdit();
    Rz.edit={persisted:persistedExpense(),engine:engineExpense(),sees:seesValue(157.81)}; // 200 − 42.19 = 157.81

    // CHECKPOINT 6 — "reload" from the persisted Sheet; nothing lost, nothing duplicated
    state.rows=LEDGER.map(function(r){return r.slice(0,9);}); // rebuild local state from what actually persisted
    Rz.reload={engine:engineExpense(),persisted:persistedExpense(),ledgerRows:LEDGER.length,
      groceryRows:LEDGER.filter(function(r){return (""+r[4]).toLowerCase()==='groceries'&&(Number(r[6])||0)>0;}).length};
    return Rz;
  });

  const near=(a,b)=>Math.abs(a-b)<0.005;
  ck('CP1 grocery: user sees = engine = persisted = $184.72', near(R.grocery.persisted,184.72)&&near(R.grocery.engine,184.72)&&R.grocery.sees&&R.grocery.rows===1, JSON.stringify(R.grocery));
  ck('CP2 refund nets against it: all three agree at $142.53', near(R.refund.persisted,142.53)&&near(R.refund.engine,142.53)&&R.refund.sees&&R.refund.rows===2, JSON.stringify(R.refund));
  ck('CP3 residual goal persisted with its 20% / $800 rule intact', R.goal.persistedInMeta&&R.goal.residual&&R.goal.pct===20&&R.goal.cap===800&&R.goal.target===5000, JSON.stringify(R.goal));
  ck('CP4 Wren reports the ENGINE number ($142.53), not one it invented', R.wren.mentionsEngine, JSON.stringify(R.wren));
  ck('CP5 correcting the amount to $200 updates engine AND persisted (net $157.81), and it shows', near(R.edit.persisted,157.81)&&near(R.edit.engine,157.81)&&R.edit.sees, JSON.stringify(R.edit));
  ck('CP6 reload from the Sheet: engine = persisted, exactly ONE grocery row (no loss, no duplicate)', near(R.reload.engine,157.81)&&near(R.reload.persisted,157.81)&&R.reload.ledgerRows===2&&R.reload.groceryRows===1, JSON.stringify(R.reload));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,4).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  ORACLE: at each checkpoint, what the user sees == what the engine computes == what persisted to the (simulated) Sheet.');
  console.log('  SCOPE: app logic end-to-end against a simulated backend. Not real OAuth/Drive, not real-device UX, not the human study (BETA_STUDY.md).');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

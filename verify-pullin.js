/* Verify "capture now, organize later": log with typed-in categories/sources (no budget), then pull them into the budget. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof ledgerUnbudgeted==='function'&&typeof applyPullIn==='function'&&typeof renderCatPicker==='function'&&typeof fillCons==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // ---------- detection + picker ----------
  const det=await page.evaluate(()=>{
    window.__realClaimRow=claimRow; // save the REAL claimRow before later blocks stub it (stubs persist across evaluates in one page)
    window.isGoalName=function(){return false;};window.catBills=function(){return [];};window.topCats=function(){return [];};
    window.money=function(n){return "$"+(Number(n)||0).toFixed(2);};
    window.budYear=2026; // pin the viewed budget year so year-scoped detection matches these 2026 rows
    state.cats=[{name:'Food'}];state.cons=[{name:'Paycheck'}];state.goals=[];state.meta={cats:{},cons:{},prefs:{}};
    state.rows=[
      [2026,8,'2026-08-01','Me','Food','Publix',50,'',''],      // budgeted cat
      [2026,8,'2026-08-02','Me','Pets','Chewy',30,'',''],       // ad-hoc cat
      [2026,7,'2026-07-02','Me','Pets','Vet',90,'',''],         // ad-hoc cat (2nd month)
      [2026,8,'2026-08-05','Paycheck','Deposit','',2000,'',''], // budgeted source
      [2026,8,'2026-08-06','Side Gig','Deposit','',200,'','']   // ad-hoc source
    ];
    var u=ledgerUnbudgeted();
    renderCatPicker('Groceries');var newBtn=document.querySelector('#catPickBody .pick-new');
    renderCatPicker('Food');var existBtn=document.querySelector('#catPickBody .pick-new');
    // ad-hoc "Pets" should be reusable in the picker even though it's not budgeted
    renderCatPicker('');var petsTile=[].some.call(document.querySelectorAll('#catPickBody .pick-cat'),function(e){return e.getAttribute('data-n')==='Pets';});
    return {cats:u.cats,sources:u.sources,newBtnText:newBtn?newBtn.textContent:null,existBtn:!!existBtn,petsTile:petsTile};
  });
  ck('unbudgeted category detected with monthly suggestion (Pets = 120/2 = 60)',
     det.cats.length===1&&det.cats[0].name==='Pets'&&det.cats[0].sugg===60, JSON.stringify(det.cats));
  ck('unbudgeted income source detected (Side Gig = 200)',
     det.sources.length===1&&det.sources[0].name==='Side Gig'&&det.sources[0].sugg===200, JSON.stringify(det.sources));
  ck('budgeted names (Food, Paycheck) are NOT flagged as unbudgeted',
     !det.cats.some(c=>c.name==='Food')&&!det.sources.some(s=>s.name==='Paycheck'), JSON.stringify(det));
  ck('picker offers "use typed name" for a brand-new category', /Groceries/.test(det.newBtnText||''), String(det.newBtnText));
  ck('picker does NOT offer create for an existing category', det.existBtn===false, String(det.existBtn));
  ck('a typed-in (ad-hoc) category is reusable in the picker before budgeting', det.petsTile===true, String(det.petsTile));

  // ---------- deposit source dropdown gets ledger sources + New source ----------
  const dep=await page.evaluate(()=>{
    fillPayeeSource();
    var opts=[].map.call(document.getElementById('dSource').options,function(o){return o.value;});
    return {opts:opts};
  });
  ck('deposit source dropdown includes ledger-used source + "＋ New source…"',
     dep.opts.indexOf('Side Gig')>=0&&dep.opts.indexOf('__new__')>=0&&dep.opts.indexOf('Paycheck')>=0, JSON.stringify(dep.opts));

  // ---------- applyPullIn creates budget lines ($0 default, suggestion when chip tapped) ----------
  const ap=await page.evaluate(async()=>{
    window.summaryName=function(){return "2026 Account Summary";};
    window.CAT_START=5;window.CAT_END=45;window.CON_START=50;window.CON_END=65;
    window.detectLayout=async function(){return true;};
    var claimed=[],nextCat=6,nextCon=51,writes=[],wroteMeta=false;
    window.claimRow=async function(sn,s,e,name,which){claimed.push({which:which,name:name});return which==='cat'?nextCat++:nextCon++;};
    window.vBatchUpdate=async function(d){Array.prototype.push.apply(writes,d);};
    window.writeMeta=async function(){wroteMeta=true;};
    window.loadAll=async function(){};window.renderAll=function(){};window.syncDropdowns=async function(){};
    // render then: check Pets' suggestion chip ON (use $60), leave Side Gig at $0
    renderPullIn();
    var petChk=[].find.call(document.querySelectorAll('#pullInBody .pin-row'),function(r){return r.querySelector('.pin-name').textContent==='Pets';});
    petChk.querySelector('.pin-sugg').classList.add('on'); // simulate tapping the suggestion
    await applyPullIn();
    // find the A-cell writes (the names) and an E-col (Jan budget) write for each
    function budOf(row){var w=writes.filter(function(x){return x.range.indexOf("!E"+row)>=0;})[0];return w?w.values[0][0]:null;}
    var catRow=claimed.filter(function(c){return c.which==='cat';})[0];
    var conRow=claimed.filter(function(c){return c.which==='con';})[0];
    return {claimed:claimed, wroteMeta:wroteMeta,
      metaPets:state.meta.cats['pets'], metaSide:state.meta.cons['side gig'],
      petsJan:budOf(6), sideJan:budOf(51)};
  });
  ck('applyPullIn claimed a category row for Pets and an income row for Side Gig',
     ap.claimed.some(c=>c.which==='cat'&&c.name==='Pets')&&ap.claimed.some(c=>c.which==='con'&&c.name==='Side Gig'), JSON.stringify(ap.claimed));
  ck('Pets added WITH its tapped suggestion ($60/mo)', ap.petsJan===60&&ap.metaPets&&ap.metaPets.amount===60, JSON.stringify({petsJan:ap.petsJan,meta:ap.metaPets}));
  ck('Side Gig added UNBUDGETED ($0, suggestion not tapped)', ap.sideJan===0&&ap.metaSide&&ap.metaSide.amount===0, JSON.stringify({sideJan:ap.sideJan,meta:ap.metaSide}));
  ck('meta persisted', ap.wroteMeta===true, String(ap.wroteMeta));

  // ---------- year-dependent detection + budget-tab-only banner ----------
  const yr=await page.evaluate(()=>{
    window.isGoalName=function(){return false;};window.catBills=function(){return [];};
    window.pullInCount=window.pullInCount; // keep
    state.cats=[];state.cons=[];state.meta={cats:{},cons:{},prefs:{}};
    state.rows=[
      [2026,8,'2026-08-02','Me','Pets','Chewy',30,'',''],       // 2026 only
      [2027,3,'2027-03-02','Me','Travel','Delta',400,'',''],    // 2027 only
      [2027,4,'2027-04-05','Side Gig','Deposit','',200,'','']    // 2027 source
    ];
    window.budYear=2027; // viewing the 2027 budget
    var u2027=ledgerUnbudgeted();
    window.budYear=2026;
    var u2026=ledgerUnbudgeted();
    window.budYear=2027;
    // banner should ONLY appear on the Budget tab
    document.getElementById('appScreen').classList.add('on');
    var eb=document.getElementById('pullInBar');if(eb)eb.remove();
    document.body.setAttribute('data-view','month'); maybeOfferPullIn(); var onMonth=!!document.getElementById('pullInBar');
    document.body.setAttribute('data-view','budget'); maybeOfferPullIn(); var onBudget=!!document.getElementById('pullInBar');
    // dismiss on 2027, confirm 2026 can still remind
    document.getElementById('pullX').click(); maybeOfferPullIn(); var afterDismiss2027=!!document.getElementById('pullInBar');
    window.budYear=2026; maybeOfferPullIn(); var stillRemind2026=!!document.getElementById('pullInBar');
    var bb=document.getElementById('pullInBar');if(bb)bb.remove();
    return {c2027:u2027.cats.map(c=>c.name), s2027:u2027.sources.map(s=>s.name), c2026:u2026.cats.map(c=>c.name),
            onMonth,onBudget,afterDismiss2027,stillRemind2026};
  });
  ck('viewing 2027: only 2027 names are unbudgeted (Travel + Side Gig, NOT 2026 Pets)',
     yr.c2027.join(',')==='Travel'&&yr.s2027.join(',')==='Side Gig'&&yr.c2027.indexOf('Pets')<0, JSON.stringify(yr));
  ck('viewing 2026: only 2026 names are unbudgeted (Pets, NOT 2027 Travel)',
     yr.c2026.join(',')==='Pets', JSON.stringify(yr.c2026));
  ck('banner does NOT show on a non-Budget tab', yr.onMonth===false, String(yr.onMonth));
  ck('banner shows on the Budget tab', yr.onBudget===true, String(yr.onBudget));
  ck('dismiss is per-year: dismissing 2027 hides it, but 2026 still reminds', yr.afterDismiss2027===false&&yr.stillRemind2026===true, JSON.stringify({d:yr.afterDismiss2027,r:yr.stillRemind2026}));

  // ---------- itemized bills aren't duplicated under "All" ----------
  const decl=await page.evaluate(()=>{
    window.isGoalName=function(){return false;};window.topCats=function(){return [];};window.money=function(n){return "$"+(Number(n)||0).toFixed(2);};window.budYear=2026;
    state.meta={cats:{subscriptions:{type:'itemized',items:[{name:'Netflix'},{name:'Prime'}]}},cons:{},prefs:{}};
    window.catCfg=function(name){return state.meta.cats[(""+name).toLowerCase()]||null;};
    window.catBills=function(name){var c=state.meta.cats[(""+name).toLowerCase()];return (c&&c.items)?c.items.map(function(i){return i.name;}):[];};
    state.cats=[{name:'Groceries'},{name:'Subscriptions'}];state.cons=[];state.goals=[];
    state.rows=[[2026,8,'2026-08-01','Me','Netflix','',15,'','']]; // a row tagged directly with the bill name
    renderCatPicker('');
    return {
      allTiles:[].map.call(document.querySelectorAll('#catPickBody .pick-cat'),function(e){return e.getAttribute('data-n');}),
      billTiles:[].map.call(document.querySelectorAll('#catPickBody .pick-bill'),function(e){return e.getAttribute('data-b');})
    };
  });
  ck('itemized bill (Netflix) is NOT duplicated under "All"', decl.allTiles.indexOf('Netflix')<0, JSON.stringify(decl.allTiles));
  ck('itemized bill (Netflix) still appears in its bills section', decl.billTiles.indexOf('Netflix')>=0, JSON.stringify(decl.billTiles));
  ck('a normal category (Groceries) is still listed under "All"', decl.allTiles.indexOf('Groceries')>=0, JSON.stringify(decl.allTiles));

  // ---------- FAILURE PATH: a pick that can't be reserved must SURFACE an error, keep the overlay open, and fake nothing ----------
  const fp=await page.evaluate(async()=>{
    window.summaryName=function(){return "2026 Account Summary";};
    window.CAT_START=5;window.CAT_END=45;window.CON_START=50;window.CON_END=65;
    window.detectLayout=async function(){return true;};
    window.vBatchUpdate=async function(){};window.writeMeta=async function(){};window.loadAll=async function(){};window.renderAll=function(){};window.syncDropdowns=async function(){};
    window.isGoalName=function(){return false;};window.catBills=function(){return [];};window.money=function(n){return "$"+(Number(n)||0).toFixed(2);};window.budYear=2026;
    window.claimRow=async function(){return 0;}; // couldn't reserve a spot (fail-closed verification read, or section full & couldn't grow)
    state.cats=[];state.cons=[];state.meta={cats:{},cons:{},prefs:{}};
    state.rows=[[2026,8,'2026-08-02','Me','Pets','Chewy',30,'','']];
    renderPullIn();
    document.getElementById('pullInOv').style.display='flex'; // overlay open
    await applyPullIn();
    var msg=document.getElementById('pullInMsg');
    return {msgText:(msg?msg.textContent:''),msgBad:(msg?/\bbad\b/.test(msg.className):false),
      ovOpen:document.getElementById('pullInOv').style.display!=='none',
      metaEmpty:Object.keys(state.meta.cats).length===0,btnReset:document.getElementById('pullInApply').textContent==='Add to budget'};
  });
  ck('a pick that can’t be reserved surfaces an error (no silent no-op)', /Couldn’t add|Couldn't add/.test(fp.msgText)&&fp.msgBad===true, JSON.stringify(fp));
  ck('on failure nothing is written to meta and the overlay stays open to retry', fp.metaEmpty===true&&fp.ovOpen===true&&fp.btnReset===true, JSON.stringify(fp));

  // ---------- SANITIZE TABLE: EVERY formula-leading character (= + - @ and leading tab/CR, which can arrive via paste) must be
  // written SAFELY so claimRow's read-back verifies and the row IS claimed. Ordinary names must pass through UNCHANGED (no
  // over-escaping). Category naming is held to the same boundary rule as ledger sanitation. Drives the REAL claimRow. ----------
  const sanTable=await page.evaluate(async()=>{
    var names=["=Rent","+Rent","-Rent","@Rent","\tRent","\rRent","Rent","Café ⚡","1099 income"];
    var res=[];
    for(var k=0;k<names.length;k++){
      var nm=names[k],written=null;
      window.vBatchUpdate=async function(d){if(d&&d[0]&&/!A\d+$/.test(d[0].range))written=d[0].values[0][0];};
      window.vgetU=async function(range){var m=String(range).match(/!A(\d+)$/); // single-cell read-back: Sheets stores/returns the text WITHOUT the leading apostrophe
        if(m)return {values:[[written==null?'':String(written).replace(/^'/,'')]]};
        return {values:[]};}; // the A{start}:A{end} scan → all rows free
      var row=await window.__realClaimRow("2026 Account Summary",5,45,nm,"cat"); // the REAL claimRow (earlier blocks stubbed window.claimRow)
      res.push({name:nm,row:row,written:written});
    }
    return res;
  });
  var _lead=/^[=+\-@\t\r]/;
  sanTable.forEach(function(rr){
    var esc=_lead.test(rr.name),label=JSON.stringify(rr.name);
    ck('claimRow writes '+label+' safely and the row IS claimed'+(esc?' (escaped)':' (unchanged — no over-escaping)'),
       rr.row>=5 && rr.written===(esc?("'"+rr.name):rr.name), JSON.stringify(rr));
  });

  // ---------- PULL-RECOVERY-001: partial commit. claimRow writes the NAME (column A) and verifies it; if the following
  // budget-values write fails, the name is already on the sheet. On retry, applyPullIn must RECOVER that existing row and
  // finish initializing it — exactly ONE category, correctly budgeted, never a duplicate. Driven against a store-backed sheet. ----------
  const rec=await page.evaluate(async()=>{
    window.summaryName=function(){return "2026 Account Summary";};
    window.CAT_START=5;window.CAT_END=45;window.CON_START=50;window.CON_END=65;
    window.detectLayout=async function(){return true;};
    window.writeMeta=async function(){};window.loadAll=async function(){};window.renderAll=function(){};window.syncDropdowns=async function(){};
    window.isGoalName=function(){return false;};window.catBills=function(){return [];};window.money=function(n){return "$"+(Number(n)||0).toFixed(2);};window.budYear=2026;window.topCats=function(){return [];};
    window.claimRow=window.__realClaimRow; // earlier blocks stubbed window.claimRow — restore the REAL one so it claims against the store-backed mock
    var A={},E={},failBudgetOnce=true; // simulated summary sheet: column A (names), column E (Jan budget); first budget write fails
    window.vgetU=async function(range){range=String(range);
      var ms=range.match(/!A(\d+):A(\d+)$/);if(ms){var s=+ms[1],e=+ms[2],v=[];for(var r=s;r<=e;r++)v.push([A[r]!=null?A[r]:'']);return {values:v};}
      var m1=range.match(/!A(\d+)$/);if(m1){var rr=+m1[1];return {values:[[A[rr]!=null?A[rr]:'']]};}
      return {values:[]};};
    window.vBatchUpdate=async function(data){
      var hasBudget=data.some(function(d){return /!E\d+$/.test(d.range);});
      if(hasBudget&&failBudgetOnce){failBudgetOnce=false;throw new Error("network dropped writing budget values");} // fail the FIRST budget-values write, after claimRow already committed the name
      data.forEach(function(d){var ma=d.range.match(/!A(\d+)$/);if(ma)A[+ma[1]]=d.values[0][0];var me=d.range.match(/!E(\d+)$/);if(me)E[+me[1]]=d.values[0][0];});};
    state.cats=[];state.cons=[];state.meta={cats:{},cons:{},prefs:{}};
    state.rows=[[2026,8,'2026-08-02','Me','Pets','Chewy',60,'','']];
    // FIRST attempt — tap the suggestion, apply → the budget write fails after the name was claimed
    renderPullIn();
    var pr=[].find.call(document.querySelectorAll('#pullInBody .pin-row'),function(r){return r.querySelector('.pin-name').textContent==='Pets';});
    var suggAmt=Number(pr.querySelector('.pin-sugg').getAttribute('data-amt'))||0;pr.querySelector('.pin-sugg').classList.add('on');
    document.getElementById('pullInOv').style.display='flex';
    await applyPullIn();
    var firstMsgEl=document.getElementById('pullInMsg'),firstMsgBad=(/\bbad\b/.test(firstMsgEl.className)&&!!firstMsgEl.textContent),firstMeta=!!state.meta.cats['pets'],nameOnSheetAfterFail=Object.keys(A).filter(function(k){return (""+A[k]).toLowerCase()==='pets';}).length;
    // SECOND attempt (retry) — must recover the existing row, not claim a new one
    renderPullIn();
    var pr2=[].find.call(document.querySelectorAll('#pullInBody .pin-row'),function(r){return r.querySelector('.pin-name').textContent==='Pets';});
    if(pr2&&pr2.querySelector('.pin-sugg'))pr2.querySelector('.pin-sugg').classList.add('on');
    await applyPullIn();
    var petsRows=Object.keys(A).filter(function(k){return (""+A[k]).toLowerCase()==='pets';});
    return {suggAmt:suggAmt,firstMsgBad:firstMsgBad,firstMeta:firstMeta,nameOnSheetAfterFail:nameOnSheetAfterFail,
      petsRowCount:petsRows.length,petsBudget:E[petsRows[0]],metaPets:state.meta.cats['pets']||null};
  });
  ck('PULL-RECOVERY-001: first attempt fails loudly (name committed, but error shown and meta NOT faked)', rec.firstMsgBad===true&&rec.firstMeta===false&&rec.nameOnSheetAfterFail===1, JSON.stringify(rec));
  ck('PULL-RECOVERY-001: after retry, EXACTLY ONE Pets row exists (recovered, not duplicated)', rec.petsRowCount===1, JSON.stringify(rec));
  ck('PULL-RECOVERY-001: the recovered row is correctly initialized to the requested budget + meta set', rec.suggAmt>0&&rec.petsBudget===rec.suggAmt&&rec.metaPets&&rec.metaPets.amount===rec.suggAmt, JSON.stringify(rec));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

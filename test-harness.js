/* NestWorth end-to-end integration harness.
 * Runs the REAL app.html in headless Chromium against an in-memory fake Google Sheets/Drive backend,
 * with stubbed Google auth, and drives full user flows — catching runtime/wiring bugs static analysis can't.
 *
 * Usage: node test-harness.js [--seed=fresh|current|legacy|tenyear]
 */
const {chromium}=require('playwright');
const http=require('http');
const fs=require('fs');
const path=require('path');

const APP=path.join(__dirname,'app.html');
const SEED=(process.argv.find(a=>a.startsWith('--seed='))||'--seed=fresh').split('=')[1];

// ---------- A1 helpers ----------
function colToNum(s){var n=0;for(var i=0;i<s.length;i++)n=n*26+(s.charCodeAt(i)-64);return n-1;}
function parseA1(range){
  var sheet=null,rest=range;
  var bang=range.lastIndexOf('!');
  if(bang>=0){sheet=range.slice(0,bang).replace(/^'|'$/g,'').replace(/''/g,"'");rest=range.slice(bang+1);}
  var m=rest.match(/^([A-Z]+)?(\d+)?(?::([A-Z]+)?(\d+)?)?$/);
  if(!m)return {sheet:sheet,c1:0,r1:1,c2:Infinity,r2:Infinity};
  var c1=m[1]?colToNum(m[1]):0, r1=m[2]?+m[2]:1;
  var c2=m[3]?colToNum(m[3]):(m[4]||!m[3]?Infinity:c1), r2=m[4]?+m[4]:Infinity;
  if(!m[3]&&!m[4]&&(m[1]||m[2])){ // single cell A1 or partial
    if(m[1]&&m[2]){c2=c1;r2=r1;}
  }
  return {sheet:sheet,c1:c1,r1:r1,c2:(c2==null?Infinity:c2),r2:(r2==null?Infinity:r2)};
}

// ---------- Fake spreadsheet backend ----------
let nextSheetId=1;
function mkSheet(title,opts){opts=opts||{};return {properties:{title:title,sheetId:nextSheetId++,index:opts.index||0,hidden:!!opts.hidden,gridProperties:{rowCount:opts.rows||1000,columnCount:opts.cols||28}},_data:[]};}
function getSheet(ss,title){return ss.sheets.find(s=>s.properties.title===title);}
function lastDataRow(sh){for(var i=sh._data.length-1;i>=0;i--){var r=sh._data[i];if(r&&r.some(c=>c!=null&&c!==''))return i+1;}return 0;}
function readRange(ss,range){
  var p=parseA1(range);var sh=getSheet(ss,p.sheet);if(!sh)throw {status:400,msg:"Unable to parse range: "+range};
  var last=lastDataRow(sh);var r2=Math.min(p.r2,last);var out=[];
  for(var r=p.r1;r<=r2;r++){var row=sh._data[r-1]||[];var c2=(p.c2===Infinity)?(row.length-1):p.c2;var slice=[];for(var c=p.c1;c<=c2;c++)slice.push(row[c]==null?"":row[c]);
    while(slice.length&&(slice[slice.length-1]===""||slice[slice.length-1]==null))slice.pop();
    out.push(slice);}
  while(out.length&&out[out.length-1].length===0)out.pop();
  return out;
}
function writeRange(ss,range,values){
  var p=parseA1(range);var sh=getSheet(ss,p.sheet);if(!sh)throw {status:400,msg:"Unable to parse range: "+range};
  for(var i=0;i<values.length;i++){var r=p.r1-1+i;sh._data[r]=sh._data[r]||[];for(var j=0;j<values[i].length;j++){sh._data[r][p.c1+j]=values[i][j];}}
}
function clearRange(ss,range){
  var p=parseA1(range);var sh=getSheet(ss,p.sheet);if(!sh)return;var last=lastDataRow(sh);var r2=Math.min(p.r2,last);
  for(var r=p.r1;r<=r2;r++){var row=sh._data[r-1];if(!row)continue;var c2=(p.c2===Infinity)?(row.length-1):p.c2;for(var c=p.c1;c<=c2;c++)row[c]="";}
}
function appendRange(ss,range,values){
  var p=parseA1(range);var sh=getSheet(ss,p.sheet);if(!sh)throw {status:400,msg:"Unable to parse range: "+range};
  var start=lastDataRow(sh);// append after last data row
  for(var i=0;i<values.length;i++){var r=start+i;sh._data[r]=sh._data[r]||[];for(var j=0;j<values[i].length;j++)sh._data[r][p.c1+j]=values[i][j];}
  var endRow=start+values.length;var col=String.fromCharCode(65+p.c1);
  return {updates:{updatedRange:"'"+p.sheet+"'!"+col+(start+1)+":I"+endRow,updatedRows:values.length}};
}
function structural(ss,requests){
  var replies=[];
  (requests||[]).forEach(function(req){
    if(req.addSheet){var props=req.addSheet.properties||{};var s=mkSheet(props.title,{hidden:props.hidden,rows:(props.gridProperties&&props.gridProperties.rowCount),cols:(props.gridProperties&&props.gridProperties.columnCount)});s.properties.index=ss.sheets.length;ss.sheets.push(s);replies.push({addSheet:{properties:s.properties}});}
    else if(req.duplicateSheet){var src=ss.sheets.find(x=>x.properties.sheetId===req.duplicateSheet.sourceSheetId);var ns=mkSheet(req.duplicateSheet.newSheetName,{});ns._data=JSON.parse(JSON.stringify(src?src._data:[]));ns.properties.index=req.duplicateSheet.insertSheetIndex||ss.sheets.length;ss.sheets.push(ns);replies.push({duplicateSheet:{properties:ns.properties}});}
    else if(req.deleteDimension){var d=req.deleteDimension.range;var sh=ss.sheets.find(x=>x.properties.sheetId===d.sheetId);if(sh&&d.dimension==="ROWS"){sh._data.splice(d.startIndex,d.endIndex-d.startIndex);}replies.push({});}
    else if(req.insertDimension){var ir=req.insertDimension.range;var ish=ss.sheets.find(x=>x.properties.sheetId===ir.sheetId);if(ish&&ir.dimension==="ROWS"){var blanks=[];for(var bi=0;bi<(ir.endIndex-ir.startIndex);bi++)blanks.push([]);Array.prototype.splice.apply(ish._data,[ir.startIndex,0].concat(blanks));}replies.push({});}
    else if(req.copyPaste){replies.push({});} // formatting/formula copy — no-op in the mock (we store values, not formulas)
    else {replies.push({});} // updateSheetProperties, repeatCell, updateCells, etc. — accept as no-ops
  });
  return {replies:replies};
}

// ---------- Seeds ----------
const CUR_YEAR=new Date().getFullYear();
function budgetTabs(){
  var tabs=[mkSheet("Account Ledger",{cols:9})];
  tabs[0]._data[0]=["Year","Month","Date","Payee","Category","Company","Amount","Description","Reimbursed"];
  var sum=mkSheet(CUR_YEAR+" Account Summary",{cols:28});
  sum._data[1]=[]; sum._data[1][1]=CUR_YEAR; // B2 = year
  tabs.push(sum);
  var nw=mkSheet("Net Worth",{cols:3});tabs.push(nw);
  var meta=mkSheet("NestWorth Meta",{hidden:true,cols:2});meta._data[0]=["NestWorth budget settings"];tabs.push(meta);
  var hist=mkSheet("NW History",{hidden:true,cols:6});hist._data[0]=["Month","Net worth","Assets","Debts","As of","Detail"];tabs.push(hist);
  tabs.forEach((t,i)=>t.properties.index=i);
  return tabs;
}
function seedFresh(){return {id:"ss-budget-1",name:"NestWorth Budget",sheets:budgetTabs()};}
function seedCurrent(){
  var ss=seedFresh();var sum=getSheet(ss,CUR_YEAR+" Account Summary");
  // 2 monthly categories at rows 5,6
  sum._data[4]=["Groceries",6000,0]; for(var m=0;m<12;m++)sum._data[4][4+m*2]=500;
  sum._data[5]=["Rent",18000,0]; for(var m2=0;m2<12;m2++)sum._data[5][4+m2*2]=1500;
  // income at row 39
  sum._data[38]=["Salary",72000,0]; for(var m3=0;m3<12;m3++)sum._data[38][4+m3*2]=6000;
  var meta=getSheet(ss,"NestWorth Meta");
  meta._data[1]=[JSON.stringify({cats:{groceries:{type:"monthly",amount:500},rent:{type:"monthly",amount:1500}},cons:{salary:{type:"paycheck",freq:26,mode:"pct",pct:100,amount:2769}},goals:[{name:"Vacation",target:5000,monthly:200,startBal:500}],startCash:2000,startYM:CUR_YEAR*100+1,payees:["Me"],nwUpdated:""})];
  // a few ledger rows
  var led=getSheet(ss,"Account Ledger");
  led._data[1]=[CUR_YEAR,8,CUR_YEAR+"-08-01","Me","Groceries","Publix",120,"weekly",""];
  led._data[2]=[CUR_YEAR,8,CUR_YEAR+"-08-02","Boss","Deposit","Salary",3000,"",""];
  led._data[3]=[CUR_YEAR,8,CUR_YEAR+"-08-03","","Vacation","Vacation",200,"Goal contribution",""];
  var nw=getSheet(ss,"Net Worth");nw._data[3]=["Checking",5000];nw._data[26]=["Visa",1200];
  return ss;
}
// LEGACY: sheet from an OLD build — meta missing startYM/debt, no reimbursed column awareness, goals without new fields.
function seedLegacy(){
  var ss=seedFresh();var sum=getSheet(ss,CUR_YEAR+" Account Summary");
  sum._data[4]=["Groceries",6000,0]; for(var m=0;m<12;m++)sum._data[4][4+m*2]=500;
  sum._data[5]=["Insurance",1200,0]; sum._data[5][4]=0; for(var mm=0;mm<12;mm++)sum._data[5][4+mm*2]=(mm===11?1200:0); // annual in Dec (old one-time style)
  var meta=getSheet(ss,"NestWorth Meta");
  // OLD-SHAPE meta: no startYM, no goal.debt, goals as objects but minimal, cats with only type+amount, an extra unknown field
  meta._data[1]=[JSON.stringify({cats:{groceries:{type:"monthly",amount:500},insurance:{type:"annual",month:12,amount:1200}},cons:{},goals:[{name:"Car",target:20000,monthly:300}],startCash:1000})];
  // ledger WITHOUT the 9th (reimbursed) column on some rows, dates as ISO
  var led=getSheet(ss,"Account Ledger");
  led._data[1]=[CUR_YEAR-1,3,(CUR_YEAR-1)+"-03-15","","Groceries","OldStore",88]; // 7 cols only
  led._data[2]=[CUR_YEAR,8,CUR_YEAR+"-08-01","","Insurance","Geico",1200,"annual"]; // 8 cols
  return ss;
}
function seedTenYear(){
  var ss=seedCurrent();var led=getSheet(ss,"Account Ledger");var y0=CUR_YEAR-9;var row=led._data.length;
  var cats=["Groceries","Rent","Gas","Dining","Utilities"];
  for(var y=y0;y<=CUR_YEAR;y++){for(var mo=1;mo<=12;mo++){for(var k=0;k<22;k++){ // ~22/month → ~2600 rows over 10 years (realistic)
    var c=cats[(mo+k)%cats.length];var amt=20+((mo*7+k*13)%180);
    led._data[row++]=[y,mo,y+"-"+String(mo).padStart(2,'0')+"-"+String(((k%27)+1)).padStart(2,'0'),"",c,"Merch"+(k%9),amt,"",""];
  }}}
  // create prior-year summary tabs so carry-in batchGet has something
  for(var yy=y0;yy<CUR_YEAR;yy++){var s=mkSheet(yy+" Account Summary",{cols:28});s._data[1]=[];s._data[1][1]=yy;s._data[4]=["Groceries",6000,0];for(var mm2=0;mm2<12;mm2++)s._data[4][4+mm2*2]=500;s.properties.index=ss.sheets.length;ss.sheets.push(s);}
  ss._tenYearRows=row-1;
  return ss;
}
function makeSeed(){
  if(SEED==="current")return seedCurrent();
  if(SEED==="legacy")return seedLegacy();
  if(SEED==="tenyear")return seedTenYear();
  return seedFresh();
}
const SS=makeSeed();
const DRIVE_FILES=[{id:SS.id,name:SS.name,mimeType:"application/vnd.google-apps.spreadsheet"}];

// ---------- REST router ----------
let apiCalls=0;
function handle(method,urlStr,body){
  apiCalls++;
  var u=new URL(urlStr);var p=u.pathname;
  // Drive about
  if(p.endsWith("/drive/v3/about"))return {user:{emailAddress:"tester@example.com"}};
  // Drive files list
  if(/\/drive\/v3\/files$/.test(p)&&method==="GET"){var q=u.searchParams.get("q")||"";
    if(/mimeType.*folder/.test(q)||/in parents/.test(q))return {files:[]}; // no folder / folder empty
    // name search for spreadsheet
    var files=DRIVE_FILES.filter(f=>q.indexOf(f.name)>=0||!/name=/.test(q));
    return {files:files.map(f=>({id:f.id,name:f.name,mimeType:f.mimeType}))};
  }
  if(/\/drive\/v3\/files$/.test(p)&&method==="POST")return {id:"file-"+(nextSheetId++)}; // folder/shortcut create
  var fm=p.match(/\/drive\/v3\/files\/([^/]+)$/);
  if(fm&&method==="GET")return {id:fm[1],name:SS.name};
  if(fm&&method==="PATCH")return {id:fm[1]};
  if(/permissions/.test(p))return {id:"perm-1"};
  // Sheets
  var sm=p.match(/\/v4\/spreadsheets\/([^/:]+)/);
  if(sm){
    // NOTE: values:batchUpdate must be matched BEFORE the structural {id}:batchUpdate (both end in ":batchUpdate").
    if(/\/values:batchGet$/.test(p)){var ranges=u.searchParams.getAll("ranges");return {valueRanges:ranges.map(r=>({range:r,values:readRange(SS,r)}))};}
    if(/\/values:batchUpdate$/.test(p)){((body&&body.data)||[]).forEach(d=>{writeRange(SS,d.range,d.values);});return {totalUpdatedCells:1};}
    if(/\/values:batchClear$/.test(p)){((body&&body.ranges)||[]).forEach(r=>clearRange(SS,r));return {};}
    var am=p.match(/\/values\/(.+):append$/);if(am)return appendRange(SS,decodeURIComponent(am[1]),body.values);
    var vm=p.match(/\/values\/(.+)$/);if(vm&&method==="GET"){var rng=decodeURIComponent(vm[1]);return {values:readRange(SS,rng)};}
    if(/:batchUpdate$/.test(p))return structural(SS,(body&&body.requests)||[]); // structural (addSheet/duplicate/deleteDimension) — LAST
    if(method==="GET")return {spreadsheetId:sm[1],sheets:SS.sheets.map(s=>({properties:s.properties}))};
  }
  return {};
}

// ---------- static server ----------
const server=http.createServer((req,res)=>{
  if(req.url.startsWith("/app.html")){res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync(APP,'utf8'));return;}
  res.writeHead(200,{'Content-Type':'text/plain'});res.end(""); // template/icon/manifest -> empty ok
});

(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  page.on('console',m=>{if(m.type()==='error'){var t=m.text();if(!/ERR_|Failed to load resource|net::/.test(t))errs.push('CONSOLE: '+t);}});

  // Stub Google auth + gapi/picker BEFORE app scripts run
  await page.addInitScript(()=>{
    window.google={accounts:{oauth2:{initTokenClient:function(cfg){return {requestAccessToken:function(){setTimeout(function(){cfg.callback({access_token:'fake-token-123'});},0);}};},revoke:function(t,cb){cb&&cb();}},id:{disableAutoSelect:function(){}}},picker:{}};
    window.gapi={load:function(_,o){(o&&o.callback)&&o.callback();}};
  });
  // Route all network: googleapis -> mock, google scripts/fonts -> empty, our server -> passthrough
  await page.route('**/*',async route=>{
    const req=route.request();const url=req.url();
    if(url.includes('127.0.0.1')||url.includes('localhost')){return route.continue();}
    if(url.includes('googleapis.com')||url.includes('google.com/drive')){
      let body=null;try{const pd=req.postData();if(pd)body=JSON.parse(pd);}catch(e){}
      try{const out=handle(req.method(),url,body);route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(out)});}
      catch(e){route.fulfill({status:(e&&e.status)||500,contentType:'application/json',body:JSON.stringify({error:{message:(e&&e.msg)||String(e)}})});}
      return;
    }
    // gsi client, apis.google.com, fonts, anything else external -> benign empty
    const ct=url.endsWith('.css')?'text/css':'application/javascript';
    return route.fulfill({status:200,contentType:ct,body:''});
  });

  const results=[];
  function check(name,ok,detail){results.push({name,ok,detail:detail||''});}

  const t0=Date.now();
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  // wait for app to enter (appScreen visible) or signin
  let entered=false;
  try{await page.waitForFunction(()=>document.getElementById('appScreen')&&document.getElementById('appScreen').classList.contains('on'),{timeout:15000});entered=true;}catch(e){}
  // wait for loadAll to finish (cats populated, or a done flag / timeout)
  await page.waitForFunction(()=>Array.isArray(state.cats)&&(state.cats.length>0||state.rows.length>0||Date.now()),{timeout:6000}).catch(()=>{});
  await page.waitForTimeout(400);
  const loadMs=Date.now()-t0;
  check('App reaches main screen (auth+load)',entered,entered?('load '+loadMs+'ms'):'stuck on splash/signin; errs='+errs.slice(0,3).join(' | '));

  if(entered){
    // override confirm dialogs for driving: accept normally, but answer "Delete/Save anyway" (false) to any "Reload?" prompt
    await page.evaluate(()=>{window.askConfirm=async(o)=>{try{if(o&&o.ok==="Reload")return false;}catch(e){}return true;};window.askInfo=async()=>true;});
    // wait for loadAll to finish populating
    await page.waitForFunction(()=>Array.isArray(state.cats)&&(state.cats.length>0||state._loadDone),{timeout:4000}).catch(()=>{});

    // ---- Flow: state loaded ----
    const st=await page.evaluate(()=>({cats:state.cats.length,cons:state.cons.length,goals:(state.goals||[]).length,rows:state.rows.length,ledgerOk:state._ledgerOk,goalNames:(state.goals||[]).map(g=>g.name),catNames:state.cats.map(c=>c.name)}));
    check('loadAll populated state',st.ledgerOk!==false,JSON.stringify({cats:st.cats,cons:st.cons,goals:st.goals,rows:st.rows}));
    const hasCats=st.cats>0;

    // ---- UPGRADE AUDIT (legacy seed): old-format sheet must load & coerce cleanly ----
    if(SEED==='legacy'){
      check('legacy: categories read from old sheet',st.cats>=2,'cats='+JSON.stringify(st.catNames));
      check('legacy: goal without new fields loads',st.goalNames.indexOf('Car')>=0,'goals='+JSON.stringify(st.goalNames));
      const leg=await page.evaluate(()=>{
        var car=(state.goals||[]).filter(g=>g.name==='Car')[0];
        var ins=(state.meta.cats||{})['insurance'];
        return {carDebt:car?car.debt:'MISSING',carResidual:car?car.residual:null,carBalOk:car?(typeof car.balance==='number'):false,
          startYM:state.meta.startYM, adoption:(typeof adoptionYM==='function'?adoptionYM():'?'),
          insuranceType:ins?ins.type:'MISSING', rows:state.rows.length,
          shortRowRead:(state.rows||[]).some(r=>String(r[4]).toLowerCase()==='groceries')};
      });
      check('legacy: goal.debt coerced to "" (not undefined)',leg.carDebt==='','carDebt='+JSON.stringify(leg.carDebt));
      check('legacy: goal.balance computed (number)',leg.carBalOk===true,'');
      check('legacy: startYM missing → coerced to 0',leg.startYM===0,'startYM='+leg.startYM);
      check('legacy: adoption inferred from data',typeof leg.adoption==='number'&&leg.adoption>0,'adoption='+leg.adoption);
      check('legacy: annual/one-time category type preserved',leg.insuranceType==='annual','type='+leg.insuranceType);
      check('legacy: short-column ledger row read',leg.shortRowRead===true,'rows='+leg.rows);
      // editing an old-format category shouldn't crash
      const legEdit=await page.evaluate(async()=>{try{openCatEdit('Groceries');document.getElementById('cAmt').value='550';await addCat();return {ok:true,cats:state.cats.length};}catch(e){return {ok:false,err:e.message};}});
      check('legacy: editing an old category works',legEdit.ok===true,JSON.stringify(legEdit));
    }

    // ---- Flow: switch every view without error ----
    for(const v of ['add','month','budget','goals','worth','settings']){
      const before=errs.length;
      await page.evaluate(view=>switchView(view),v);
      await page.waitForTimeout(60);
      check('render view: '+v,errs.length===before,errs.slice(before).join(' | '));
    }

    if(!hasCats){ check('(seed has no categories — skipping mutation flows)',true,'seed='+SEED); }
    if(hasCats){
    // ---- Flow: log an expense (incremental cache path) ----
    const r0=await page.evaluate(()=>state.rows.length);
    await page.evaluate(async()=>{
      switchView('add');setMode('expense');
      const cat=(state.cats[0]&&state.cats[0].name)||'';
      document.getElementById('fCategory').value=cat;document.getElementById('fAmount').value='42.50';
      document.getElementById('fDate').value=(new Date()).toISOString().slice(0,10);
      document.getElementById('fCompany').value='TestCo';
      await addEntry();
    });
    const r1=await page.evaluate(()=>state.rows.length);
    check('addEntry appended a row (incremental)',r1===r0+1,'rows '+r0+'->'+r1);

    // ---- Flow: category credit (negative row nets down spend) ----
    const spentBefore=await page.evaluate(()=>{var c=state.cats[0];return c?c.mspent:null;});
    await page.evaluate(async()=>{
      switchView('add');setMode('expense');
      document.getElementById('fCategory').value=state.cats[0].name;document.getElementById('fAmount').value='10';
      document.getElementById('fDate').value=(new Date()).toISOString().slice(0,10);
      if(document.getElementById('fCredit')){document.getElementById('fCredit').checked=true;}
      await addEntry();
    });
    const spentAfter=await page.evaluate(()=>state.cats[0].mspent);
    check('credit reduces category spent',spentAfter!=null&&spentBefore!=null&&spentAfter<=spentBefore+0.001,'spent '+spentBefore+'->'+spentAfter);

    // ---- Flow: edit the most recent ledger row ----
    const editRes=await page.evaluate(async()=>{
      var idx=state.rows.length-1;openEdit(idx);
      document.getElementById('edAmount').value='99.99';
      await saveEdit();
      return {amt:Number(state.rows[idx]&&state.rows[idx][6])};
    });
    check('saveEdit updated the row',Math.abs(Math.abs(editRes.amt)-99.99)<0.01,'amt='+editRes.amt);

    // ---- Flow: delete a row ----
    const delRes=await page.evaluate(async()=>{
      var before=state.rows.length;var idx=state.rows.length-1;openEdit(idx);await deleteEdit();
      return {before:before,after:state.rows.length};
    });
    check('deleteEdit removed the row',delRes.after===delRes.before-1,delRes.before+'->'+delRes.after);

    // ---- Flow: add a goal + fund it ----
    const goalRes=await page.evaluate(async()=>{
      var before=(state.meta.goals||[]).length;
      // open the add-goal form the way the UI does, so all fields exist/reset
      if(document.getElementById('goalAddOpen'))document.getElementById('goalAddOpen').click();
      document.getElementById('gName').value='Harness Goal';document.getElementById('gTarget').value='1000';
      if(document.getElementById('gMonthly'))document.getElementById('gMonthly').value='100';
      await addGoal();
      return {before:before,after:(state.meta.goals||[]).length,names:(state.meta.goals||[]).map(g=>g.name)};
    });
    check('addGoal created a goal',goalRes.after===goalRes.before+1,JSON.stringify(goalRes));

    // ---- Flow: add net worth asset + debt ----
    const nwRes=await page.evaluate(async()=>{
      document.getElementById('aName').value='Savings';document.getElementById('aBal').value='3000';
      await addNW('asset',document.getElementById('aName'),document.getElementById('aBal'),document.getElementById('aAdd'),document.getElementById('aMsg'),ASSET_START,ASSET_END,'account');
      return {assets:state.assets.length};
    });
    check('addNW asset works',nwRes.assets>=1,JSON.stringify(nwRes));

    // ---- Flow: paste import (small) ----
    const impRes=await page.evaluate(async()=>{
      var before=state.rows.length;
      openImport();
      var d=(new Date()).toISOString().slice(0,10);
      document.getElementById('impPasteTA').value=d+'\tGroceries\t15.00\tAldi\n'+d+'\tGas\t40.00\tShell';
      impParsePaste();
      var reviewed=IMPTX.length;
      await impDoImport();
      return {before:before,after:state.rows.length,reviewed:reviewed};
    });
    check('paste import added rows',impRes.after>impRes.before,JSON.stringify(impRes));

    // ---- Flow: year rollover review ----
    const yrRes=await page.evaluate(async()=>{
      var y=curYear()+1;
      await setBudYear(y);
      var overlayShown=document.getElementById('yearSetupOv')&&document.getElementById('yearSetupOv').style.display==='flex';
      var listed=(YSETUP||[]).length;
      if(overlayShown){await createYearFromSetup();}
      return {overlayShown:overlayShown,listed:listed,budYear:budYear};
    });
    check('year rollover review opened + created',yrRes.overlayShown&&yrRes.budYear===(CUR_YEAR+1),JSON.stringify(yrRes));
    // back to current year for the final renders
    await page.evaluate(()=>setBudYear(curYear()));await page.waitForTimeout(200);

    // ---- Final: re-render all views after all the mutations ----
    for(const v of ['add','month','budget','goals','worth','settings']){
      const before=errs.length;await page.evaluate(view=>switchView(view),v);await page.waitForTimeout(40);
      check('post-mutation render: '+v,errs.length===before,errs.slice(before).join(' | '));
    }
    } // end if(hasCats)

    // ---- FIRST-RUN CHOICE (contributor-only onboarding) — tested in isolation with stubbed create/picker ----
    if(SEED==='current'){
      // joinLink format
      const jl=await page.evaluate(()=>joinLink());
      check('joinLink ends with ?join',/\?join$/.test(jl),jl);
      // "Start my own" path resolves with the created budget id
      const own=await page.evaluate(async()=>{
        window.createFromTemplate=async()=>'own-created-id';
        window.openSheetPicker=async()=>{};
        var p=firstRunChoice();
        var shown=document.getElementById('chooseScreen').classList.contains('on');
        document.getElementById('chooseOwn').click();
        var id=await p;
        return {id:id,shown:shown};
      });
      check('firstRunChoice: chooseScreen shows',own.shown===true,'');
      check('firstRunChoice: "Start my own" creates a budget',own.id==='own-created-id',JSON.stringify(own));
      // "Join" path resolves with the picked shared budget id (no personal budget created)
      const join=await page.evaluate(async()=>{
        var created=false;window.createFromTemplate=async()=>{created=true;return 'should-not-happen';};
        window.openSheetPicker=async(opts)=>{setTimeout(()=>opts.onPick({id:'shared-999',name:'Household'}),10);};
        var p=firstRunChoice();
        document.getElementById('chooseShared').click();
        var id=await p;
        return {id:id,created:created};
      });
      check('firstRunChoice: "Join" opens shared budget',join.id==='shared-999',JSON.stringify(join));
      check('firstRunChoice: "Join" does NOT create a personal budget',join.created===false,'');
      await page.evaluate(()=>show('appScreen')); // restore
    }

    // ---- 10-YEAR STRESS (tenyear seed) ----
    if(SEED==='tenyear'){
      const scale=await page.evaluate(()=>({rows:state.rows.length}));
      check('10yr: loaded thousands of ledger rows',scale.rows>1000,'rows='+scale.rows+' load='+loadMs+'ms');
      check('10yr: initial load under ~4s',loadMs<4000,'load='+loadMs+'ms');
      // time a renderAll with the big dataset
      const renderMs=await page.evaluate(async()=>{var t=performance.now();switchView('month');renderAll();return Math.round(performance.now()-t);});
      check('10yr: renderAll under 400ms',renderMs<400,'renderAll='+renderMs+'ms');
      // time a single incremental add (should NOT refetch the ledger)
      const addMs=await page.evaluate(async()=>{switchView('add');setMode('expense');document.getElementById('fCategory').value=state.cats[0].name;document.getElementById('fAmount').value='9.99';document.getElementById('fDate').value=(new Date()).toISOString().slice(0,10);var t=performance.now();await addEntry();return Math.round(performance.now()-t);});
      check('10yr: single add stays fast (incremental)',addMs<600,'add='+addMs+'ms');
      // bulk import stress: paste ~250 rows, time impDoImport + dedup
      const bulk=await page.evaluate(async()=>{
        openImport();var d=(new Date()).getFullYear();var lines=[];
        for(var i=0;i<250;i++){var mo=(i%12)+1;lines.push(d+'-'+String(mo).padStart(2,'0')+'-15\tDining\t'+(10+i%40)+'\tCafe'+i);}
        // duplicate the first 20 lines to exercise dedup
        for(var j=0;j<20;j++)lines.push(lines[j]);
        document.getElementById('impPasteTA').value=lines.join('\n');
        var tp=performance.now();impParsePaste();var parseMs=Math.round(performance.now()-tp);
        var parsed=IMPTX.length;
        // render the review (dup-scan + category groups) — time it
        var tr=performance.now();renderImpReview();var reviewMs=Math.round(performance.now()-tr);
        var before=state.rows.length;
        var ti=performance.now();await impDoImport();var importMs=Math.round(performance.now()-ti);
        return {parsed:parsed,parseMs:parseMs,reviewMs:reviewMs,importMs:importMs,added:state.rows.length-before};
      });
      check('10yr: bulk paste parsed 270 rows',bulk.parsed===270,JSON.stringify(bulk));
      check('10yr: import review renders fast (<500ms)',bulk.reviewMs<500,'reviewMs='+bulk.reviewMs);
      check('10yr: bulk import completes (<8s)',bulk.importMs<8000,'importMs='+bulk.importMs);
      check('10yr: bulk import added rows (dedup left dupes out)',bulk.added>=250&&bulk.added<=270,'added='+bulk.added);
      for(const v of ['month','budget','goals','worth']){const before=errs.length;await page.evaluate(view=>switchView(view),v);await page.waitForTimeout(40);check('10yr: render '+v+' with big data',errs.length===before,errs.slice(before).join(' | '));}
    }
  }

  await browser.close();server.close();

  // ---------- report ----------
  console.log('\n=== NestWorth E2E harness — seed: '+SEED+' ===');
  var pass=results.filter(r=>r.ok).length,fail=results.length-pass;
  results.forEach(r=>console.log((r.ok?'  PASS ':'  FAIL ')+r.name+(r.detail?('  ['+r.detail+']'):'')));
  console.log('\n'+pass+' passed, '+fail+' failed. API calls: '+apiCalls+'. Uncaught errors: '+errs.length);
  if(errs.length)errs.slice(0,15).forEach(e=>console.log('  ! '+e));
  process.exit(fail||errs.length?1:0);
})().catch(e=>{console.error('HARNESS CRASH:',e);process.exit(2);});

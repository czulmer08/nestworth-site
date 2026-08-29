/* Verify the guided Decisions picker: pick a type → fill a form → see a structured before/after + Wren narration,
   all off the Decision Engine. */
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
  await page.waitForFunction(()=>typeof openDecisions==='function'&&typeof decPick==='function'&&typeof decRun==='function'&&document.getElementById('decOv'),{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    window.isGoalName=()=>false;show('appScreen');
    state.meta={startCash:15000,floor:6000,cats:{},cons:{},goals:[]};
    state.cons=[{name:'Job',annual:60000,bud12:Array(12).fill(5000)}];
    state.cats=[{name:'Living',annual:42000,bud12:Array(12).fill(3500)}];
    state.goals=[{name:'Renovation',target:75000,balance:21400,monthly:1000,archived:false,category:'',residual:false}];
    var rows=[];for(var m=1;m<Math.max(2,curMonth());m++){rows.push([curYear(),m,curYear()+'-0'+m+'-01','Me','Deposit','Job',5000,'','N']);rows.push([curYear(),m,curYear()+'-0'+m+'-02','Me','Living','X',3500,'','N']);}
    state.rows=rows;
    var vis=function(id){return getComputedStyle(document.getElementById(id)).display!=='none';};

    // opens on the type picker with all entrances
    openDecisions();
    var opened=vis('decStep1')&&!vis('decStep2')&&document.querySelectorAll('#decTypes .decchip').length===7&&getComputedStyle($("decOv")).display==='flex';

    // a recurring "monthly payment" offers a month-scope control (All year / From a month on)
    decPick('payment');
    var scopeCtl=!!document.getElementById('decScope')&&document.querySelectorAll('#decScope option').length===13;
    $("decAmt").value='700';$("decScope").value='10';decRun();  // from October on → 3 months
    var scopeRan=vis('decResult')&&/Counted from October/.test($("decNarr").textContent);

    // purchase flow
    decShow(1);decPick('purchase');
    var formOk=vis('decStep2')&&!!document.getElementById('decAmt')&&!!document.getElementById('decMonth')&&!!document.getElementById('decFrom');
    $("decAmt").value='6000';$("decMonth").value='12';$("decFrom").value='cash';decRun();
    var resultOk=vis('decResult')&&/(You can do it|stretch)/.test($("decVerdict").textContent)&&document.querySelectorAll('#decTable .dec-tr').length>=2&&/Assumes/.test($("decNarr").textContent);
    var tableHasSurplus=/Annual surplus/.test($("decTable").textContent)&&/Lowest cash/.test($("decTable").textContent)&&/Nest Egg Floor/.test($("decTable").textContent);

    // goal flow → goal-date row
    decShow(1);decPick('goal');$("decGoal").value='Renovation';$("decAmt").value='1500';decRun();
    var goalRow=/Renovation/.test($("decTable").textContent)&&/done/.test($("decTable").textContent)&&/finish moves/.test($("decNarr").textContent);

    // a floor-breaching purchase reads as "stretch"
    decShow(1);decPick('purchase');$("decAmt").value='50000';$("decMonth").value='12';$("decFrom").value='cash';decRun();
    var breachWarn=/stretch/.test($("decVerdict").textContent)&&/breached/.test($("decTable").textContent);

    // fund a purchase FROM a goal: cash flow unaffected, goal balance/date affected
    decShow(1);decPick('purchase');$("decAmt").value='5000';$("decMonth").value='12';$("decFrom").value='goal:Renovation';decRun();
    var fromGoal=/Renovation/.test($("decTable").textContent);

    // the table carries a year-end net-worth row
    var nwRow=/Net worth/.test($("decTable").textContent);

    // Life change: pick "having a baby" → sub-menu → multi-field form → one composed scenario
    decShow(1);decPick('life');
    var lifeSub=vis('decStep2')&&document.querySelectorAll('#decForm .decchip').length===4&&getComputedStyle($("decRun")).display==='none';
    decPickLife('baby');
    var lifeForm=!!document.getElementById('lfMonthly')&&!!document.getElementById('lfUpfront')&&!!document.getElementById('lfIncome')&&getComputedStyle($("decRun")).display!=='none';
    $("lfMonthly").value='1600';$("lfUpfront").value='3000';$("lfIncome").value='-1200';decRun();
    var lifeResult=vis('decResult')&&/Together that's/.test($("decNarr").textContent)&&/baby/i.test($("decTitle").textContent)&&document.querySelectorAll('#decTable .dec-tr').length>=3;

    return {opened,formOk,resultOk,tableHasSurplus,goalRow,breachWarn,fromGoal,nwRow,lifeSub,lifeForm,lifeResult,scopeCtl,scopeRan};
  });

  ck('picker opens on the type sheet with all six entrances', res.opened, String(res.opened));
  ck('choosing "large purchase" shows amount / when / from', res.formOk, String(res.formOk));
  ck('running it shows a verdict, a before/after table, and Wren narration with the assumption', res.resultOk, String(res.resultOk));
  ck('the table compares surplus, lowest cash, and the Nest Egg Floor', res.tableHasSurplus, String(res.tableHasSurplus));
  ck('a goal decision adds the goal finish-date row', res.goalRow, String(res.goalRow));
  ck('a floor-breaching purchase reads as "would stretch you"', res.breachWarn, String(res.breachWarn));
  ck('funding a purchase from a goal routes through the goal (not cash)', res.fromGoal, String(res.fromGoal));
  ck('the before/after table carries a year-end net-worth row', res.nwRow, String(res.nwRow));
  ck('a life change opens a sub-menu of four events (Run hidden until one is picked)', res.lifeSub, String(res.lifeSub));
  ck('picking "having a baby" shows the multi-field form (monthly / upfront / income)', res.lifeForm, String(res.lifeForm));
  ck('running a life change composes one scenario, titled + narrated as a batch', res.lifeResult, String(res.lifeResult));
  ck('a recurring payment offers a month-scope control (All year + 12 months)', res.scopeCtl, String(res.scopeCtl));
  ck('scoping a payment "From October on" runs and is narrated', res.scopeRan, String(res.scopeRan));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

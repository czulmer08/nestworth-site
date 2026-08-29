/* Verify the new "Set aside $/check" income mode: a fixed per-paycheck set-aside that scales with the real-payday calendar
   (a 3-paycheck month sets aside more than a 2-paycheck month) — plus the picker UI wiring. */
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
  await page.waitForFunction(()=>typeof monthsFor==='function'&&typeof conTypeUI==='function'&&typeof readConCfg==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear();window.budYear=0;
    // real payday calendar anchored so August has 3 checks (Aug 1, 15, 29)
    var anchor=Y+'-08-29';
    var pp=paydaysPerMonth(anchor,14,Y);
    // per-check set-aside: take-home 3836.27, set aside 1769.60/check → budgetable 2066.67/check
    var cfg={type:'paycheck',freq:26,mode:'keepcheck',keepChk:1769.60,amount:3836.27,calendar:true,payAnchor:anchor};
    var mo=monthsFor(cfg);
    var aug=pp[7], perNet=Math.round((3836.27-1769.60)*100)/100; // 2066.67
    var threeCheckOk=Math.abs(mo[7]-perNet*aug)<0.02 && aug===3;                       // 3-check month = 2066.67×3 = 6200.01
    var twoIdx=pp.indexOf(2);
    var twoCheckOk=twoIdx>=0&&Math.abs(mo[twoIdx]-perNet*2)<0.02;                        // a 2-check month = 2066.67×2 = 4133.34
    var scalesOk=threeCheckOk&&twoCheckOk&&mo[7]>mo[twoIdx];                              // 3-check month budgets MORE than a 2-check month
    var annualOk=Math.abs(mo.reduce(function(a,b){return a+b;},0)-perNet*26)<0.5;         // annual = perNet × 26 checks

    // flat (no real paydays): annual = (take-home − per-check set-aside) × 26, spread
    var flat=monthsFor({type:'paycheck',freq:26,mode:'keepcheck',keepChk:1769.60,amount:3836.27});
    var flatOk=Math.abs(flat.reduce(function(a,b){return a+b;},0)-perNet*26)<0.5;

    // UI: the third mode chip exists; selecting it shows the per-check input and readConCfg round-trips it
    show('appScreen');openOv('conOv',conTypeUI);
    $("conType").value='paycheck';conTypeUI();
    var chip=document.querySelector('#conMode .chip[data-m="keepcheck"]');
    var chipExists=!!chip;
    conPayMode='keepcheck';conTypeUI();
    var rowShown=chip&&getComputedStyle($("conKeepChkRow")).display!=='none'&&getComputedStyle($("conKeepRow")).display==='none'&&getComputedStyle($("conPctRow")).display==='none';
    $("conName").value='Denzell';$("conAmt").value='3836.27';$("conKeepChk").value='1769.60';
    var saved=readConCfg();
    var saveOk=saved.mode==='keepcheck'&&Math.abs(saved.keepChk-1769.60)<0.01&&Math.abs(saved.amount-3836.27)<0.01;

    return {threeCheckOk,twoCheckOk,scalesOk,annualOk,flatOk,chipExists,rowShown,saveOk,aug,augBudget:mo[7],twoBudget:mo[twoIdx],saved};
  });

  ck('per-check set-aside: a 3-paycheck month budgets 2066.67 × 3 = $6,200', res.threeCheckOk, JSON.stringify({aug:res.aug,budget:res.augBudget}));
  ck('a 2-paycheck month budgets 2066.67 × 2 = $4,133', res.twoCheckOk, JSON.stringify(res.twoBudget));
  ck('the set-aside SCALES: 3-check month budgets more than a 2-check month', res.scalesOk, String(res.scalesOk));
  ck('annual = budgetable-per-check × 26', res.annualOk, String(res.annualOk));
  ck('flat (no real paydays) annual matches', res.flatOk, String(res.flatOk));
  ck('picker has a "Set aside $/check" chip', res.chipExists, String(res.chipExists));
  ck('selecting it shows only the per-check input row', res.rowShown, String(res.rowShown));
  ck('readConCfg round-trips {mode:keepcheck, keepChk, amount}', res.saveOk, JSON.stringify(res.saved));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

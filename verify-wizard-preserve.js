/* Verify the budget wizard preserves settings it has no UI for, instead of wiping them on a re-run:
   per-check set-aside (keepcheck), real paydays (calendar/payAnchor), mid-year raises, a richer non-paycheck income type,
   and a monthly envelope's rollStart. It reads the live openWizard() mapping + wizIncCfg/wizCatCfg round-trip. */
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
  await page.waitForFunction(()=>typeof openWizard==='function'&&typeof wizIncCfg==='function'&&typeof wizCatCfg==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});
  const near=(a,bb)=>Math.abs(a-bb)<0.02;

  const res=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs(a-bb)<0.02;};
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};
    // A paycheck line carrying EVERY advanced setting the wizard can't render:
    var payCfg={type:"paycheck",freq:26,mode:"keepcheck",keepChk:1769.60,amount:3836.27,calendar:true,payAnchor:"2026-08-29",raises:[{month:7,amount:4200}]};
    var custCfg={type:"custom",months:[100,200,300,400,500,600,700,800,900,1000,1100,1200]};
    state.cons=[{name:"Denzell",mtarget:2066.67,annual:24000},{name:"Side gig",mtarget:600,annual:7200}];
    state.meta={cons:{"denzell":payCfg,"side gig":custCfg},cats:{"utilities":{type:"monthly",roll:"envelope",rollStart:202603}}};
    state.cats=[{name:"Utilities",mbud:240,annual:2880,bud12:[240,240,240,240,240,240,240,240,240,240,240,240]}];
    state.goals=[];state.rows=[];

    openWizard(true); // edit mode: builds WZ.incomes / WZ.cats from live state

    var byName=function(arr,n){return arr.filter(function(x){return x.name===n;})[0];};
    var wPay=byName(WZ.incomes,"Denzell"), wCust=byName(WZ.incomes,"Side gig"), wUtil=byName(WZ.cats,"Utilities");

    // 1) the mapping attached the original cfg
    var attached=!!(wPay&&wPay._cfg&&wPay._cfg.mode==="keepcheck")&&!!(wCust&&wCust._cfg&&wCust._cfg.type==="custom");

    // 2) round-trip the paycheck through wizIncCfg (user did NOT change the keep mode → stays "all")
    var outPay=wizIncCfg(wPay);
    var keepCheckKept=outPay&&outPay.mode==="keepcheck"&&near(outPay.keepChk,1769.60);
    var calKept=outPay&&outPay.calendar===true&&outPay.payAnchor==="2026-08-29";
    var raiseKept=outPay&&outPay.raises&&outPay.raises.length===1&&outPay.raises[0].month===7&&near(outPay.raises[0].amount,4200);

    // 3) a richer income type (custom) is NOT downgraded to monthly when the user leaves it alone
    var outCust=wizIncCfg(wCust);
    var customKept=outCust&&outCust.type==="custom"&&outCust.months&&outCust.months[11]===1200;

    // 4) but if the user DOES change that line's amount, honor the edit (downgrade to the new monthly)
    var wCust2={};for(var k in wCust)wCust2[k]=wCust[k];wCust2.monthly=999; // edited
    var outCust2=wizIncCfg(wCust2);var editHonored=outCust2&&outCust2.type==="monthly"&&near(outCust2.amount,999);

    // 5) if the user explicitly switches the paycheck to a % in the wizard, honor THAT (no longer keepcheck), but still keep calendar/raises
    var wPay2={};for(var k2 in wPay)wPay2[k2]=wPay[k2];wPay2.keepMode="pct";wPay2.pct=54;
    var outPay2=wizIncCfg(wPay2);
    var modeSwitch=outPay2&&outPay2.mode==="pct"&&near(outPay2.pct,54)&&outPay2.calendar===true&&outPay2.raises&&outPay2.raises.length===1;

    // 6) a monthly envelope keeps its rollStart (and applies the edited amount + roll)
    var outUtil=wizCatCfg(wUtil);
    var rollStartKept=outUtil&&outUtil.rollStart===202603&&outUtil.roll==="envelope"&&outUtil.type==="monthly";

    return {attached,keepCheckKept,calKept,raiseKept,customKept,editHonored,modeSwitch,rollStartKept,
            outPay:{mode:outPay&&outPay.mode,keepChk:outPay&&outPay.keepChk,cal:outPay&&outPay.calendar,raises:outPay&&outPay.raises},outUtil:outUtil};
  });

  ck('openWizard attaches the original cfg to income entries', res.attached, '');
  ck('per-check set-aside (keepcheck + keepChk $1,769.60) survives the wizard', res.keepCheckKept, JSON.stringify(res.outPay));
  ck('real paydays (calendar + payAnchor) survive the wizard', res.calKept, '');
  ck('mid-year raise (Jul → $4,200) survives the wizard', res.raiseKept, '');
  ck('a custom income line is NOT downgraded to monthly when left alone', res.customKept, '');
  ck('editing that line’s amount in the wizard IS honored (downgrades as intended)', res.editHonored, '');
  ck('explicitly switching to a % is honored, and calendar/raises still carry', res.modeSwitch, '');
  ck('a monthly envelope keeps its rollStart through the wizard', res.rollStartKept, JSON.stringify(res.outUtil));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

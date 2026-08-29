/* Verify mid-year pay changes on a paycheck line: multiple change points, each {month, new take-home}. The effective
   take-home applies from its month onward, works with the real-payday calendar AND the flat average, flows through the
   chain (bud12 -> _cfArrays -> annual), and round-trips through the editor UI. No-change configs stay byte-identical. */
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
  await page.waitForFunction(()=>typeof monthsFor==='function'&&typeof readConCfg==='function'&&typeof prefillConForm==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs(a-bb)<0.02;};
    var Y=2026;curYear=function(){return Y;};bYear=function(){return Y;};

    // --- FLAT (no real calendar): base $2,000/check, raise to $2,500 in Apr, $3,000 in Sep. pm = 26/12 checks/mo. ---
    var cfg={type:'paycheck',freq:26,mode:'pct',pct:100,amount:2000,raises:[{month:9,amount:3000},{month:4,amount:2500}]}; // deliberately unsorted
    var mo=monthsFor(cfg);
    var e=function(v){return Math.round(v*100)/100;};
    var flatJan=near(mo[0],e(2000*26/12)), flatMar=near(mo[2],e(2000*26/12));   // Jan–Mar at base
    var flatApr=near(mo[3],e(2500*26/12)), flatAug=near(mo[7],e(2500*26/12));   // Apr–Aug at 2500
    var flatSep=near(mo[8],e(3000*26/12)), flatDec=near(mo[11],e(3000*26/12));  // Sep–Dec at 3000
    var stepUp=mo[3]>mo[2]&&mo[8]>mo[7];                                          // each change is an increase

    // --- CALENDAR: same raises, biweekly anchor with a 3-check August. Aug is in the $2,500 window: 3 × 2,500 = 7,500. ---
    var anchor=Y+'-08-29';var pp=paydaysPerMonth(anchor,14,Y);
    var cfgC={type:'paycheck',freq:26,mode:'pct',pct:100,amount:2000,calendar:true,payAnchor:anchor,raises:[{month:4,amount:2500},{month:9,amount:3000}]};
    var moC=monthsFor(cfgC);
    var augChecks=pp[7], janChecks=pp[0];
    var calAug=near(moC[7], 2500*augChecks);        // Aug uses the effective $2,500 AND the real check count
    var calJan=near(moC[0], 2000*janChecks);        // Jan uses base $2,000 at its real check count
    var calSep=near(moC[8], 3000*pp[8]);            // Sep uses $3,000

    // --- keepcheck mode + a raise: set-aside stays fixed, take-home rises. base 3836.27 keep 1769.60 -> 2066.67; raise take-home to 4000 in Jul -> 4000-1769.60=2230.40 ---
    var cfgK={type:'paycheck',freq:26,mode:'keepcheck',keepChk:1769.60,amount:3836.27,raises:[{month:7,amount:4000}]};
    var moK=monthsFor(cfgK);
    var kJun=near(moK[5], e((3836.27-1769.60)*26/12)), kJul=near(moK[6], e((4000-1769.60)*26/12));

    // --- chain: bud12 -> _cfArrays income -> annual (Decision/Wren base) ---
    state.meta={startCash:0,floor:0,cats:{},cons:{}};state.cats=[];state.cons=[{name:'Pay',annual:mo.reduce(function(a,b){return a+b;},0),mtarget:mo[0],bud12:mo}];state.goals=[];state.rows=[];
    var plan=currentPlan();var cf=_cfArrays(plan);
    var chainMonths=near(cf.inc[3],mo[3])&&near(cf.inc[8],mo[8]);
    var ap=computeAnnualPlan(plan,{mode:'plan'});
    var chainAnnual=near(ap.income,mo.reduce(function(a,b){return a+b;},0));

    // --- no-change config is byte-identical to the pre-feature behavior (flat annual spread) ---
    var noRaise=monthsFor({type:'paycheck',freq:26,mode:'pct',pct:100,amount:2000});
    var plainOk=near(noRaise.reduce(function(a,b){return a+b;},0),2000*26)&&near(noRaise[0],noRaise[1]); // even spread, no steps

    // --- UI round-trip: readConCfg collects the change rows; prefillConForm repopulates them ---
    var uiOk=false,rt=false;
    try{
      show('appScreen');openOv('conOv',conTypeUI);$("conType").value='paycheck';conTypeUI();
      $("conAmt").value='2000';conPayMode='pct';$("conPct").value='100';
      $("conRaiseTog").checked=true;$("conRaiseTog").dispatchEvent(new Event('change'));
      conRaises=[{month:4,amount:2500},{month:9,amount:3000}];renderConRaises();
      uiOk=getComputedStyle($("conRaiseWrap")).display!=='none'&&document.querySelectorAll('#conRaiseList .raise-row').length===2;
      var saved=readConCfg();
      var okRead=saved.raises&&saved.raises.length===2&&saved.raises[0].month===4&&near(saved.raises[0].amount,2500)&&saved.raises[1].month===9;
      // now prefill a DIFFERENT line and confirm it loads the rows back
      prefillConForm('Pay',{type:'paycheck',freq:26,mode:'pct',pct:100,amount:2000,raises:[{month:6,amount:2600}]});
      var loadedRows=document.querySelectorAll('#conRaiseList .raise-row').length;var togOn=$("conRaiseTog").checked;
      rt=okRead&&loadedRows===1&&togOn===true;
    }catch(err){rt='ERR:'+err.message;}

    return {flatJan,flatMar,flatApr,flatAug,flatSep,flatDec,stepUp,augChecks,calAug,calJan,calSep,kJun,kJul,chainMonths,chainAnnual,plainOk,uiOk,rt,
            sample:{jan:mo[0],apr:mo[3],sep:mo[8],augCal:moC[7]}};
  });

  ck('flat: Jan–Mar at base $2,000/check', res.flatJan&&res.flatMar, JSON.stringify(res.sample));
  ck('flat: Apr–Aug jump to $2,500/check', res.flatApr&&res.flatAug, '');
  ck('flat: Sep–Dec jump to $3,000/check', res.flatSep&&res.flatDec, '');
  ck('each change is an increase (steps up in Apr and Sep)', res.stepUp, '');
  ck('calendar: a 3-check August in the $2,500 window = 3 × 2,500 = $7,500', res.augChecks===3&&res.calAug, JSON.stringify({augChecks:res.augChecks,augCal:res.sample.augCal}));
  ck('calendar: January uses base $2,000 at its real check count', res.calJan, '');
  ck('calendar: September uses $3,000', res.calSep, '');
  ck('keepcheck + raise: set-aside stays fixed while take-home rises (Jun base, Jul higher)', res.kJun&&res.kJul, '');
  ck('chain: _cfArrays income mirrors bud12 for the changed months', res.chainMonths, '');
  ck('chain: Annual Plan / Decision-Wren income = sum of the 12 months', res.chainAnnual, '');
  ck('a no-change paycheck is still an even annual spread (unchanged behavior)', res.plainOk, '');
  ck('editor shows the change list and readConCfg collects the rows', res.uiOk, '');
  ck('UI round-trips raises (read 2 sorted; prefill loads them back)', res.rt===true, String(res.rt));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

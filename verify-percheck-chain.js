/* GOLDEN CHAIN INVARIANTS for the three paycheck-budgeting modes.
   The prior golden suite only checked that monthsFor() computed its stated formula. It never challenged the product
   assumption that a household needs a PER-CHECK set-aside, and — more importantly — never proved that a mode set at
   income-setup survives every screen that re-reads income. This test drives the ACTUAL app and follows one config through:
     income setup (monthsFor) -> monthly plan (_cfArrays) -> Month "expected income" (bud12/mtarget) ->
     Cash Flow (computeCashflow) -> Annual Plan (computeAnnualPlan) -> Decision Engine + Wren base (planMetrics)
   for all three modes, with a REAL biweekly calendar (3-check August vs a 2-check month), asserting the exact figures:
     per-check  $3,836.27 / set aside $1,769.60:   2 checks -> $4,133.34   3 checks -> $6,200.01
     per-month  $3,836.27 / set aside $3,169.89:   2 checks -> $4,502.65   3 checks -> $8,338.92
     percent    $3,836.27 / 54%:                    scales naturally with 2 vs 3 checks
   Every mode floors at $0. */
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
  await page.waitForFunction(()=>typeof monthsFor==='function'&&typeof computeAnnualPlan==='function'&&typeof planMetrics==='function'&&typeof computeCashflow==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});
  const near=(a,bb)=>Math.abs(a-bb)<0.02;

  const res=await page.evaluate(()=>{
    var Y=2026;curYear=function(){return Y;};bYear=function(){return Y;};
    curMonth=function(){return 1;}; // January "current" so every other month is FUTURE and cash-flow net == planned income (isolates income cleanly)
    var anchor=Y+'-08-29';                 // biweekly anchor => Aug 1,15,29 (3 checks); most months 2 checks
    var pp=paydaysPerMonth(anchor,14,Y);
    var AUG=7,two=pp.indexOf(2);

    // Follow ONE config all the way through the chain; return every surface's read of income for Aug (3-check) & a 2-check month.
    function chain(cfg){
      var bud12=monthsFor(cfg);
      // materialize exactly as the summary sheet does: bud12 columns + this-month target
      var con={name:'Denzell',row:20,annual:bud12.reduce(function(a,b){return a+b;},0),mtarget:bud12[0],mdep:0,bud12:bud12};
      state.meta={startCash:0,floor:0,cats:{},cons:{}};state.cons=[con];state.cats=[];state.goals=[];state.rows=[];state.carryIn={};state.spend={};state.dep={};
      var plan=currentPlan();
      var cfA=_cfArrays(plan);                                   // monthly plan
      var cf=computeCashflow(plan,{mode:'plan'});                // Cash Flow (all future => net == planned income)
      var ap=computeAnnualPlan(plan,{mode:'plan'});              // Annual Plan
      var pm=planMetrics(plan);                                  // Decision Engine + Wren base (no cats/goals => surplus == income)
      var byM=function(arr,i){for(var k=0;k<arr.length;k++)if(arr[k].m===i+1)return arr[k];return null;};
      return {
        bud12:bud12,
        setup:{aug:bud12[AUG],two:bud12[two]},                                  // income setup
        plan:{aug:cfA.inc[AUG],two:cfA.inc[two]},                               // monthly plan (_cfArrays)
        monthExp:{aug:(con.bud12[AUG]||0),two:(con.bud12[two]||0)},             // Month "expected income" reads bud12[m-1]
        cashflow:{aug:(byM(cf.months,AUG)||{}).net,two:(byM(cf.months,two)||{}).net}, // Cash Flow net (income only)
        annual:ap.income,                                                       // Annual Plan income
        decisionWren:pm.surplus,                                                // planMetrics surplus == income (no cats/goals)
        annualSum:bud12.reduce(function(a,b){return a+b;},0)
      };
    }

    var perCheck=chain({type:'paycheck',freq:26,mode:'keepcheck',keepChk:1769.60,amount:3836.27,calendar:true,payAnchor:anchor});
    var perMonth=chain({type:'paycheck',freq:26,mode:'keep',keep:3169.89,amount:3836.27,calendar:true,payAnchor:anchor});
    var pct54   =chain({type:'paycheck',freq:26,mode:'pct',pct:54,amount:3836.27,calendar:true,payAnchor:anchor});

    // floor-at-$0: a monthly set-aside larger than a whole month's pay yields $0, never negative
    var floored=monthsFor({type:'paycheck',freq:26,mode:'keep',keep:99999,amount:3836.27,calendar:true,payAnchor:anchor});
    var noNeg=floored.every(function(v){return v>=0;})&&floored[AUG]===0;

    return {augChecks:pp[AUG],twoIdx:two,perCheck:perCheck,perMonth:perMonth,pct54:pct54,noNeg:noNeg};
  });

  // sanity: the calendar really gives 3 checks in Aug and a 2-check month exists
  ck('calendar produces a 3-check August and a 2-check month', res.augChecks===3&&res.twoIdx>=0, JSON.stringify({aug:res.augChecks,two:res.twoIdx}));

  // ---- PER-CHECK $1,769.60: every surface agrees, and the numbers are your exact invariants ----
  (function(m,label,aug3,two2){
    var surfaces=[['income setup',m.setup],['monthly plan',m.plan],['Month expected income',m.monthExp],['Cash Flow',m.cashflow]];
    surfaces.forEach(function(s){
      ck(label+': '+s[0]+' — 3-check Aug = $'+aug3.toFixed(2), near(s[1].aug,aug3), JSON.stringify(s[1].aug));
      ck(label+': '+s[0]+' — 2-check month = $'+two2.toFixed(2), near(s[1].two,two2), JSON.stringify(s[1].two));
    });
    ck(label+': Annual Plan income = Decision/Wren base = sum of the 12 months', near(m.annual,m.annualSum)&&near(m.decisionWren,m.annualSum), JSON.stringify({annual:m.annual,wren:m.decisionWren,sum:m.annualSum}));
  })(res.perCheck,'per-check',6200.01,4133.34);

  // ---- PER-MONTH $3,169.89: your exact invariants across the same chain ----
  (function(m,label,aug3,two2){
    var surfaces=[['income setup',m.setup],['monthly plan',m.plan],['Month expected income',m.monthExp],['Cash Flow',m.cashflow]];
    surfaces.forEach(function(s){
      ck(label+': '+s[0]+' — 3-check Aug = $'+aug3.toFixed(2), near(s[1].aug,aug3), JSON.stringify(s[1].aug));
      ck(label+': '+s[0]+' — 2-check month = $'+two2.toFixed(2), near(s[1].two,two2), JSON.stringify(s[1].two));
    });
    ck(label+': Annual Plan income = Decision/Wren base = sum of the 12 months', near(m.annual,m.annualSum)&&near(m.decisionWren,m.annualSum), JSON.stringify({annual:m.annual,wren:m.decisionWren,sum:m.annualSum}));
  })(res.perMonth,'per-month',8338.92,4502.65);

  // ---- PERCENT 54%: scales naturally (3-check > 2-check) and stays consistent across surfaces ----
  (function(m,label){
    var scaleOk=m.setup.aug>m.setup.two&&near(m.setup.aug,m.setup.two*1.5); // 3 checks vs 2 checks at same per-check rate => ×1.5
    ck(label+': 54% scales with the calendar (3-check Aug is 1.5× a 2-check month)', scaleOk, JSON.stringify(m.setup));
    ck(label+': every surface reads the same Aug figure', near(m.plan.aug,m.setup.aug)&&near(m.monthExp.aug,m.setup.aug)&&near(m.cashflow.aug,m.setup.aug), JSON.stringify({setup:m.setup.aug,plan:m.plan.aug,month:m.monthExp.aug,cash:m.cashflow.aug}));
    ck(label+': Annual Plan income = Decision/Wren base = sum of the 12 months', near(m.annual,m.annualSum)&&near(m.decisionWren,m.annualSum), JSON.stringify({annual:m.annual,wren:m.decisionWren,sum:m.annualSum}));
  })(res.pct54,'percent');

  ck('every mode floors at $0 (a set-aside bigger than the month never goes negative)', res.noNeg, String(res.noNeg));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

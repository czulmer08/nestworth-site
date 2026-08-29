/* GOLDEN TESTS for the computed contingency-coverage layer (computeRollover). Contingency is a shared SECONDARY cushion that
   covers envelope deficits for availability, while raw negative envelope balances are preserved for accountability. Nothing is
   written to the ledger. Cases: no deficit; deficit < contingency; deficit = contingency; deficit > contingency; multiple
   negatives (deterministic proportional split, cent-exact); negative & zero buffer; positives mixed with negatives; cent
   rounding; prior-year carry-in; and that coverage never changes spending / cash-flow / net-worth totals. */
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
  await page.waitForFunction(()=>typeof computeRollover==='function'&&typeof catBalance==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});
  const near=(a,bb)=>Math.abs(a-bb)<0.02;

  const res=await page.evaluate(()=>{
    var near=function(a,bb){return Math.abs(a-bb)<0.02;};
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(n){return (window.__carry&&window.__carry[(""+n).toLowerCase()])||0;};
    catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    var SPEND={};catSpend12=function(n){return (SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};

    // helper: build a scenario and return computeRollover()
    function scen(cats,spend,carry){window.__carry=carry||{};SPEND={};for(var k in spend)SPEND[k.toLowerCase()]=spend[k];
      state.meta={cats:{}};state.cats=cats.map(function(c){state.meta.cats[c.name.toLowerCase()]={type:"monthly",roll:c.roll};return {name:c.name,bud12:fill(c.bud)};});
      state.goals=[];window.isGoalName=function(){return false;};state.rows=[];
      return computeRollover();}

    var R={};
    // 1) no deficit — all envelopes positive
    R.none=scen([{name:"Food",bud:300,roll:"envelope"},{name:"Buf",bud:200,roll:"buffer"}],
                {food:[0,0,0,0,0,0,0,0,0,0,0,0],buf:[0,0,0,0,0,0,0,0,0,0,0,0]});
    // 2) deficit < contingency: Kids −$700 (7×(500−600)), buffer +$1,400 (7×200)
    R.lt=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"Buf",bud:200,roll:"buffer"}],
              {kids:fill(600),buf:fill(0)});
    // 3) deficit == contingency: Kids −$700, buffer +$700 (7×100)
    R.eq=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"Buf",bud:100,roll:"buffer"}],
              {kids:fill(600),buf:fill(0)});
    // 4) deficit > contingency: Kids −$2,800 (7×400 over), buffer +$560 (7×80)
    R.gt=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"Buf",bud:100,roll:"buffer"}],
              {kids:fill(900),buf:fill(20)});
    // 5) multiple negatives, partial: Kids −$2,800, Pets −$700, buffer +$2,100 (7×300). total deficit 3,500 > 2,100
    R.multi=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"Pets",bud:200,roll:"envelope"},{name:"Buf",bud:300,roll:"buffer"}],
                 {kids:fill(900),pets:fill(300),buf:fill(0)});
    // 6) negative raw buffer → $0 available (buffer overspent)
    R.negbuf=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"Buf",bud:100,roll:"buffer"}],
                  {kids:fill(600),buf:fill(300)}); // buffer 7×(100−300) = −1,400
    // 7) positives mixed with negatives: Home +$1,500, Kids −$700, buffer +$1,000
    R.mixed=scen([{name:"Home",bud:300,roll:"envelope"},{name:"Kids",bud:500,roll:"envelope"},{name:"Buf",bud:200,roll:"buffer"}],
                 {home:fill(0),kids:fill(600),buf:fill(57.142857)}); // buf ≈ 7×142.857 = 1000.00
    // 8) cent rounding across an odd split: two negatives, buffer covers part with a repeating fraction
    R.cents=scen([{name:"A",bud:100,roll:"envelope"},{name:"B",bud:100,roll:"envelope"},{name:"Buf",bud:100,roll:"buffer"}],
                 {a:fill(200),b:fill(150),buf:fill(0)}); // A −700, B −350; buffer 700; contingencyUsed=700, split across 1050 deficit
    // 9) prior-year carry-in still respected in the raw balance (carry lifts Kids out of deficit)
    R.carry=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"Buf",bud:100,roll:"buffer"}],
                 {kids:fill(600),buf:fill(0)},{kids:1000}); // carry +1000 → Kids raw = −700+1000 = +300 (no deficit)
    // ===== BUFFER-DEFICIT semantics (v0.67): a negative buffer pool is its OWN shortfall, never negative coverage =====
    // 10) zero buffer + negative envelope
    R.zeroBuf=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"Buf",bud:100,roll:"buffer"}],{kids:fill(600),buf:fill(100)}); // buffer 0
    // 11) negative buffer + NO negative envelopes (Home positive)
    R.negBufNoEnv=scen([{name:"Home",bud:300,roll:"envelope"},{name:"Buf",bud:100,roll:"buffer"}],{home:fill(0),buf:fill(100+1000/7)}); // buf 7×(100−242.857)=−1000
    // 12) negative buffer + negative envelope (the canonical example: −$1,000 buffer, −$2,000 Kids → $3,000 total)
    R.negBufNegEnv=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"Buf",bud:100,roll:"buffer"}],{kids:fill(500+2000/7),buf:fill(100+1000/7)}); // Kids −2000, buf −1000
    // 13) MULTIPLE negative buffer categories pool together (−600 + −400 = −1,000 raw buffer)
    R.multiNegBuf=scen([{name:"Kids",bud:500,roll:"envelope"},{name:"BufA",bud:100,roll:"buffer"},{name:"BufB",bud:100,roll:"buffer"}],
                       {kids:fill(600),bufa:fill(100+600/7),bufb:fill(100+400/7)}); // BufA −600, BufB −400 → raw −1000
    // 14) positive + negative buffer categories that NET POSITIVE (+2,000 and −500 → +1,500 available, $0 deficit)
    R.netPos=scen([{name:"BufA",bud:100,roll:"buffer"},{name:"BufB",bud:100,roll:"buffer"}],{bufa:fill(100-2000/7),bufb:fill(100+500/7)}); // +2000, −500 → +1500
    // 15) positive + negative buffer categories that NET NEGATIVE (+300 and −800 → −500)
    R.netNeg=scen([{name:"BufA",bud:100,roll:"buffer"},{name:"BufB",bud:100,roll:"buffer"}],{bufa:fill(100-300/7),bufb:fill(100+800/7)}); // +300, −800 → −500
    // 16) exact-zero net buffer (+500 and −500 → 0)
    R.exactZero=scen([{name:"BufA",bud:100,roll:"buffer"},{name:"BufB",bud:100,roll:"buffer"}],{bufa:fill(100-500/7),bufb:fill(100+500/7)});

    // 10) coverage must not touch spending / net-worth totals — it's a read-only allocation of an existing cushion
    window.__carry={};SPEND={};SPEND["kids"]=fill(900);SPEND["buf"]=fill(20);
    state.meta={cats:{kids:{type:"monthly",roll:"envelope"},buf:{type:"monthly",roll:"buffer"}}};
    state.cats=[{name:"Kids",bud12:fill(500),mbud:500,mused:900,annual:6000},{name:"Buf",bud12:fill(100),mbud:100,mused:20,annual:1200}];
    state.assets=[{name:"Checking",bal:12000}];state.debts=[{name:"Loan",bal:4000}];state.goals=[];state.rows=[];window.isGoalName=function(){return false;};
    var nwBefore=netWorthNow(),kidsRawBefore=catBalance(state.cats[0]);
    var roll=computeRollover(); // deficit present, contingency covering
    var nwAfter=netWorthNow(),kidsRawAfter=catBalance(state.cats[0]);
    var untouched=near(nwBefore,nwAfter)&&near(nwBefore,8000)&&near(kidsRawBefore,kidsRawAfter)&&roll.contingencyUsed>0.005;

    // ===== Wren distinguishes the four questions (negative-buffer household: −$1,000 buffer, −$2,000 Kids) =====
    window.__carry={};SPEND={kids:fill(500+2000/7),buf:fill(100+1000/7)};
    state.meta={cats:{kids:{type:"monthly",roll:"envelope"},buf:{type:"monthly",roll:"buffer"}}};
    state.cats=[{name:"Kids",bud12:fill(500)},{name:"Buf",bud12:fill(100)}];
    state.goals=[];state.rows=[[2026,8,'2026-08-01','','x','',0,'','N']];window.isGoalName=function(){return false;};
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};
    function W(q){var a=null;try{a=wrenAnalyze(q);}catch(e){return 'ERR '+e.message;}return a?a.answer:'(null)';}
    var wren={
      have:W("How much contingency do I have?"),
      overspent:W("Is my contingency overspent?"),
      envUncov:W("How much of my envelopes isn't covered?"),
      total:W("How much rollover shortfall do I have altogether?")};

    function envs(r){var m={};r.envelopes.forEach(function(e){m[e.name]=e;});return m;}
    var m4=envs(R.gt),m5=envs(R.multi),m8=envs(R.cents),m9=envs(R.carry);
    return {wren:wren,
      none:{used:R.none.contingencyUsed,unc:R.none.uncoveredDeficit,avail:R.none.remainingContingency,def:R.none.totalEnvelopeDeficit},
      lt:{used:R.lt.contingencyUsed,unc:R.lt.uncoveredDeficit,avail:R.lt.remainingContingency,def:R.lt.totalEnvelopeDeficit},
      eq:{used:R.eq.contingencyUsed,unc:R.eq.uncoveredDeficit,avail:R.eq.remainingContingency},
      gt:{used:R.gt.contingencyUsed,unc:R.gt.uncoveredDeficit,avail:R.gt.remainingContingency,kidsRaw:m4.Kids.rawBalance,kidsCov:m4.Kids.coveredByContingency,kidsUnc:m4.Kids.uncovered},
      multi:{used:R.multi.contingencyUsed,unc:R.multi.uncoveredDeficit,kidsCov:m5.Kids.coveredByContingency,petsCov:m5.Pets.coveredByContingency,sumCov:Math.round((m5.Kids.coveredByContingency+m5.Pets.coveredByContingency)*100)/100},
      negbuf:{raw:R.negbuf.rawBuffer,avail:R.negbuf.availableBuffer,used:R.negbuf.contingencyUsed,unc:R.negbuf.uncoveredDeficit},
      mixed:{used:R.mixed.contingencyUsed,homeRaw:envs(R.mixed).Home.rawBalance,homeCov:envs(R.mixed).Home.coveredByContingency},
      cents:{used:R.cents.contingencyUsed,sumCov:Math.round((m8.A.coveredByContingency+m8.B.coveredByContingency)*100)/100,aCov:m8.A.coveredByContingency,bCov:m8.B.coveredByContingency},
      carry:{kidsRaw:m9.Kids.rawBalance,def:R.carry.totalEnvelopeDeficit,used:R.carry.contingencyUsed},
      untouched:untouched,
      zeroBuf:{rawBuf:R.zeroBuf.rawBuffer,avail:R.zeroBuf.availableBuffer,bufDef:R.zeroBuf.bufferDeficit,envDef:R.zeroBuf.totalEnvelopeDeficit,uncovEnv:R.zeroBuf.uncoveredDeficit,total:R.zeroBuf.totalUncoveredDeficit},
      negBufNoEnv:{rawBuf:R.negBufNoEnv.rawBuffer,avail:R.negBufNoEnv.availableBuffer,bufDef:R.negBufNoEnv.bufferDeficit,envDef:R.negBufNoEnv.totalEnvelopeDeficit,total:R.negBufNoEnv.totalUncoveredDeficit},
      negBufNegEnv:{rawBuf:R.negBufNegEnv.rawBuffer,avail:R.negBufNegEnv.availableBuffer,bufDef:R.negBufNegEnv.bufferDeficit,envDef:R.negBufNegEnv.totalEnvelopeDeficit,used:R.negBufNegEnv.contingencyUsed,uncovEnv:R.negBufNegEnv.uncoveredDeficit,total:R.negBufNegEnv.totalUncoveredDeficit},
      multiNegBuf:{rawBuf:R.multiNegBuf.rawBuffer,bufDef:R.multiNegBuf.bufferDeficit,envDef:R.multiNegBuf.totalEnvelopeDeficit},
      netPos:{rawBuf:R.netPos.rawBuffer,avail:R.netPos.availableBuffer,bufDef:R.netPos.bufferDeficit},
      netNeg:{rawBuf:R.netNeg.rawBuffer,avail:R.netNeg.availableBuffer,bufDef:R.netNeg.bufferDeficit},
      exactZero:{rawBuf:R.exactZero.rawBuffer,avail:R.exactZero.availableBuffer,bufDef:R.exactZero.bufferDeficit}
    };
  });

  ck('no deficit → nothing used, nothing uncovered, full buffer available', near(res.none.used,0)&&near(res.none.unc,0)&&near(res.none.avail,1400)&&near(res.none.def,0), JSON.stringify(res.none));
  ck('deficit < contingency → fully covered, $0 uncovered, remainder available', near(res.lt.def,700)&&near(res.lt.used,700)&&near(res.lt.unc,0)&&near(res.lt.avail,700), JSON.stringify(res.lt));
  ck('deficit == contingency → fully covered, $0 uncovered, $0 available', near(res.eq.used,700)&&near(res.eq.unc,0)&&near(res.eq.avail,0), JSON.stringify(res.eq));
  ck('deficit > contingency → covers only what it has, rest uncovered', near(res.gt.used,560)&&near(res.gt.unc,2240)&&near(res.gt.avail,0), JSON.stringify(res.gt));
  ck('raw negative balance is PRESERVED (Kids still −$2,800), coverage sits on top', near(res.gt.kidsRaw,-2800)&&near(res.gt.kidsCov,560)&&near(res.gt.kidsUnc,2240), JSON.stringify(res.gt));
  ck('multiple negatives: per-envelope coverage reconciles EXACTLY to contingencyUsed', near(res.multi.used,2100)&&near(res.multi.sumCov,2100), JSON.stringify(res.multi));
  ck('multiple negatives: proportional split (Kids 2800/3500 of 2100 = $1,680; Pets $420)', near(res.multi.kidsCov,1680)&&near(res.multi.petsCov,420), JSON.stringify(res.multi));
  ck('negative raw buffer → $0 available, $0 used, deficit fully uncovered (never "negative coverage")', near(res.negbuf.raw,-1400)&&near(res.negbuf.avail,0)&&near(res.negbuf.used,0)&&near(res.negbuf.unc,700), JSON.stringify(res.negbuf));
  ck('positive envelopes are untouched by coverage (Home stays positive, $0 covered)', res.mixed.homeRaw>0.005&&near(res.mixed.homeCov,0), JSON.stringify(res.mixed));
  ck('cent rounding: per-envelope coverage still sums EXACTLY to contingencyUsed', near(res.cents.used,700)&&near(res.cents.sumCov,700), JSON.stringify(res.cents));
  ck('prior-year carry-in lifts the raw balance out of deficit (no coverage needed)', near(res.carry.kidsRaw,300)&&near(res.carry.def,0)&&near(res.carry.used,0), JSON.stringify(res.carry));
  ck('coverage never changes net worth or raw balances (read-only allocation, $8,000 unchanged)', res.untouched===true, String(res.untouched));
  // ---- buffer-deficit semantics ----
  ck('zero buffer + negative envelope: $0 available, $0 buffer deficit, envelope uncovered', near(res.zeroBuf.rawBuf,0)&&near(res.zeroBuf.avail,0)&&near(res.zeroBuf.bufDef,0)&&near(res.zeroBuf.uncovEnv,700)&&near(res.zeroBuf.total,700), JSON.stringify(res.zeroBuf));
  ck('negative buffer + NO negative envelopes: buffer deficit stands alone as the total shortfall', near(res.negBufNoEnv.rawBuf,-1000)&&near(res.negBufNoEnv.avail,0)&&near(res.negBufNoEnv.bufDef,1000)&&near(res.negBufNoEnv.envDef,0)&&near(res.negBufNoEnv.total,1000), JSON.stringify(res.negBufNoEnv));
  ck('CANONICAL: −$1,000 buffer + −$2,000 Kids → $0 coverage, $2,000 uncovered env, $1,000 buffer deficit, $3,000 total', near(res.negBufNegEnv.avail,0)&&near(res.negBufNegEnv.used,0)&&near(res.negBufNegEnv.uncovEnv,2000)&&near(res.negBufNegEnv.bufDef,1000)&&near(res.negBufNegEnv.total,3000), JSON.stringify(res.negBufNegEnv));
  ck('no double-count: the negative buffer category is NOT in envelopeDeficit (2,000, not 3,000)', near(res.negBufNegEnv.envDef,2000), JSON.stringify(res.negBufNegEnv));
  ck('multiple negative buffer categories POOL first (−600 + −400 = −$1,000 raw, $1,000 buffer deficit)', near(res.multiNegBuf.rawBuf,-1000)&&near(res.multiNegBuf.bufDef,1000)&&near(res.multiNegBuf.envDef,700), JSON.stringify(res.multiNegBuf));
  ck('pos + neg buffer categories NET POSITIVE (+2,000 & −500 → +$1,500 available, $0 deficit)', near(res.netPos.rawBuf,1500)&&near(res.netPos.avail,1500)&&near(res.netPos.bufDef,0), JSON.stringify(res.netPos));
  ck('pos + neg buffer categories NET NEGATIVE (+300 & −800 → −$500, $0 available, $500 deficit)', near(res.netNeg.rawBuf,-500)&&near(res.netNeg.avail,0)&&near(res.netNeg.bufDef,500), JSON.stringify(res.netNeg));
  ck('exact-zero net buffer (+500 & −500 → $0 available, $0 deficit)', near(res.exactZero.rawBuf,0)&&near(res.exactZero.avail,0)&&near(res.exactZero.bufDef,0), JSON.stringify(res.exactZero));
  ck('total always reconciles: totalUncovered = uncoveredEnvelope + bufferDeficit', near(res.negBufNegEnv.total,res.negBufNegEnv.uncovEnv+res.negBufNegEnv.bufDef), JSON.stringify(res.negBufNegEnv));
  // ---- Wren distinguishes the four questions ----
  ck('Wren "how much contingency do I have?" → $0 available (pool overspent)', /\$0 available in contingency|\$0\.00 of contingency available|no contingency/i.test(res.wren.have)&&/overspent by|pool is overspent/.test(res.wren.have)&&!/3,000|2,000/.test(res.wren.have), res.wren.have);
  ck('Wren "is my contingency overspent?" → yes, buffer deficit $1,000', /overspent by \$1,000\.00|overspent.*\$1,000/i.test(res.wren.overspent), res.wren.overspent);
  ck('Wren "how much of my envelopes isn\'t covered?" → $2,000 (envelope-only)', /\$2,000\.00/.test(res.wren.envUncov), res.wren.envUncov);
  ck('Wren "rollover shortfall altogether?" → $3,000 total (envelopes + buffer)', /\$3,000\.00/.test(res.wren.total), res.wren.total);

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

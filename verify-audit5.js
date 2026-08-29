/* Verify the selectable-months + rollover-start batch: (A) recurring what-ifs scoped to chosen months; (B) mid-year
   AnnualSaveUp spreads from its start month; (C) per-category rollover start doesn't retroactively bank; (D) annual-bill
   catch-up uses inclusive (current→due) periods, matching goals. */
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
  await page.waitForFunction(()=>typeof evaluateDecision==='function'&&typeof billMonths==='function'&&typeof rollStartFloor==='function'&&typeof computeRollover==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth();window.isGoalName=()=>false;var sum=function(a){return Math.round(a.reduce(function(s,v){return s+v;},0)*100)/100;};

    // ---- (A) Decision Engine selectable months ----
    state.meta={startCash:15000,floor:0,cats:{},cons:{},goals:[]};
    state.cons=[{name:'Job',bud12:Array(12).fill(5000)}];
    state.cats=[{name:'Living',bud12:Array(12).fill(3500)}];
    state.goals=[];state.assets=[];state.debts=[];state.rows=[];
    for(var m=1;m<Math.max(2,M);m++){state.rows.push([Y,m,Y+'-0'+m+'-01','Me','Deposit','Job',5000,'','N']);state.rows.push([Y,m,Y+'-0'+m+'-02','Me','Living','X',3500,'','N']);}
    var base=evaluateDecision([]).before;
    var allYear=evaluateDecision({type:"expenseMonthly",amount:700});               // ongoing = steady-state ×12
    var q4=evaluateDecision({type:"expenseMonthly",amount:700,months:[10,11,12]});   // Oct-Dec = ×3
    var scopeOk=Math.abs(allYear.after.surplus-(base.surplus-8400))<0.5 && Math.abs(q4.after.surplus-(base.surplus-2100))<0.5;
    var narr=wrenDecisionMsg(q4);var narrOk=/Counted from October through December/.test(narr)&&/3 months/.test(narr);

    // ---- (B) mid-year AnnualSaveUp ----
    var janStart=billMonths([{name:'Ins',amount:1200,cadence:'AnnualSaveUp',month:12}]);          // Jan–Dec
    var augStart=billMonths([{name:'Ins',amount:1200,cadence:'AnnualSaveUp',month:12,start:8}]);   // Aug–Dec
    var saveOk=sum(janStart)===1200&&sum(augStart)===1200&&janStart[0]===100&&augStart[0]===0&&augStart[7]===240&&augStart[11]===240;

    // ---- (C) per-category rollover start ----
    window.budYear=0;state.meta.startYM=Y*100+1;state.carryIn={};state.spend={};
    state.meta.cats={dining:{type:'itemized'}};  // placeholder; we test the floor helper + catBalance directly
    var cat={name:'Dining',bud12:Array(12).fill(100)};
    var noStart=catBalance(cat);                                    // no rollStart → banks Jan..last-completed
    state.meta.cats={dining:{roll:'envelope',rollStart:Y*100+8}};   // became an envelope in August this year
    var withStart=catBalance(cat);                                  // must NOT retroactively bank Jan–Jul
    var floorOk=rollStartFloor('Dining',Y)===8 && rollStartFloor('Dining',Y-1)===13 && rollStartFloor('Dining',Y+1)===1;
    var rollOk=floorOk && withStart===0 && noStart>withStart;

    // ---- (D) inclusive catch-up denominator ----
    state.meta.cats={insurance:{type:'itemized',roll:'envelope',items:[{name:'Auto',amount:1200,cadence:'AnnualSaveUp',month:12}]}};
    state.cats=[{name:'Insurance',bud12:billMonths(state.meta.cats.insurance.items),annual:1200}];
    state.carryIn={};state.spend={};               // banks Jan–Jul budget → a positive gap remains toward the December bill
    var roll=computeRollover(),env=roll.envelopes.filter(function(e){return e.name==='Insurance';})[0];
    var mu=12-M, inclusive=mu+1;                    // current month through December, inclusive
    var expected=Math.round((env&&env.upc?env.upc.gap:0)/inclusive*100)/100;
    var denomOk=env&&env.upc&&env.upc.gap>0.5&&Math.abs(env.upc.perMonth-expected)<0.02&&env.upc.monthsUntil===mu;

    return {scopeOk,narrOk,saveOk,janStart,augStart,floorOk,noStart,withStart,rollOk,denomOk,gap:env&&env.upc&&env.upc.gap,perMonth:env&&env.upc&&env.upc.perMonth,inclusive};
  });

  ck('recurring what-if: all-year = ×12 ($8,400); Oct–Dec scope = ×3 ($2,100)', res.scopeOk, String(res.scopeOk));
  ck('Wren narrates the month scope ("Counted from October through December · 3 months")', res.narrOk, String(res.narrOk));
  ck('mid-year AnnualSaveUp spreads Aug–Dec ($240×5=$1,200), not Jan–Dec ($100×12)', res.saveOk, JSON.stringify({aug:res.augStart}));
  ck('rollStartFloor: 8 this year, 13 before it existed, 1 in established years', res.floorOk, String(res.floorOk));
  ck('a category made an envelope in August does NOT retroactively bank Jan–Jul', res.rollOk, JSON.stringify({noStart:res.noStart,withStart:res.withStart}));
  ck('annual-bill catch-up uses inclusive (current→due) periods, matching goals', res.denomOk, JSON.stringify({perMonth:res.perMonth,inclusive:res.inclusive}));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

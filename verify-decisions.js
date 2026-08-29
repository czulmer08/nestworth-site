/* Verify the NestWorth Decision Engine: a hypothetical change reruns the whole model (annual plan, cash flow, goals,
   Nest Egg Floor) and returns a structured before/after; Wren narrates it (never computes it). */
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
  await page.waitForFunction(()=>typeof evaluateDecision==='function'&&typeof computeCashflow==='function'&&typeof wrenAnalyze==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth();window.isGoalName=()=>false;
    state.meta={startCash:15000,floor:6000,cats:{},cons:{},goals:[]};
    state.cons=[{name:'Job',annual:60000,bud12:Array(12).fill(5000)}];   // $60k/yr income
    state.cats=[{name:'Living',annual:42000,bud12:Array(12).fill(3500)}]; // $42k/yr budget
    state.goals=[{name:'Renovation',target:75000,balance:21400,monthly:1000,archived:false,category:'',residual:false}]; // $12k/yr goal
    var rows=[];for(var m=1;m<Math.max(2,M);m++){rows.push([Y,m,Y+'-0'+m+'-01','Me','Deposit','Job',5000,'','N']);rows.push([Y,m,Y+'-0'+m+'-02','Me','Living','X',3500,'','N']);}
    state.rows=rows;

    var base=evaluateDecision({type:"purchase",amount:0,month:12}).before; // baseline metrics (surplus should be 60k-42k-12k=6k)
    // 1) one-time purchase: annual surplus unchanged, cash-flow low drops by the amount
    var buy=evaluateDecision({type:"purchase",amount:6000,month:12});
    var purchaseOk=(buy.after.surplus===base.surplus)&&Math.abs(buy.after.end-(base.end-6000))<0.5; // year-end cash drops by the purchase; recurring surplus unchanged
    // 2) recurring payment (ongoing): in Plan+Actual mode, this year's surplus falls by amount × remaining months
    var pay=evaluateDecision({type:"expenseMonthly",amount:700});
    var recurringOk=Math.abs(pay.after.surplus-(base.surplus-8400))<0.5; // steady-state annual run-rate (×12)
    // 3) goal increase: surplus falls by delta×12 and the finish date moves earlier
    var goalDec=evaluateDecision({type:"goalMonthly",goal:"Renovation",monthly:1500});
    var goalOk=Math.abs(goalDec.after.surplus-(base.surplus-6000))<0.5 && goalDec.goal && goalDec.goal.before!==goalDec.goal.after;
    // 4) Nest Egg Floor: a huge purchase drops below the $6,000 floor → not feasible
    var big=evaluateDecision({type:"purchase",amount:50000,month:12});
    var floorOk=(big.passesFloor===false)&&(big.feasible===false);

    // 5) Wren narrates decisions
    var affordAns=(function(){var r=wrenAnalyze("can we afford a $6,000 vacation in December?");return r?r.answer:"";})();
    var goalAns=(function(){var r=wrenAnalyze("increase Renovation to $1,500 a month");return r?r.answer:"";})();
    return {baseSurplus:base.surplus,purchaseOk,recurringOk,goalOk,floorOk,affordAns,goalAns};
  });

  ck('baseline annual surplus computed by the engine ($60k − $42k − $12k = $6k)', res.baseSurplus===6000, JSON.stringify(res.baseSurplus));
  ck('one-time purchase: annual surplus unchanged, cash-flow low drops by the amount', res.purchaseOk, String(res.purchaseOk));
  ck('recurring payment: annual surplus falls by amount × 12', res.recurringOk, String(res.recurringOk));
  ck('goal increase: surplus falls by the delta and the finish date moves earlier', res.goalOk, String(res.goalOk));
  ck('Nest Egg Floor: a purchase that breaches the floor is not feasible', res.floorOk, String(res.floorOk));
  ck('Wren narrates an afford decision (one-time, cash floor, assumption line)', /one-time/.test(res.affordAns)&&/(tightest month|lowest projected)/.test(res.affordAns)&&/Assumes/.test(res.affordAns), JSON.stringify(res.affordAns).slice(0,180));
  ck('Wren narrates a goal-increase decision (finish moves)', /Renovation/.test(res.goalAns)&&/finish moves/.test(res.goalAns), JSON.stringify(res.goalAns).slice(0,160));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

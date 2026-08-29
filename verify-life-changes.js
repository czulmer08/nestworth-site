/* Verify Life Changes: evaluateDecision accepts a BATCH of changes (a life event composes several at once), and the
   net-worth trajectory behaves correctly — a purchase/recurring cost lowers year-end net worth, accelerating a goal does not. */
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
  await page.waitForFunction(()=>typeof evaluateDecision==='function'&&typeof computeNetWorthTrajectory==='function'&&typeof netWorthNow==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth();window.isGoalName=()=>false;
    state.meta={startCash:15000,floor:0,cats:{},cons:{},goals:[]};
    state.cons=[{name:'Job',annual:60000,bud12:Array(12).fill(5000)}];
    state.cats=[{name:'Living',annual:42000,bud12:Array(12).fill(3500)}];
    state.goals=[{name:'Renovation',target:75000,balance:21400,monthly:1000,archived:false,category:'',residual:false}];
    state.assets=[{name:'Checking',bal:15000},{name:'401k',bal:80000}];
    state.debts=[{name:'Card',bal:5000}];
    var rows=[];for(var m=1;m<Math.max(2,M);m++){rows.push([Y,m,Y+'-0'+m+'-01','Me','Deposit','Job',5000,'','N']);rows.push([Y,m,Y+'-0'+m+'-02','Me','Living','X',3500,'','N']);}
    state.rows=rows;
    var rem=12-M+1; // remaining months incl current (current-month blend contributes a full plan month)

    var nw=netWorthNow(); // 15000+80000 assets + 21400 stand-alone goal − 5000 debt = 111400
    var base=evaluateDecision([]).before; // empty batch → pure baseline

    // 1) a single change passed as an array behaves identically to passing it bare
    var arr=evaluateDecision([{type:'expenseMonthly',amount:700}]);
    var bare=evaluateDecision({type:'expenseMonthly',amount:700});
    var arrayEqualsBare=Math.abs(arr.after.surplus-bare.after.surplus)<0.5&&Math.abs(arr.after.end-bare.after.end)<0.5&&arr.batch===true&&bare.batch===false;

    // 2) baby batch: new monthly cost + one-time upfront + income drop, all in ONE scenario
    var baby=evaluateDecision([{type:'expenseMonthly',amount:1600},{type:'purchase',amount:3000,month:M,from:'cash'},{type:'income',amount:-1200}]);
    // Plan+Actual: this year's surplus falls by (new cost + income drop) × remaining months (the one-time upfront doesn't touch recurring surplus)
    var babySurplus=Math.abs(baby.after.surplus-(base.surplus-33600))<1; // steady-state ×12: (1600+1200)×12
    var babyBatch=baby.batch===true&&baby.changes.length===3;

    // 3) net worth NOW is read from live accounts
    var nwNowOk=(nw===111400)&&(base.netNow===111400);
    // 4) a one-time purchase lowers year-end net worth by exactly the amount
    var buy=evaluateDecision({type:'purchase',amount:6000,month:12});
    var nwPurchase=Math.abs(buy.after.netEnd-(base.netEnd-6000))<0.5;
    // 5) a recurring cost lowers year-end net worth by amount × remaining months
    var pay=evaluateDecision({type:'expenseMonthly',amount:500});
    var nwRecurring=Math.abs(pay.after.netEnd-(base.netEnd-500*rem))<0.5;
    // 6) accelerating a GOAL leaves year-end net worth unchanged (the money is still yours, just parked in the goal)
    var goalDec=evaluateDecision({type:'goalMonthly',goal:'Renovation',monthly:2000});
    var nwGoalFlat=Math.abs(goalDec.after.netEnd-base.netEnd)<0.5 && goalDec.after.low<base.low+0.5; // but cash DOES tighten

    return {arrayEqualsBare,babySurplus,babyBatch,nwNowOk,nwPurchase,nwRecurring:nwRecurring,nwGoalFlat,rem,baseNet:base.netEnd,baseSurplus:base.surplus};
  });

  ck('a single change wrapped in an array matches the bare call (batch flag aside)', res.arrayEqualsBare, String(res.arrayEqualsBare));
  ck('a baby batch runs three changes as one scenario', res.babyBatch, String(res.babyBatch));
  ck('baby batch surplus = base − (monthly cost + income drop)×12 (one-time excluded)', res.babySurplus, String(res.babySurplus));
  ck('net worth now is read from live accounts (assets + standalone goal − debt = $111,400)', res.nwNowOk, String(res.nwNowOk));
  ck('a one-time purchase lowers year-end net worth by exactly the amount', res.nwPurchase, String(res.nwPurchase));
  ck('a recurring cost lowers year-end net worth by amount × remaining months', res.nwRecurring, String(res.nwRecurring));
  ck('accelerating a goal leaves year-end net worth flat but tightens cash', res.nwGoalFlat, String(res.nwGoalFlat));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

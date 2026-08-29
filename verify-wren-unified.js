/* Verify Wren now consumes the shared engines: one year-end projection (no mid-year inflation) shared with Insights;
   "find money" reserves goal commitments; residual goals sum exactly to the pool; detectCadence survives _spread rounding. */
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
  await page.waitForFunction(()=>typeof yearEndSpendProjection==='function'&&typeof detectCadence==='function'&&typeof computeResidual==='function'&&typeof wrenAnalyze==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth();window.isGoalName=(n)=>((""+n).trim().toLowerCase()==='vacation');state.goalSet={vacation:1};

    // 1) year-end projection: a MID-YEAR adopter who only spent in the current month
    state.rows=[[Y,M,Y+'-0'+M+'-01','Me','Groceries','X',3000,'','N']];
    state.cats=[{name:'Groceries',annual:0,mbud:0,mspent:0,bud12:Array(12).fill(0)}];state.cons=[];state.goals=[];
    var yp=yearEndSpendProjection();
    var rem=Math.max(0,12-M);
    var projOk=Math.abs(yp.proj-(3000+3000*rem))<0.5 && yp.active===1;   // active-month avg, NOT 3000 ÷ fraction-of-year

    // 2) Wren's year-end forecast uses the SAME projection (not YTD ÷ calendar fraction)
    var wr=wrenAnalyze("where will we end the year?");
    var wrenYearOk=wr && wr.answer.indexOf('$'+(3000+3000*rem).toLocaleString(undefined,{minimumFractionDigits:2}))>=0;

    // 3) "find money" reserves an unfunded goal commitment
    state.rows=[[Y,M,Y+'-0'+M+'-01','Me','Deposit','Job',5000,'','N'],[Y,M,Y+'-0'+M+'-02','Me','Groceries','X',1000,'','N']];
    state.cats=[{name:'Groceries',annual:36000,mbud:2000,mspent:1000,bud12:Array(12).fill(2000)}];
    state.cons=[{name:'Job',annual:60000,bud12:Array(12).fill(5000)}];
    state.goals=[{name:'Vacation',monthly:800,balance:0,target:6000,archived:false,category:'',residual:false,account:''}]; // $800 planned, $0 contributed so far
    var fm=wrenAnalyze("find money");
    // income 5000 − spent 1000 = 4000; committed = remaining Groceries (1000) + remaining goal (800) = 1800; uncommitted ≈ 2200
    var findOk=fm && /going to your goals/.test(fm.answer) && fm.answer.indexOf('$2,200.00')>=0;

    // 4) residual goals sum EXACTLY to the pool
    state.cons=[{name:'Job',annual:120000,bud12:Array(12).fill(10000)}];
    state.cats=[{name:'Living',annual:118800,bud12:Array(12).fill(9900)}]; // income−budget = 1200/yr → pool 100/mo
    state.goals=[{name:'A',residual:true,archived:false,balance:0,target:0,residualPct:0},{name:'B',residual:true,archived:false,balance:0,target:0,residualPct:0},{name:'C',residual:true,archived:false,balance:0,target:0,residualPct:0}];
    var cr=computeResidual(),poolSum=Math.round(cr.goals.reduce(function(s,g){return s+g._resMo;},0)*100)/100;
    var residOk=cr.pool===100&&poolSum===100&&cr.goals.length===3;

    // 5) detectCadence survives _spread rounding + mid-year blocks
    var s3=_spread(1000,[0,1,2]);                 // 333.33 / 333.33 / 333.34 → AnnualSaveUp, $1,000, due March
    var d3=detectCadence(s3);
    var sMid=_spread(1200,[7,8,9,10,11]);          // Aug–Dec → AnnualSaveUp, $1,200, due Dec, start Aug
    var dMid=detectCadence(sMid);
    var cadOk=d3.cadence==='AnnualSaveUp'&&Math.abs(d3.amount-1000)<0.5&&d3.month===3
             &&dMid.cadence==='AnnualSaveUp'&&Math.abs(dMid.amount-1200)<0.5&&dMid.month===12&&dMid.start===8;

    return {projOk,yp,wrenYearOk,wrAns:wr&&wr.answer,findOk,fmAns:fm&&fm.answer,residOk,pool:cr.pool,poolSum,cadOk,d3,dMid};
  });

  ck('year-end projection averages ACTIVE months (no mid-year YTD÷fraction inflation)', res.projOk, JSON.stringify(res.yp));
  ck('Wren\'s year-end forecast uses the shared projection', res.wrenYearOk, JSON.stringify(res.wrAns).slice(0,140));
  ck('"find money" reserves an unfunded goal commitment (uncommitted = $2,200)', res.findOk, JSON.stringify(res.fmAns).slice(0,180));
  ck('residual goals sum to EXACTLY the pool ($100)', res.residOk, JSON.stringify({pool:res.pool,sum:res.poolSum}));
  ck('detectCadence recognizes _spread blocks (Jan-start and mid-year) as AnnualSaveUp', res.cadOk, JSON.stringify({d3:res.d3,dMid:res.dMid}));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

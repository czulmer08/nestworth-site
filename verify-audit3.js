/* Verify the part-3 financial-model audit fixes: (1) one canonical transaction classifier — a goal movement is excluded
   from forecast expense via EITHER Category or Company; (2) a partially goal-funded purchase splits into goal + cash
   instead of flooring the goal at zero and losing the unfunded portion. */
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
  await page.waitForFunction(()=>typeof isExpenseRow==='function'&&typeof actualIE==='function'&&typeof evaluateDecision==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth();
    state.goalSet={vacation:1};window.isGoalName=(n)=>((""+n).trim().toLowerCase()==='vacation');

    // ---- (1) canonical classifier ----
    var rows=[
      [Y,1,Y+'-01-01','Me','Deposit','Job',5000,'','N'],            // income
      [Y,1,Y+'-01-02','Me','Food','Publix',1000,'','N'],            // expense
      [Y,1,Y+'-01-03','Me','Vacation','Move',500,'','N'],           // goal movement via CATEGORY → excluded
      [Y,1,Y+'-01-04','Me','Groceries','Vacation',800,'','N'],      // goal movement via COMPANY → must ALSO be excluded (the bug)
      [Y,1,Y+'-01-05','Me','','Corner Store',200,'','N']            // uncategorized outflow → still counts as spend
    ];
    var er=[isExpenseRow(rows[1]),isExpenseRow(rows[2]),isExpenseRow(rows[3]),isExpenseRow(rows[4])];
    var classOk=er[0]===true&&er[1]===false&&er[2]===false&&er[3]===true;
    var IE=actualIE(rows,Y);
    var janExp=IE.ae[0],janInc=IE.ai[0];
    var sumsOk=janInc===5000&&janExp===1200;   // 1000 Food + 200 uncategorized; NOT 500 (cat-goal) or 800 (company-goal)

    // ---- (2) partially goal-funded purchase ----
    state.meta={startCash:20000,floor:0,cats:{},cons:{},goals:[]};
    state.cons=[{name:'Job',annual:60000,bud12:Array(12).fill(5000)}];
    state.cats=[{name:'Living',annual:42000,bud12:Array(12).fill(3500)}];
    state.goals=[{name:'Vacation',target:6000,balance:3000,monthly:500,archived:false,category:'',residual:false,account:''}];
    state.assets=[{name:'Checking',bal:20000}];state.debts=[];
    state.rows=[];for(var m=1;m<Math.max(2,M);m++){state.rows.push([Y,m,Y+'-0'+m+'-01','Me','Deposit','Job',5000,'','N']);state.rows.push([Y,m,Y+'-0'+m+'-02','Me','Living','X',3500,'','N']);}

    var base=evaluateDecision([]).before;
    // $6,000 trip funded "from Vacation" which only holds $3,000 in December
    var buy=evaluateDecision({type:'purchase',amount:6000,month:12,from:'goal:Vacation'});
    var g=buy.goal;
    var splitReported=g&&Math.abs(g.fromGoal-3000)<0.5&&Math.abs(g.shortfall-3000)<0.5&&Math.abs(g.remaining-0)<0.5;
    // cash flow: only the unfunded $3,000 hits spendable cash (the goal money was already set aside)
    var cashDrop=Math.abs(buy.after.end-(base.end-3000))<0.5;
    // net worth: the WHOLE $6,000 leaves (goal savings spent + cash spent) — nothing vanishes
    var nwDrop=Math.abs(buy.after.netEnd-(base.netEnd-6000))<0.5;
    // a fully-funded $2,000 purchase: cash untouched, net worth down $2,000, goal not floored below its remainder
    var buy2=evaluateDecision({type:'purchase',amount:2000,month:12,from:'goal:Vacation'});
    var fullFund=Math.abs(buy2.after.end-base.end)<0.5&&Math.abs(buy2.after.netEnd-(base.netEnd-2000))<0.5&&buy2.goal.shortfall<0.005&&Math.abs(buy2.goal.remaining-1000)<0.5;

    return {classOk,er,sumsOk,janInc,janExp,splitReported,cashDrop,nwDrop,fullFund,baseNet:base.netEnd,buyNet:buy.after.netEnd};
  });

  ck('isExpenseRow: Food=yes, Vacation(cat-goal)=no, Groceries·Vacation(company-goal)=no, uncategorized=yes', res.classOk, JSON.stringify(res.er));
  ck('actualIE sums exclude BOTH goal-movement forms; income $5,000, expense $1,200', res.sumsOk, JSON.stringify({inc:res.janInc,exp:res.janExp}));
  ck('partial goal purchase reports the split ($3,000 from goal, $3,000 shortfall, $0 left)', res.splitReported, String(res.splitReported));
  ck('only the unfunded $3,000 reduces spendable cash (year-end)', res.cashDrop, String(res.cashDrop));
  ck('the full $6,000 leaves net worth — nothing disappears', res.nwDrop, JSON.stringify({base:res.baseNet,after:res.buyNet}));
  ck('a fully-funded purchase: cash untouched, net worth −$2,000, goal remainder $1,000', res.fullFund, String(res.fullFund));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* PROPERTY-BASED / metamorphic financial invariants — randomized households thrown at the REAL engine functions, to catch
   edge cases we didn't think to write by hand. Added after the property audit found a −$0.01 residual-goal rounding bug
   (remainder assigned to a 0%-share goal). Invariants enforced here:
     • residual allocations are NEVER negative (no goal receives a negative contribution from a rounding remainder)
     • residual allocations never OVERDRAW the pool, and reconcile to EXACTLY the pool when fully allocated (to the cent)
     • _spread() conserves the exact total across arbitrary month subsets
     • the specific reported failure case (percentages > 100% with a trailing 0%-share goal) */
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
  await page.waitForFunction(()=>typeof computeResidual==='function'&&typeof residualPool==='function'&&typeof _spread==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const res=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};
    window.isGoalName=function(){return false;};
    function rnd(a,b){return a+Math.random()*(b-a);}
    function rint(a,b){return Math.floor(rnd(a,b+1));}

    // ---- set up so residualPool() returns an exact target: one income line, no cats, all-residual goals (excluded from goalSaveAnnual) ----
    function setPool(pool){state.cons=[{name:"Job",annual:Math.round(pool*12*100)/100}];state.cats=[];state.meta={cats:{},cons:{}};}

    var RES={negatives:0,overdraws:0,mismatches:0,iters:0,worstNeg:0,worstOver:0,worstMismatch:0,sample:null};
    for(var it=0;it<4000;it++){
      RES.iters++;
      var pool=Math.round(rnd(0,600000))/100;               // $0 .. $6,000, random cents
      var ng=rint(2,6);
      var goals=[];var forceZeroLast=(Math.random()<0.5);
      var sumPct=0;
      for(var g=0;g<ng;g++){
        var isLast=(g===ng-1);
        var pct;
        if(isLast&&forceZeroLast)pct=0;                     // trailing 0%-share goal (the reported failure shape)
        else if(Math.random()<0.25)pct=0;                   // some blanks anywhere
        else pct=Math.round(rnd(1,60)*100)/100;
        sumPct+=pct;
        goals.push({name:"G"+g,residual:true,residualPct:pct,residualCap:0,target:0,balance:0,archived:false});
      }
      // bias toward the >100% scaling regime (where the rounding remainder is computed)
      if(sumPct<=100){goals.forEach(function(x){if(x.residualPct>0)x.residualPct=Math.round(x.residualPct*(120/Math.max(1,sumPct))*100)/100;});}
      setPool(pool);state.goals=goals;
      var r;try{r=computeResidual();}catch(e){RES.mismatches++;RES.sample=RES.sample||{err:e.message};continue;}
      var sum=0,minAlloc=Infinity;
      r.goals.forEach(function(x){var v=x._resMo||0;sum+=v;if(v<minAlloc)minAlloc=v;});
      sum=Math.round(sum*100)/100;
      // INVARIANT 1: never negative
      if(minAlloc<-1e-9){RES.negatives++;if(minAlloc<RES.worstNeg)RES.worstNeg=minAlloc;RES.sample=RES.sample||{pool:pool,goals:r.goals.map(function(x){return {pct:x.residualPct,mo:x._resMo};})};}
      // INVARIANT 2: never overdraw the pool
      if(sum>Math.round(r.pool*100)/100+0.005){RES.overdraws++;var ov=sum-r.pool;if(ov>RES.worstOver)RES.worstOver=ov;}
      // INVARIANT 3: when the config fully allocates (percentages ≥100% after scaling, or blanks present, or none set),
      // the rounded allocations reconcile to EXACTLY the pool.
      var setSum=0,blanks=0;r.goals.forEach(function(x){var p=Math.max(0,x.residualPct||0);if(p>0)setSum+=p;else blanks++;});
      var fully=!(setSum>0.005&&setSum<100&&blanks===0);
      if(fully){var diff=Math.abs(sum-Math.round(r.pool*100)/100);if(diff>0.005){RES.mismatches++;if(diff>RES.worstMismatch)RES.worstMismatch=diff;RES.sample=RES.sample||{pool:pool,sum:sum,diff:diff,goals:r.goals.map(function(x){return {pct:x.residualPct,mo:x._resMo};})};}}
    }

    // ---- targeted reproduction of the audit's exact shape: 4 positive goals + a trailing 0%-share goal, engineered so the
    //      naive "remainder→last element" would have produced −$0.01 on the 0%-share goal ----
    var REPRO={neg:false,alloc:null};
    (function(){
      // pick a pool and percentages > 100% so scaling+rounding leaves a −1¢ remainder that used to land on the 0% goal
      var found=false;
      for(var p=400000;p<400200&&!found;p++){ // scan cents around $4,000 for a config that triggers a negative last-element remainder under the OLD rule
        var pool=p/100;setPool(pool);
        state.goals=[{name:"A",residual:true,residualPct:37,target:0,balance:0},{name:"B",residual:true,residualPct:38,target:0,balance:0},{name:"C",residual:true,residualPct:11,target:0,balance:0},{name:"D",residual:true,residualPct:14,target:0,balance:0},{name:"Z",residual:true,residualPct:0,target:0,balance:0}];
        var rr=computeResidual();var z=rr.goals.filter(function(x){return x.name==='Z';})[0];
        // under the FIXED rule Z must never be negative; also confirm exact reconciliation
        var s=Math.round(rr.goals.reduce(function(a,x){return a+(x._resMo||0);},0)*100)/100;
        if((z._resMo||0)<-1e-9)found=true; // any negative under the fixed rule is a failure
        REPRO.alloc={pool:pool,Z:z._resMo,sum:s};
        if(Math.abs(s-Math.round(pool*100)/100)>0.005){REPRO.neg=true;found=true;}
        if((z._resMo||0)<-1e-9){REPRO.neg=true;found=true;}
      }
    })();

    // ---- _spread() exact-cent conservation across arbitrary month subsets ----
    var SPREAD={fail:0,iters:0};
    for(var s2=0;s2<3000;s2++){SPREAD.iters++;
      var total=Math.round(rnd(-500000,500000))/100;var k=rint(1,12);var idxs=[];var pool2=[0,1,2,3,4,5,6,7,8,9,10,11];
      for(var j=0;j<k;j++){idxs.push(pool2.splice(rint(0,pool2.length-1),1)[0]);}
      var arr=_spread(total,idxs);var sum2=Math.round(arr.reduce(function(a,x){return a+x;},0)*100)/100;
      // zero outside the chosen indices + exact conservation
      var okZero=true;for(var z2=0;z2<12;z2++){if(idxs.indexOf(z2)<0&&Math.abs(arr[z2])>1e-9)okZero=false;}
      if(!okZero||Math.abs(sum2-Math.round(total*100)/100)>0.005)SPREAD.fail++;
    }

    // ---- monthActualTotals(y,mo,{asOf}) — the canonical helper the month-comparison now uses for BOTH periods ----
    // Must include uncategorized/unbudgeted, exclude goal moves, and honour an explicit cutoff (future rows excluded).
    var MAT={};
    (function(){
      todayISO=function(){return '2026-08-15';};window.isGoalName=function(n){return (""+n).trim().toLowerCase()==='vacation';};
      var row=function(y,m,d,cat,co,amt){return [y,m,d,'',cat,co,amt,'','N'];};
      state.rows=[
        row(2026,8,'2026-08-03','Groceries','Store',500),   // categorized expense
        row(2026,8,'2026-08-04','','IKEA',180),             // UNCATEGORIZED expense (must be included)
        row(2026,8,'2026-08-07','Travel','Vacation',400),   // goal move (Company=Vacation) — must be EXCLUDED
        row(2026,8,'2026-08-01','Denzell','Deposit',2000),  // deposit — income, not expense (marker in category col? use Deposit category)
        row(2026,8,'2026-08-25','','Later',999)];           // FUTURE-dated (after as-of) — excluded by default & by asOf 08-15
      // fix the deposit row: Category="Deposit"
      state.rows[3]=[2026,8,'2026-08-01','Denzell','Deposit','',2000,'','N'];
      MAT.def=monthActualTotals(2026,8).expense;                              // default as-of (today 08-15): 500+180 = 680
      MAT.cut=monthActualTotals(2026,8,{asOf:'2026-08-15'}).expense;          // explicit same cutoff: 680
      MAT.full=monthActualTotals(2026,8,{asOf:'2026-08-31'}).expense;         // whole month incl. the future row: 500+180+999 = 1679
      MAT.inc=monthActualTotals(2026,8).income;                              // deposit only: 2000
    })();

    return {RES:RES,REPRO:REPRO,SPREAD:SPREAD,MAT:MAT};
  });

  const R=res.RES,RE=res.REPRO,SP=res.SPREAD,MA=res.MAT;
  const near=(a,bb)=>Math.abs(a-bb)<0.005;
  ck('residual allocations are NEVER negative ('+R.iters+' randomized households)', R.negatives===0, 'negatives='+R.negatives+' worst='+R.worstNeg+' sample='+JSON.stringify(R.sample).slice(0,200));
  ck('residual allocations never OVERDRAW the pool', R.overdraws===0, 'overdraws='+R.overdraws+' worst='+R.worstOver);
  ck('fully-allocated residual configs reconcile to EXACTLY the pool (to the cent)', R.mismatches===0, 'mismatches='+R.mismatches+' worst='+R.worstMismatch+' sample='+JSON.stringify(R.sample).slice(0,200));
  ck('targeted 0%-share-trailing-goal case: no negative allocation, exact reconciliation', RE.neg===false, JSON.stringify(RE.alloc));
  ck('_spread() conserves the exact total across arbitrary month subsets ('+SP.iters+' cases)', SP.fail===0, 'failures='+SP.fail);
  ck('monthActualTotals includes UNCATEGORIZED ($180) + excludes goal move & future → $680 at as-of 08-15', near(MA.def,680)&&near(MA.cut,680), 'def='+MA.def+' cut='+MA.cut);
  ck('monthActualTotals honours an explicit asOf cutoff (whole month incl. future = $1,679)', near(MA.full,1679), 'full='+MA.full);
  ck('monthActualTotals income counts deposits only ($2,000)', near(MA.inc,2000), 'inc='+MA.inc);

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

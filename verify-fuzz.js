/* FULL-ENGINE RANDOMIZED FUZZING — thousands of synthetic households thrown at the real engines, testing IDENTITIES rather
   than specific examples. If any identity ever breaks, it's a real model bug, whatever the household. Identities:
     • +$X recurring expense can NEVER improve cash flow (low or surplus)         • +$X income can NEVER worsen it
     • a goal-monthly increase lowers spendable cash but NEVER changes wealth (net-worth trajectory end)
     • Decision Engine "before" EXACTLY equals the live model (planMetrics(currentPlan))
     • moving money between tracked assets does NOT change net worth
     • changing a linked goal's balance does NOT change net worth (earmarked inside its account)
     • annual-plan identity: surplus === income − budget − goalSave (to the cent)
     • contingency: coverage ≤ availableBuffer, coverage ≤ envelopeDeficit, per-envelope reconciles to contingencyUsed,
       totalUncovered === uncoveredEnvelope + bufferDeficit, nothing ever negative or created */
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
  await page.waitForFunction(()=>typeof evaluateDecision==='function'&&typeof planMetrics==='function'&&typeof computeAnnualPlan==='function'&&typeof computeRollover==='function'&&typeof netWorthNow==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const res=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    function rnd(a,b){return a+Math.random()*(b-a);}function rint(a,b){return Math.floor(rnd(a,b+1));}
    function money(v){return Math.round(v*100)/100;}function fill12(f){var a=[];for(var i=0;i<12;i++)a.push(f(i));return a;}
    var GOALNAMES={};window.isGoalName=function(n){return !!GOALNAMES[(""+n).trim().toLowerCase()];};

    // ---- random VALID household ----
    function makeHousehold(){
      var nCon=rint(1,2),nCat=rint(1,4),nGoal=rint(0,3);
      var cons=[];for(var c=0;c<nCon;c++){var base=money(rnd(1000,6000));cons.push({name:"Inc"+c,annual:money(base*12),mtarget:base,bud12:fill12(function(){return money(rnd(base*0.8,base*1.2));})});}
      var cats=[];for(var k=0;k<nCat;k++){var bb=money(rnd(100,2500));cats.push({name:"Cat"+k,mbud:bb,mspent:0,mused:0,annual:money(bb*12),bud12:fill12(function(){return money(rnd(bb*0.7,bb*1.3));})});}
      GOALNAMES={};var goals=[];for(var g=0;g<nGoal;g++){var kind=rint(0,2),nm="Goal"+g;GOALNAMES[nm.toLowerCase()]=1;
        if(kind===0)goals.push({name:nm,target:money(rnd(1000,20000)),balance:money(rnd(0,5000)),monthly:money(rnd(50,600)),residual:false,archived:false,account:(Math.random()<0.4?("Inc0"):"")});// fixed (maybe accounted)
        else if(kind===1&&cats.length)goals.push({name:nm,target:money(rnd(1000,20000)),balance:money(rnd(0,5000)),monthly:money(rnd(50,600)),residual:false,archived:false,category:cats[rint(0,cats.length-1)].name});// linked
        else goals.push({name:nm,target:money(rnd(1000,20000)),balance:money(rnd(0,5000)),monthly:0,residual:true,residualPct:money(rnd(0,90)),residualCap:(Math.random()<0.3?money(rnd(50,800)):0),archived:false});// residual
      }
      var assets=[{name:"Checking",bal:money(rnd(0,30000))},{name:"Savings",bal:money(rnd(0,30000))}];
      var debts=(Math.random()<0.6)?[{name:"Loan",bal:money(rnd(0,25000))}]:[];
      state.meta={startCash:money(rnd(0,15000)),floor:money(rnd(0,4000)),cats:{},cons:{}};
      state.cons=cons;state.cats=cats;state.goals=goals;state.assets=assets;state.debts=debts;
      // a few actual rows (income + expense + a goal move) so the Plan+Actual blend is exercised
      state.rows=[];var mo=rint(1,7);
      state.rows.push([2026,mo,'2026-0'+mo+'-05','Inc0','Deposit','',money(rnd(500,4000)),'','N']);
      if(cats.length)state.rows.push([2026,mo,'2026-0'+mo+'-06','',cats[0].name,'Store',money(rnd(50,1500)),'','N']);
      if(goals.length){var lg=goals.filter(function(x){return x.category;})[0];if(lg)state.rows.push([2026,mo,'2026-0'+mo+'-07','',lg.category,lg.name,money(rnd(50,500)),'','N']);}
      state.carryIn={};state.spend={};state.dep={};try{buildIndexes();}catch(e){}
      return goals;
    }

    var A={monoExpense:0,monoIncome:0,goalWealth:0,goalCash:0,beforeLive:0,assetXfer:0,linkedNW:0,annualId:0,contReco:0,iters:0,crashes:0,worst:{}};
    var LE=0.02; // cent tolerance (a couple of cents for rounding on multi-month sums)

    for(var it=0;it<6000;it++){
      A.iters++;
      var goals;try{goals=makeHousehold();}catch(e){A.crashes++;continue;}
      var base,liveBefore;
      try{liveBefore=planMetrics(currentPlan());}catch(e){A.crashes++;continue;}
      // 1) +$X expense never improves cash flow
      try{var X=money(rnd(50,1500));var dE=evaluateDecision({type:'expenseMonthly',amount:X});
        if(dE.after.low>dE.before.low+LE||dE.after.surplus>dE.before.surplus+LE){A.monoExpense++;A.worst.monoExpense=A.worst.monoExpense||{X:X,bl:dE.before.low,al:dE.after.low,bs:dE.before.surplus,as:dE.after.surplus};}
        // 5) Decision "before" EXACTLY equals the live model
        if(Math.abs(dE.before.surplus-liveBefore.surplus)>LE||Math.abs(dE.before.low-liveBefore.low)>LE){A.beforeLive++;A.worst.beforeLive=A.worst.beforeLive||{bs:dE.before.surplus,ls:liveBefore.surplus,bl:dE.before.low,ll:liveBefore.low};}
      }catch(e){A.crashes++;}
      // 2) +$X income never worsens cash flow (income == negative recurring expense to the surplus/cash line)
      try{var Y=money(rnd(50,1500));var dI=evaluateDecision({type:'expenseMonthly',amount:-Y});
        if(dI.after.low<dI.before.low-LE||dI.after.surplus<dI.before.surplus-LE){A.monoIncome++;A.worst.monoIncome=A.worst.monoIncome||{Y:Y,bl:dI.before.low,al:dI.after.low};}
      }catch(e){A.crashes++;}
      // 3/4) goal-monthly increase: cash tighter (≤), wealth (net-worth end) UNCHANGED — use a FIXED stand-alone goal
      try{var fg=goals.filter(function(g){return !g.residual&&!g.category&&!g.account&&!g.archived;})[0];
        if(fg){var newM=money((fg.monthly||0)+rnd(50,500));var dG=evaluateDecision({type:'goalMonthly',goal:fg.name,monthly:newM});
          if(dG.after.low>dG.before.low+LE){A.goalCash++;A.worst.goalCash=A.worst.goalCash||{bl:dG.before.low,al:dG.after.low};}
          if(Math.abs((dG.after.netEnd||0)-(dG.before.netEnd||0))>LE){A.goalWealth++;A.worst.goalWealth=A.worst.goalWealth||{bn:dG.before.netEnd,an:dG.after.netEnd,goal:fg.name};}
        }
      }catch(e){A.crashes++;}
      // 6) moving money between tracked ASSETS does not change net worth
      try{if(state.assets.length>=2){var nw0=netWorthNow();var amt=money(Math.min(state.assets[0].bal,rnd(0,5000)));state.assets[0].bal=money(state.assets[0].bal-amt);state.assets[1].bal=money(state.assets[1].bal+amt);var nw1=netWorthNow();
        if(Math.abs(nw1-nw0)>LE){A.assetXfer++;A.worst.assetXfer=A.worst.assetXfer||{nw0:nw0,nw1:nw1,amt:amt};}}
      }catch(e){A.crashes++;}
      // 7) changing an ACCOUNT-EARMARKED goal's balance does not change net worth (its money sits INSIDE the tracked account,
      //    so net worth uses the account balance once). NOTE: net-worth earmarking keys on g.account, NOT g.category — a
      //    category-linked goal with no account is stand-alone savings and DOES count, which is correct.
      try{var lg2=goals.filter(function(g){return g.account&&!g.archived;})[0];
        if(lg2){var nwA=netWorthNow();lg2.balance=money((lg2.balance||0)+rnd(100,3000));var nwB=netWorthNow();
          if(Math.abs(nwB-nwA)>LE){A.linkedNW++;A.worst.linkedNW=A.worst.linkedNW||{a:nwA,b:nwB,goal:lg2.name};}}
      }catch(e){A.crashes++;}
      // 8) annual-plan identity: surplus === income − budget − goalSave
      try{['plan','actual'].forEach(function(md){var ap=computeAnnualPlan(currentPlan(),{mode:md});if(Math.abs(ap.surplus-money(ap.income-ap.budget-ap.goalSave))>LE){A.annualId++;A.worst.annualId=A.worst.annualId||{mode:md,s:ap.surplus,i:ap.income,b:ap.budget,g:ap.goalSave};}});
      }catch(e){A.crashes++;}
    }

    // ---- contingency reconciliation fuzz (random envelopes + buffer categories) ----
    var _cs=catSpend12,_clg=catLinkedGoal12;
    for(var ci=0;ci<3000;ci++){A.iters++;
      var nEnv=rint(0,4),nBuf=rint(0,3);var cats=[],meta={};var SP={};
      adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
      function mk(nm,roll){var bud=money(rnd(0,1000));var spend=money(rnd(0,2000));SP[nm.toLowerCase()]=[spend,spend,spend,spend,spend,spend,spend,0,0,0,0,0];cats.push({name:nm,bud12:fill12(function(){return bud;})});meta[nm.toLowerCase()]={type:"monthly",roll:roll};}
      for(var e=0;e<nEnv;e++)mk("E"+e,"envelope");for(var f=0;f<nBuf;f++)mk("B"+f,"buffer");
      catSpend12=function(n){return (SP[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};
      state.meta={cats:meta,cons:{}};state.cats=cats;state.goals=[];state.cons=[{name:"J",annual:money(rnd(0,60000))}];state.rows=[];
      var ok=true;try{var rr=computeRollover();
        var sumCov=0;rr.envelopes.forEach(function(x){sumCov+=(x.coveredByContingency||0);if((x.coveredByContingency||0)<-1e-9)ok=false;if((x.uncovered||0)<-1e-9)ok=false;});
        sumCov=money(sumCov);
        if(rr.contingencyUsed>rr.availableBuffer+LE)ok=false;                          // never exceed available
        if(rr.contingencyUsed>rr.totalEnvelopeDeficit+LE)ok=false;                      // never exceed the deficit
        if(rr.availableBuffer<-1e-9||rr.contingencyUsed<-1e-9)ok=false;                 // never negative
        if(Math.abs(sumCov-rr.contingencyUsed)>LE)ok=false;                             // per-envelope reconciles
        if(Math.abs(rr.totalUncoveredDeficit-money((rr.uncoveredDeficit||0)+(rr.bufferDeficit||0)))>LE)ok=false; // total identity
        if(Math.abs((rr.uncoveredDeficit||0)-money(rr.totalEnvelopeDeficit-rr.contingencyUsed))>LE)ok=false;
        if(!ok){A.contReco++;A.worst.contReco=A.worst.contReco||{raw:rr.rawBuffer,avail:rr.availableBuffer,used:rr.contingencyUsed,def:rr.totalEnvelopeDeficit,unc:rr.uncoveredDeficit,bufDef:rr.bufferDeficit,tot:rr.totalUncoveredDeficit,sumCov:sumCov};}
      }catch(e){A.crashes++;}
    }
    catSpend12=_cs;catLinkedGoal12=_clg;
    return A;
  });

  const A=res;
  ck('+$X recurring expense NEVER improves cash flow ('+A.iters+' households)', A.monoExpense===0, 'violations='+A.monoExpense+' '+JSON.stringify(A.worst.monoExpense||''));
  ck('+$X income NEVER worsens cash flow', A.monoIncome===0, 'violations='+A.monoIncome+' '+JSON.stringify(A.worst.monoIncome||''));
  ck('goal-monthly increase lowers cash but NEVER changes wealth (net-worth end)', A.goalWealth===0&&A.goalCash===0, 'wealth='+A.goalWealth+' cash='+A.goalCash+' '+JSON.stringify(A.worst.goalWealth||A.worst.goalCash||''));
  ck('Decision Engine "before" EXACTLY equals the live model', A.beforeLive===0, 'violations='+A.beforeLive+' '+JSON.stringify(A.worst.beforeLive||''));
  ck('moving money between tracked assets does NOT change net worth', A.assetXfer===0, 'violations='+A.assetXfer+' '+JSON.stringify(A.worst.assetXfer||''));
  ck('changing a linked goal balance does NOT change net worth', A.linkedNW===0, 'violations='+A.linkedNW+' '+JSON.stringify(A.worst.linkedNW||''));
  ck('annual-plan identity surplus === income − budget − goalSave (both modes)', A.annualId===0, 'violations='+A.annualId+' '+JSON.stringify(A.worst.annualId||''));
  ck('contingency coverage never creates money & reconciles to the cent', A.contReco===0, 'violations='+A.contReco+' '+JSON.stringify(A.worst.contReco||''));
  ck('no engine crashes across all randomized households', A.crashes===0, 'crashes='+A.crashes);

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed ('+A.iters+' randomized households).');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

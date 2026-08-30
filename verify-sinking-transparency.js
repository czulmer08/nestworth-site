/* SINKING-FUND TRANSPARENCY (v0.68.42) — display-only. In "What's ahead," a logged known bill in an ENVELOPE category shows how much
   of it is ALREADY banked in that envelope ("$1,500 already banked in your Tuition envelope — already part of your available cash above;
   $4,500 of this bill isn't set aside yet"). This is EXPLANATION ONLY. The invariant that matters (and that this test enforces): showing
   the banked funding must NOT manufacture or destroy household cash — safe-to-move is byte-identical whether the category is an envelope
   or plain. The banked dollars are already inside available cash and the bill draws them through the projection; crediting them against the
   bill again would double-count. Also proves the deterministic allocation: a banked dollar is attributed to exactly one bill (earliest-due
   first), never shown funding two obligations, and never exceeds the envelope balance. */
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
  await page.waitForFunction(()=>typeof moneyNowHTML==='function'&&typeof goalSafeToMove==='function'&&typeof reserveBreakdown==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});const near=(a,bb)=>Math.abs((a||0)-(bb||0))<0.02;

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 9;}; // September now
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    window.__SPEND={};window.catSpend12=function(n){return (window.__SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // Past Tuition: budget $500/mo, spent $500 Jan–May, $0 Jun–Aug → banks exactly $1,500 by September.
    var TSPEND=[500,500,500,500,500,0,0,0,0,0,0,0];
    function rows(bill2){
      var rr=[];
      for(var mo=1;mo<=8;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-03','Pay','Deposit','',1000,'','']); // income logged Jan–Aug
      for(var mo=1;mo<=5;mo++)rr.push([2026,mo,'2026-'+String(mo).padStart(2,'0')+'-10','','Tuition','School',500,'','']); // Tuition spend Jan–May
      rr.push([2026,12,'2026-12-15','','Tuition','School',6000,'','']);   // the $6,000 December bill
      if(bill2)rr.push([2026,11,'2026-11-15','','Tuition','School',1000,'','']); // optional 2nd bill (Nov) to test no-double-allocation
      return rr;
    }
    function build(rollMode,bill2){
      state.cons=[{name:'Inc',bud12:fill(1000),annual:12000}];
      state.cats=[{name:'Tuition',bud12:fill(500),annual:6000}];
      state.goals=[{name:'Car Fund',residual:true,residualPct:100,archived:false}];state.assets=[];state.debts=[];
      state.rows=rows(bill2);
      state.meta={cats:(rollMode?{"tuition":{roll:rollMode}}:{}),cons:{},goals:[],payees:['Pay'],floor:0,startCash:2000};
      window.__SPEND["tuition"]=TSPEND.slice();
      if(typeof buildIndexes==='function')buildIndexes();if(typeof applyBudgetSpend==='function')applyBudgetSpend();
    }
    var Rz={};
    // ENVELOPE version: the note should appear
    build('envelope',false);
    Rz.envBanked=r2(catBalance(state.cats[0]));
    var gsE=goalSafeToMove();Rz.safeEnv=gsE.safeToGoal;Rz.fLowM=gsE.forwardLowMonth;
    var rb=reserveBreakdown();
    var dec=(rb&&rb.months||[]).filter(function(x){return x.m===12;})[0]||null;
    var decTui=dec&&(dec.knownDetail||[]).filter(function(d){return (""+d.cat).toLowerCase()==='tuition';})[0]||null;
    Rz.decBanked=decTui?decTui.banked:null;Rz.decUnbanked=decTui?decTui.unbanked:null;Rz.decAmt=decTui?decTui.amt:null;
    var h=moneyNowHTML();
    Rz.noteShown=/already banked in your Tuition envelope/.test(h);
    Rz.noteAmt=/\$1,500(\.00)? already banked in your Tuition envelope/.test(h);
    Rz.noteUnbanked=/\$4,500(\.00)? of this bill isn’t set aside yet/.test(h);
    Rz.noteInAvail=/already part of your available cash above/.test(h);
    // PLAIN version: same numbers, no roll → safe MUST be identical, and no banked note
    build(null,false);
    var gsP=goalSafeToMove();Rz.safePlain=gsP.safeToGoal;
    Rz.noteAbsentPlain=!/already banked in your Tuition envelope/.test(moneyNowHTML());
    // DOUBLE-ALLOCATION: two Tuition bills ($1,000 Nov + $6,000 Dec) share the $1,500 envelope → total banked shown ≤ $1,500, never $3,000
    build('envelope',true);
    var rb2=reserveBreakdown();var tot=0,bills=0;(rb2&&rb2.months||[]).forEach(function(x){(x.knownDetail||[]).forEach(function(d){if((""+d.cat).toLowerCase()==='tuition'){tot=r2(tot+(d.banked||0));bills+=1;}});});
    Rz.dblTotalBanked=tot;Rz.dblBills=bills;Rz.dblCap=r2(catBalance(state.cats[0]));
    return Rz;
  });

  ck('envelope banked exactly $1,500 (past unspent budget, tested source)', near(R.envBanked,1500), 'banked='+R.envBanked);
  ck('December is the forward low, so the $6,000 bill appears in "What’s ahead"', R.fLowM===12&&R.decAmt!=null, JSON.stringify({fLowM:R.fLowM,decAmt:R.decAmt}));
  ck('the $6,000 bill is attributed $1,500 banked + $4,500 not-yet-set-aside (bill − banked)', near(R.decBanked,1500)&&near(R.decUnbanked,4500), JSON.stringify({banked:R.decBanked,unbanked:R.decUnbanked}));
  ck('the transparency note renders with the banked amount, the unbanked remainder, and the "already in available cash" caveat',
     R.noteShown&&R.noteAmt&&R.noteUnbanked&&R.noteInAvail, JSON.stringify({shown:R.noteShown,amt:R.noteAmt,unb:R.noteUnbanked,avail:R.noteInAvail}));
  ck('INVARIANT: safe-to-move is byte-identical envelope vs plain — the note explains cash, it never manufactures or destroys it',
     near(R.safeEnv,R.safePlain), 'safeEnv='+R.safeEnv+' safePlain='+R.safePlain);
  ck('the plain-category version shows NO banked note (the note is envelope-only, display-only)', R.noteAbsentPlain, '');
  ck('NO DOUBLE-ALLOCATION: two bills sharing one $1,500 envelope show ≤ the balance in total, never the sum of both attributions',
     R.dblBills>=2&&near(R.dblTotalBanked,1500)&&R.dblTotalBanked<=R.dblCap+0.02, JSON.stringify({bills:R.dblBills,totalBanked:R.dblTotalBanked,cap:R.dblCap}));

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: the sinking-fund transparency note shows what’s already banked toward a future bill WITHOUT changing safe-to-move.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

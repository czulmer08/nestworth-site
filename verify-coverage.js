/* Verify the "Can you cover it?" so-what block: contingency vs this month's overage, envelopes that drew down their banked
   balance (still covered vs in the red), and whether every envelope survives the year at the year-to-date pace. Plus Wren. */
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
  await page.waitForFunction(()=>typeof coverageReport==='function'&&typeof coverageHtml==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});
  const near=(a,bb)=>Math.abs(a-bb)<0.02;

  const res=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;}; // August
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    var SPEND={};catSpend12=function(n){return SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0];};
    var fill=function(v){return [v,v,v,v,v,v,v,v,v,v,v,v];};
    function cat(name,mbud,mused,b12){return {name:name,mbud:mbud,mused:mused,bud12:b12};}
    // Non-envelope overspends (no buffer behind them)
    // Envelopes: Subscriptions & Utilities over THIS month but banked positive; Children deeply in the red + heading worse.
    // Buffer category banks the contingency cushion.
    state.meta={cats:{
      "mortgage":{type:"monthly"},"food/outings":{type:"monthly"},
      "subscriptions":{type:"monthly",roll:"envelope"},"utilities":{type:"monthly",roll:"envelope"},
      "children":{type:"monthly",roll:"envelope"},"cushion":{type:"monthly",roll:"buffer"}}};
    state.cats=[
      cat("Mortgage",2088,2278.34,fill(2088)),
      cat("Food/Outings",1400,1583.90,fill(1400)),
      cat("Subscriptions",100,300,fill(100)),
      cat("Utilities",200,400,fill(200)),
      cat("Children",500,900,fill(500)),
      cat("Cushion",100,20,fill(100))];
    // year-to-date monthly spend (Jan..Jul) + August
    SPEND["subscriptions"]=[50,50,50,50,50,50,50,300,0,0,0,0]; // bal entering Aug = 7*(100-50)=350
    SPEND["utilities"]    =[150,150,150,150,150,150,150,400,0,0,0,0]; // bal = 7*(200-150)=350
    SPEND["children"]     =[900,900,900,900,900,900,900,900,0,0,0,0]; // bal = 7*(500-900) = -2800 (already red)
    SPEND["cushion"]      =[20,20,20,20,20,20,20,20,0,0,0,0]; // bal = 7*(100-20)=560 buffer
    state.rows=[[2026,8,'2026-08-01','','x','',0,'','N']]; // non-empty so wrenAnalyze runs

    var r=coverageReport();
    var byName=function(arr,n){return arr.filter(function(e){return e.name===n;})[0];};
    var html=coverageHtml();

    // Wren
    var wrenA=(typeof wrenAnalyze==='function')?wrenAnalyze("how much is in contingency and will it cover the overage?"):null;
    var wrenB=(typeof wrenAnalyze==='function')?wrenAnalyze("will I be able to cover the overages in the envelopes this year?"):null;

    return {
      fixedTot:r.fixedTot,fixedNames:r.fixedOver.map(function(f){return f.name;}),
      buffer:r.buffer,monthLeft:r.monthLeft,
      subsOver:byName(r.envOver,"Subscriptions"),utilOver:byName(r.envOver,"Utilities"),childOver:byName(r.envOver,"Children"),
      allSolvent:r.allSolvent,childRisk:byName(r.envRisk,"Children"),
      html:html,
      wrenA:wrenA&&wrenA.answer||"",wrenB:wrenB&&wrenB.answer||""
    };
  });

  ck('fixed (non-envelope) overage totals $374.24 (Mortgage + Food/Outings)', near(res.fixedTot,374.24)&&res.fixedNames.indexOf('Mortgage')>=0&&res.fixedNames.indexOf('Food/Outings')>=0, JSON.stringify({tot:res.fixedTot,names:res.fixedNames}));
  ck('contingency buffer computes to $560', near(res.buffer,560), String(res.buffer));
  ck('Subscriptions flagged over this month, still banked positive ($350)', res.subsOver&&near(res.subsOver.over,200)&&near(res.subsOver.balance,350), JSON.stringify(res.subsOver));
  ck('Utilities flagged over this month, still banked positive ($350)', res.utilOver&&near(res.utilOver.balance,350), JSON.stringify(res.utilOver));
  ck('Children flagged over this month AND in the red (balance −$2,800)', res.childOver&&near(res.childOver.balance,-2800), JSON.stringify(res.childOver));
  ck('not all envelopes are solvent; Children projected short by year-end', res.allSolvent===false&&!!res.childRisk, JSON.stringify(res.childRisk));
  ck('rendered block shows the deep envelope deficit consumed contingency (Children partly covered)', /contingency covers \$560\.00, leaving/.test(res.html)||/covered by contingency/.test(res.html), res.html.slice(0,160));
  ck('rendered block shows an envelope covered by its banked balance', /over its set-aside — covered by its/.test(res.html), '');
  ck('rendered block shows Children in the red', /Children<\/b> is .* in the red/.test(res.html), '');
  ck('rendered block gives a year-end verdict for a struggling envelope', /runs about .* short before year-end/.test(res.html), '');
  ck('Wren answers the contingency question with the available number after covering deficits', /contingency holds \$560\.00/.test(res.wrenA)&&/covering.*envelope deficits|available/.test(res.wrenA), res.wrenA.slice(0,160));
  ck('Wren answers the envelopes-this-year question', /year-end|December/.test(res.wrenB), res.wrenB.slice(0,120));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

/* Verify the part-4/5 audit fixes: (A) penny-rounding remainder — split/save-up/annualized amounts re-sum to the EXACT
   total; (B) a pooled multi-bill envelope no longer claims the banked balance belongs to one specific annual bill. */
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
  await page.waitForFunction(()=>typeof monthsFor==='function'&&typeof billMonths==='function'&&typeof envUpcoming==='function'&&typeof computeRollover==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    window.budYear=0;var sum=function(a){return Math.round(a.reduce(function(s,v){return s+v;},0)*100)/100;};

    // (A) penny-rounding remainder — every total must re-sum exactly
    var split3=monthsFor({type:'split',amount:100,cover:[1,1,1,0,0,0,0,0,0,0,0,0]});
    var saveup6=monthsFor({type:'onetime',saveup:true,amount:100,start:1,month:6});
    var bwYear=monthsFor({type:'biweekly',amount:1000});                 // 1000×26 = 26,000 exactly
    var payYear=monthsFor({type:'paycheck',freq:26,mode:'pct',pct:100,amount:1000}); // same, via paycheck flat
    var billSaveup=billMonths([{name:'Reg',amount:1000,cadence:'AnnualSaveUp',month:3}]); // 1000/3 across Jan–Mar
    var roundOk=sum(split3)===100&&sum(saveup6)===100&&sum(bwYear)===26000&&sum(payYear)===26000&&sum(billSaveup)===1000;
    // and the remainder lands in the LAST participating month (33.33, 33.33, 33.34)
    var lastPenny=split3[0]===33.33&&split3[1]===33.33&&split3[2]===33.34;

    // (B) multi-bill envelope attribution
    window.isGoalName=()=>false;
    state.meta={cats:{},cons:{},goals:[]};state.goals=[];state.cons=[];state.rows=[];
    // one bill → sole, gets a per-bill "saved toward this bill" line
    state.meta.cats={insurance:{type:'itemized',roll:'envelope',items:[{name:'Auto',amount:1200,cadence:'AnnualSaveUp',month:10}]}};
    state.cats=[{name:'Insurance',annual:1200,mbud:0,bud12:billMonths(state.meta.cats.insurance.items),row:5}];
    var soleUp=envUpcoming('Insurance');
    var soleOk=soleUp&&soleUp.sole===true;
    var roll1=computeRollover(),env1=roll1.envelopes.filter(function(e){return e.name==='Insurance';})[0];
    var soleAttributed=env1&&env1.upc&&!env1.upc.multi&&env1.upc.need===1200;

    // two annual bills → NOT sole; the balance must not be attributed to one bill
    state.meta.cats={insurance:{type:'itemized',roll:'envelope',items:[{name:'Auto',amount:1200,cadence:'AnnualSaveUp',month:10},{name:'Home',amount:1800,cadence:'AnnualSaveUp',month:12}]}};
    state.cats=[{name:'Insurance',annual:3000,mbud:0,bud12:billMonths(state.meta.cats.insurance.items),row:5}];
    var multiUp=envUpcoming('Insurance');
    var multiOk=multiUp&&multiUp.sole===false;
    var roll2=computeRollover(),env2=roll2.envelopes.filter(function(e){return e.name==='Insurance';})[0];
    var multiNotAttributed=env2&&env2.upc&&env2.upc.multi===true&&env2.upc.need===undefined&&env2.upc.dueMonth===10; // shows the nearest due date only

    return {split3,saveup6,roundOk,lastPenny,soleOk,soleAttributed,multiOk,multiNotAttributed};
  });

  ck('split/save-up/annualized amounts re-sum to the exact total', res.roundOk, JSON.stringify({split:res.split3}));
  ck('the rounding remainder lands in the last month (33.33, 33.33, 33.34)', res.lastPenny, JSON.stringify(res.split3));
  ck('single-bill envelope reports sole=true and keeps its per-bill "saved" line', res.soleOk&&res.soleAttributed, JSON.stringify({sole:res.soleOk,attr:res.soleAttributed}));
  ck('multi-bill envelope reports sole=false', res.multiOk, String(res.multiOk));
  ck('multi-bill envelope shows the next due date but does NOT attribute the banked balance to one bill', res.multiNotAttributed, String(res.multiNotAttributed));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* Verify Wren answers "will my % goal cap at $X or go past it?" with a real explanation of residual goals,
   instead of misrouting to the savings ("You kept $X") or goal-pace ("on pace to reach it") analytics. */
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
  await page.waitForFunction(()=>typeof wrenAnalyze==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    curYear=function(){return 2026;};curMonth=function(){return 8;};
    var row=function(y,m,d,who,cat,co,amt){return [y,m,d,who,cat,co,amt,'','N'];};
    // give Wren real data so the OLD misrouting (savings / pace) would actually fire
    state.goals=[{name:'Car Fund',target:12000,balance:0,monthly:800,residual:true,residualPct:80,archived:false}];
    state.rows=[row(2026,8,'2026-08-01','','Deposit','Job',30000),row(2026,8,'2026-08-05','','Food','Store',7000)];

    function ans(q){var a=wrenAnalyze(q);return a&&a.answer?a.answer:"";}
    var q1="For my car fund, I want it to contribute 80% of the leftover funds, will it contribute up to the $800 or past it?";
    var q2="For my car fund goal, I want it to contribute 80% of the leftover funds, will it contribute up to the $800 or past it?";
    var a1=ans(q1),a2=ans(q2);
    var explains=function(a){return /not capped|hard monthly ceiling|percentage of your leftover|fixed dollar amount per month/i.test(a);};
    var notSavings=function(a){return !/you kept/i.test(a);};
    var notPace=function(a){return !/on pace to reach/i.test(a);};
    return {a1,a2,
      e1:explains(a1),e2:explains(a2),
      ns1:notSavings(a1),ns2:notSavings(a2),
      np1:notPace(a1),np2:notPace(a2),
      names1:a1.indexOf('Car Fund')>=0,names2:a2.indexOf('Car Fund')>=0,
      goals1:(wrenAnalyze(q1)||{}).go&&(wrenAnalyze(q1)||{}).go.v==='goals'};
  });

  ck('phrasing 1 ("car fund ... 80% ... up to $800") returns the residual explanation', res.e1, res.a1.slice(0,90));
  ck('phrasing 2 ("car fund goal ... 80% ... up to $800") returns the residual explanation', res.e2, res.a2.slice(0,90));
  ck('phrasing 1 does NOT misroute to the savings ("You kept") answer', res.ns1, res.a1.slice(0,60));
  ck('phrasing 2 does NOT misroute to the goal-pace ("on pace") answer', res.np2, res.a2.slice(0,60));
  ck('the explanation names the goal ("Car Fund")', res.names1&&res.names2, JSON.stringify({n1:res.names1,n2:res.names2}));
  ck('it sends the user to the Goals tab', res.goals1, String(res.goals1));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

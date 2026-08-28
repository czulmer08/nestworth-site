/* Verify Wren's Layer-2 analytics: budget variance, "how am I doing", remaining-in-category, pace/projection,
   month-over-month, merchant search, goal ETA, net-worth change attribution — all deterministic, no API. */
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
  await page.waitForFunction(()=>typeof wrenAnalyze==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth(),lY=(M>1?Y:Y-1),lM=(M>1?M-1:12);
    window.catRoll=()=>"none";window.catCfg=()=>null;
    state.meta={cats:{},cons:{},prefs:{},goals:[]};state.goalSet={};
    state.cats=[
      {name:'Food',mbud:400,mspent:520,annual:4800,remaining:4280},   // OVER by 120
      {name:'Gas',mbud:150,mspent:60,annual:1800,remaining:1740},     // 90 left
      {name:'Travel',mbud:200,mspent:0,annual:2400,remaining:2400}    // full room
    ];
    state.goals=[{name:'Car Fund',target:12000,balance:3000,monthly:800,archived:false}];
    state.nwHist=[{ym:Y*100+lM,assets:10000,debts:3000,net:7000},{ym:Y*100+M,assets:10600,debts:2400,net:8200}];
    state.rows=[
      [Y,M,Y+'-0'+M+'-10','Me','Food','Target',520,'','N'],
      [Y,M,Y+'-0'+M+'-11','Me','Gas','Shell',60,'','N'],
      [Y,M,Y+'-0'+M+'-12','Me','Deposit','Employer',4000,'','N'],
      [Y,3,Y+'-03-04','Me','Gas','Target',80,'','N'],                 // earlier Target purchase (same year)
      [lY,lM,lY+'-0'+lM+'-05','Me','Food','Publix',300,'','N']        // last month, day 05
    ];
    var A=function(q){var r=wrenAnalyze(q);return r?r.answer:null;};
    return {
      networth:A('why did my net worth go up?'),
      goal:A('am I on track for my car?'),
      over:A('what am I over budget on?'),
      doing:A('how am I doing this month?'),
      remaining:A('how much do I have left in gas?'),
      pace:A('am I on pace to stay under budget on food?'),
      compare:A('am I spending more than last month?'),
      merchant:A('how much did I spend at Target this year?')
    };
  });

  ck('net-worth change attribution (grew $1,200, assets +, debt paydown)', /grew \$1,200\.00/.test(res.networth)&&/assets/.test(res.networth)&&/debt/.test(res.networth), JSON.stringify(res.networth));
  ck('goal ETA (Car Fund, $9,000 to go at $800/mo)', /Car Fund/.test(res.goal)&&/\$9,000\.00 to go/.test(res.goal)&&/on pace/.test(res.goal), JSON.stringify(res.goal));
  ck('over-budget lists Food by $120', /Food by \$120\.00/.test(res.over), JSON.stringify(res.over));
  ck('"how am I doing" narrates spend, income, over, and room', /\$580\.00/.test(res.doing)&&/\$4,000\.00/.test(res.doing)&&/Food/.test(res.doing)&&/Travel/.test(res.doing), JSON.stringify(res.doing));
  ck('remaining in a category (Gas: $90 left)', /\$90\.00 left in Gas/.test(res.remaining), JSON.stringify(res.remaining));
  ck('pace/projection for a category (Food, over)', /Food/.test(res.pace)&&/over\.?$/.test(res.pace), JSON.stringify(res.pace));
  ck('month-over-month at the same point ($580 vs $300)', /\$580\.00/.test(res.compare)&&/\$300\.00/.test(res.compare)&&/more/.test(res.compare), JSON.stringify(res.compare));
  ck('merchant search (Target: $600 across 2 transactions)', /\$600\.00 at Target/.test(res.merchant)&&/2 transactions/.test(res.merchant), JSON.stringify(res.merchant));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

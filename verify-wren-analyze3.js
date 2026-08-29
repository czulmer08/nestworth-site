/* Verify Wren Layer-3 analytics: forecasting, cash-flow, affordability, what-if, narrative, recurring, unusual,
   member split, debt progress, recommendations, and personal baselines — all deterministic, no API. */
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
  await page.waitForFunction(()=>typeof wrenAnalyze==='function'&&typeof anCatByMonth==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth();
    window.catRoll=()=>"none";window.catCfg=()=>null;window.catBills=()=>[];
    window.acctTrend=(k,n)=>({chg:-200});
    state.meta={cats:{},cons:{},prefs:{},goals:[]};state.goalSet={'car fund':1};
    state.cats=[
      {name:'Food',mbud:300,mspent:380,annual:3600},
      {name:'Gas',mbud:150,mspent:100,annual:1800},
      {name:'Travel',mbud:200,mspent:0,annual:2400},
      {name:'Dining',mbud:100,mspent:400,annual:1200},
      {name:'Entertainment',mbud:30,mspent:15.99,annual:360}
    ];
    state.cons=[{name:'Job',annual:60000}];
    state.debts=[{name:'Car Loan'}];
    state.goals=[{name:'Car Fund',target:12000,balance:3000,monthly:800,archived:false,category:'',residual:false}];
    // give each category/income a real 12-month plan (the shared engine reads bud12, not the annual shortcut)
    state.cats.forEach(function(c){c.bud12=Array(12).fill(c.annual/12);});
    state.cons.forEach(function(c){c.bud12=Array(12).fill(c.annual/12);});
    var rows=[];
    function add(y,m,day,who,cat,co,amt){rows.push([y,m,y+'-'+(m<10?'0':'')+m+'-'+(day<10?'0':'')+day,who,cat,co,amt,'','N']);}
    for(var i=0;i<6;i++){var mm=M-i,yy=Y;if(mm<1){mm+=12;yy--;}add(yy,mm,5,'Me','Food','Publix',380+i*5);}
    for(var i=0;i<6;i++){var mm=M-i,yy=Y;if(mm<1){mm+=12;yy--;}add(yy,mm,6,'Denzell','Gas','Shell',100);}
    for(var i=1;i<=4;i++){var mm=M-i,yy=Y;if(mm<1){mm+=12;yy--;}add(yy,mm,7,'Me','Dining','Cafe',50);}
    add(Y,M,7,'Me','Dining','Steakhouse',400);
    for(var i=0;i<3;i++){var mm=M-i,yy=Y;if(mm<1){mm+=12;yy--;}add(yy,mm,3,'Me','Entertainment','Netflix',15.99);}
    for(var i=0;i<6;i++){var mm=M-i,yy=Y;if(mm<1){mm+=12;yy--;}add(yy,mm,1,'Me','Deposit','Job',5000);}
    add(Y-1,12,10,'Me','Food','Publix',600);add(Y-2,12,10,'Me','Food','Publix',700);
    state.rows=rows;
    var A=function(q){var r=wrenAnalyze(q);return r?r.answer:null;};
    var o={
      forecast:A('if we keep spending like this, where will we end the year?'),
      cashflow:A('are we living within our means?'),
      afford:A('when could I afford a $12,000 car?'),
      whatifCut:A('what if I cut Food by $200 and put it toward the Car Fund?'),
      whatifAdd:A('what if I add $300 a month to my Car Fund?'),
      narrative:A('where did our money go?'),
      recurring:A('what subscriptions do I have?'),
      unusual:A('anything weird this month?'),
      member:A('how much did Denzell and I each spend this month?'),
      debt:A('which debt am I paying off the fastest?'),
      recs:A('what should I change?'),
      realistic:A("what's a realistic budget for Food?"),
      mostEver:A("what's the most I've ever spent on Food?"),
      december:A('how much do we normally spend in December?'),
      leftover:A("what's our average monthly leftover?"),
      roomCats:A('which categories have money left every month?'),
      underestimate:A('what categories do I consistently underestimate?'),
      findMoney:A('find money for me')
    };
    // cash-flow deficit path with lower income
    state.cons=[{name:'Job',annual:15000,bud12:Array(12).fill(15000/12)}];o.deficit=A('will we run out of savings?');
    return o;
  });

  ck('year-end forecast projects annual spending', /trending toward/.test(res.forecast)&&/for the year/.test(res.forecast), JSON.stringify(res.forecast));
  ck('cash-flow: sustainable plan with a cushion', /sustainable/.test(res.cashflow)&&/cushion/.test(res.cashflow), JSON.stringify(res.cashflow));
  ck('cash-flow deficit path ($330/month short)', /deficit/.test(res.deficit)&&/\$330\.00/.test(res.deficit), JSON.stringify(res.deficit));
  ck('affordability: ~4 months for $12,000', /\$12,000\.00/.test(res.afford)&&/4 months/.test(res.afford), JSON.stringify(res.afford));
  ck('what-if cut Food $200 → $2,400/yr, reaches Car Fund sooner', /\$2,400\.00\/year/.test(res.whatifCut)&&/Car Fund/.test(res.whatifCut)&&/sooner/.test(res.whatifCut), JSON.stringify(res.whatifCut));
  ck('what-if add $300 → new monthly and ETA', /Car Fund/.test(res.whatifAdd)&&/\$1,100\.00/.test(res.whatifAdd), JSON.stringify(res.whatifAdd));
  ck('narrative "where did our money go" names biggest areas', /biggest areas/.test(res.narrative)&&/Dining/.test(res.narrative), JSON.stringify(res.narrative));
  ck('recurring detection finds Netflix', /Netflix/.test(res.recurring)&&/recurring|~/.test(res.recurring), JSON.stringify(res.recurring));
  ck('unusual spending flags the Dining spike', /Dining/.test(res.unusual)&&/higher/.test(res.unusual), JSON.stringify(res.unusual));
  ck('member split lists Me and Denzell', /Denzell/.test(res.member)&&/Me/.test(res.member), JSON.stringify(res.member));
  ck('debt progress (paying down Car Loan $200)', /Car Loan/.test(res.debt)&&/\$200\.00/.test(res.debt), JSON.stringify(res.debt));
  ck('budget recommendations name a chronic category', /Food/.test(res.recs), JSON.stringify(res.recs));
  ck('realistic budget baseline for Food', /normally spend about/.test(res.realistic)&&/Food/.test(res.realistic), JSON.stringify(res.realistic));
  ck('most-ever on Food ($700 in December)', /\$700\.00/.test(res.mostEver)&&/December/.test(res.mostEver), JSON.stringify(res.mostEver));
  ck('normally-spend-in-December baseline ($650)', /December/.test(res.december)&&/\$650\.00/.test(res.december), JSON.stringify(res.december));
  ck('average monthly leftover', /average month you keep/.test(res.leftover), JSON.stringify(res.leftover));
  ck('categories with room most months (Gas)', /Gas/.test(res.roomCats), JSON.stringify(res.roomCats));
  ck('consistently-over categories (Food)', /Food/.test(res.underestimate), JSON.stringify(res.underestimate));
  ck('find money / uncommitted analysis', /isn't committed/.test(res.findMoney), JSON.stringify(res.findMoney));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

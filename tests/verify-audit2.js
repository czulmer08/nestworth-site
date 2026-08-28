/* Verify the remaining audit items: available-this-month vs annual average, envelope "banked thru <month>", seasonal
   prior-year budgeting (per-month pattern), and ±1-day possible-duplicate detection in imports. */
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
  await page.waitForFunction(()=>typeof availableThisMonth==='function'&&typeof lastCompletedMon==='function'&&typeof priorYearSpendByCatMonth==='function'&&typeof impMarkDuplicates==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth(),cm=M-1;
    window.isGoalName=()=>false;
    // available this month (seasonally specific), distinct from annual average
    var inc=Array(12).fill(1000);inc[cm]=2000;   // this month plans $2,000 income
    var exp=Array(12).fill(500);exp[cm]=1200;     // this month plans $1,200 expense
    state.cons=[{name:'Job',annual:12000,bud12:inc}];
    state.cats=[{name:'Food',annual:6000,bud12:exp}];
    state.goals=[{name:'Car',monthly:300,archived:false,category:'',residual:false}];
    var avail=availableThisMonth(); // 2000 - 1200 - 300 = 500

    // last completed month label
    var lcm=lastCompletedMon(),expectLcm=(M-1>=1)?["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][M-2]:"Dec";

    // seasonal prior-year pattern
    state.rows=[
      [Y-1,3,(Y-1)+'-03-01','Me','Travel','Air',1500,'','N'],
      [Y-1,7,(Y-1)+'-07-01','Me','Travel','Hotel',500,'','N'],
      [Y-1,3,(Y-1)+'-03-02','Me','Food','Publix',400,'','N']
    ];
    var byM=priorYearSpendByCatMonth();
    var travel=byM['travel']||[];
    var seasonalOk=travel[2]===1500&&travel[6]===500&&travel[0]===0; // spikes stay in their months, not flattened

    // ±1-day possible-duplicate detection
    window.serialToISO=(v)=>v; window._impExisting=null;
    state.rows=[[Y,8,Y+'-08-10','Me','Food','Store',50,'','N']];
    window.IMPTX=[{date:Y+'-08-10',amount:50},{date:Y+'-08-11',amount:50},{date:Y+'-08-15',amount:50},{date:Y+'-08-11',amount:99}];
    impMarkDuplicates();
    var dupFlags=IMPTX.map(function(t){return !!t._dup;});

    return {avail,lcm,expectLcm,seasonalOk,dupFlags};
  });

  ck('available-this-month uses this month\'s plan ($2000 − $1200 − $300 = $500)', res.avail===500, JSON.stringify(res.avail));
  ck('envelope "banked thru" names the last completed month', res.lcm===res.expectLcm, JSON.stringify({got:res.lcm,exp:res.expectLcm}));
  ck('seasonal budgeting keeps the per-month pattern (Travel spikes stay put)', res.seasonalOk, JSON.stringify(res.dupFlags?null:null)||String(res.seasonalOk));
  ck('possible-duplicate flags exact + within-a-day, not 5 days off or a different amount', JSON.stringify(res.dupFlags)===JSON.stringify([true,true,false,false]), JSON.stringify(res.dupFlags));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

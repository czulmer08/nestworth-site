/* Verify P1 model fixes: the current month blends actual-to-date with the plan (not treated as fully planned), and a
   goal's funding periods count the current AND target month (due by end of target month). */
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
  await page.waitForFunction(()=>typeof renderStress==='function'&&typeof goalFundMonths==='function'&&typeof monthsUntil==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    var Y=curYear(),M=curMonth();
    window.catCfg=()=>null;window.catBills=()=>[];window.isGoalName=()=>false;
    state.meta={startCash:0,cats:{},cons:{},goals:[]};state.goals=[];
    state.cons=[{name:'Job',annual:12000,bud12:Array(12).fill(1000)}];              // $1,000/mo planned income
    state.cats=[{name:'Food',annual:6000,bud12:Array(12).fill(500),mbud:500,mspent:2000}]; // $500/mo planned
    state.rows=[[Y,M,Y+'-'+String(M).padStart(2,'0')+'-05','Me','Food','Store',2000,'','N']]; // this month ACTUAL $2,000 — way over plan
    state._stMode='actual';
    show('appScreen');document.querySelectorAll('.view').forEach(function(v){v.classList.remove('on');});$("view-budget").classList.add('on');
    renderStress();
    var row=$("stGrid").querySelector('.strow[data-mo="'+M+'"]');
    var netTxt=row?row.querySelector('.stn').textContent:'',netNeg=row?row.querySelector('.stn').classList.contains('neg'):false,tag=row?row.textContent:'';
    // goal funding months: a target 3 months out
    var tm=M+3,ty=Y;if(tm>12){tm-=12;ty++;}var tgt=ty+'-'+String(tm).padStart(2,'0');
    return {netTxt,netNeg,soFar:/so far/.test(tag),gfm:goalFundMonths(tgt),mu:monthsUntil(tgt),gfmEmpty:goalFundMonths("")};
  });

  ck('current month blends actual over plan — net is -$1,000 (2000 spent vs 1000 in), not the +$500 plan', /1,000/.test(res.netTxt)&&res.netNeg, JSON.stringify(res.netTxt));
  ck('current month is tagged "so far + plan"', res.soFar, String(res.soFar));
  ck('goal funding counts current + target month inclusive (monthsUntil + 1)', res.gfm===res.mu+1&&res.gfm>=1, JSON.stringify({gfm:res.gfm,mu:res.mu}));
  ck('no target date → 0 funding months (no auto-suggest)', res.gfmEmpty===0, String(res.gfmEmpty));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* ADD-SCREEN DEPOSIT PROGRESS (v0.68.30) — the Add screen must tell you what actually happened to a deposit vs the plan,
   keeping THREE concepts strictly separate: budget-remaining ≠ income-above-plan ≠ safe-to-move.
   - received / planned are both shown explicitly; "target" language is gone (it read like a savings minimum).
   - ABOVE the planned deposit → "+$X above plan ✓"; BELOW → "$Y still expected"; EXACT → "right on plan ✓".
   - the above-plan amount is NEVER called surplus / free / available / left over — it only means more income arrived than
     planned; whether any of it is safe to move to a goal is the forward projection's job (the Month tab), not this screen's.
   - the top card reads "$X left in this month's budget" (spending-budget capacity), not "$X left this month" (cash on hand).
   Break-audited by a mutation that measures the delta against $0 instead of the plan (verify-mutation.js). */
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
  await page.waitForFunction(()=>typeof renderDepTbl==='function'&&typeof renderS2S==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    show('appScreen');
    function depText(mdep,mtarget){
      state.cons=[{name:'Candice',mdep:mdep,mtarget:mtarget,bud12:[],annual:mtarget*12}];
      state.rows=[];
      var sel=document.getElementById('dSource');sel.innerHTML='<option>Candice</option>';sel.value='Candice';
      var da=document.getElementById('dAmount');if(da)da.value='';   // nothing typed
      var dd=document.getElementById('dDate');if(dd)dd.value='';      // current month
      renderDepTbl();
      return document.getElementById('depTbl').textContent;
    }
    var o={};
    o.above=depText(9797.11,8297.73);   // brought in MORE than planned
    o.below=depText(7500,8297.73);      // brought in LESS than planned
    o.exact=depText(8297.73,8297.73);   // exactly on plan
    // s2s top card: $357.26 left in this month's BUDGET (capacity, not cash)
    state.cats=[{name:'Living',mbud:1000,mspent:642.74,mused:642.74,bud12:[],annual:12000}];
    state.cons=[];state.rows=[];
    renderS2S();o.s2s=document.getElementById('s2s').textContent;
    return o;
  });

  ck('ABOVE plan: shows received AND planned explicitly ("$9,797.11 received" / "$8,297.73 planned")',
     /\$9,797\.11 received/.test(R.above)&&/\$8,297\.73 planned/.test(R.above), R.above);
  ck('ABOVE plan: states the delta as "+$1,499.38 above plan ✓" (not "met target")',
     /\+\$1,499\.38 above plan/.test(R.above)&&/✓/.test(R.above)&&!/target/i.test(R.above), R.above);
  ck('ABOVE plan: the above-plan amount is NOT called surplus / free / available / left over',
     !/surplus|\bfree\b|available|left ?over/i.test(R.above), R.above);
  ck('BELOW plan: shows "$797.73 still expected", and does NOT claim it is above plan',
     /\$797\.73 still expected/.test(R.below)&&!/above plan/.test(R.below), R.below);
  ck('EXACTLY on plan: reads "right on plan ✓", with no above/short language',
     /right on plan/.test(R.exact)&&!/above plan/.test(R.exact)&&!/still expected/.test(R.exact), R.exact);
  ck('the word "target" is gone from all three states (it read like a savings minimum)',
     !/target/i.test(R.above+R.below+R.exact), R.below);
  ck('top card is spending-budget capacity: "$357.26 left in this month’s budget" (not bare "left this month")',
     /\$357\.26 left in this month's budget/.test(R.s2s), R.s2s);

  let pass=0,fail=0;out.forEach(function(r){console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  VERDICT: Add tracks money coming in vs the plan and says so plainly, never conflating income-above-plan with budget-remaining or with what is safe to move to a goal.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

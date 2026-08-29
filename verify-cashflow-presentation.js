/* CASH-FLOW PRESENTATION clarity (screenshot audit). The running-total column read as "money I have"; with Starting savings = $0
   it is really a TREND from an artificial $0 baseline, and a positive trend does NOT refill an overspent contingency. This proves:
     (1) the column header is "Projected cash", not the ambiguous "Balance";
     (2) when Starting savings is $0 a conspicuous note says these figures are a trend from a $0 start, not actual cash on hand;
     (3) the note disappears once Starting savings is set;
     (4) when a contingency buffer is overspent, the verdict explicitly says projected cash is NOT the contingency and doesn't refill it. */
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
  await page.waitForFunction(()=>typeof renderStress==='function'&&typeof getContingencyFacts==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  const R=await page.evaluate(()=>{
    curYear=function(){return 2026;};bYear=function(){return 2026;};curMonth=function(){return 8;};todayISO=function(){return '2026-08-15';};
    adoptionFloor=function(){return 1;};rollStartFloor=function(){return 1;};carryInFor=function(){return 0;};
    window.catLinkedGoal12=function(){return [0,0,0,0,0,0,0,0,0,0,0,0];};
    var SPEND={};window.catSpend12=function(n){return (SPEND[(""+n).toLowerCase()]||[0,0,0,0,0,0,0,0,0,0,0,0]).slice();};window.spentByMonth=window.catSpend12;
    var fill=function(v){var a=[];for(var i=0;i<12;i++)a.push(v);return a;};
    // A funded budget (so the card renders) + an OVERSPENT buffer pool (raw −$400, crosses in July like the history test).
    state.meta={cats:{"cushion":{type:"monthly",roll:"buffer"}},cons:{},goals:[],payees:['Me'],floor:0,startCash:0};
    state.cons=[{name:'Inc',annual:120000,bud12:fill(10000)}];
    state.cats=[{name:'Cushion',mbud:500,mused:1000,annual:6000,bud12:fill(500)}];
    SPEND["cushion"]=[300,300,300,300,1200,500,1000,0,0,0,0,0]; // → pool −$400 through Jul
    state.goals=[];state.assets=[];state.debts=[];state.rows=[[2026,8,'2026-08-01','','x','',0,'','N']];
    state._stMode="actual";

    var res={};
    // (1)+(2) Starting savings = $0 → note visible + header renamed + contingency connector
    state.meta.startCash=0;renderStress();
    var bn=$("stBaseNote"),grid=$("stGrid").innerHTML,verdict=$("stVerdict").innerHTML;
    res.zero={header:/Projected cash/.test(grid)&&!/>Balance</.test(grid),
      noteShown:bn&&bn.style.display!=="none",
      noteText:bn?bn.innerHTML:"",
      noteWarnsBaseline:bn&&/Starting savings/.test(bn.innerHTML)&&/\$0 (starting|start)/i.test(bn.innerHTML)&&/not the money you actually have/i.test(bn.innerHTML),
      connectsContingency:/not your contingency/.test(verdict)&&/overspent by \$400\.00/.test(verdict)&&/doesn.t refill it/.test(verdict)};

    // (3) Starting savings set → note hidden
    state.meta.startCash=5000;renderStress();
    var bn2=$("stBaseNote");
    res.set={noteHidden:bn2&&bn2.style.display==="none"};

    // (4) buffer POSITIVE → connector is the neutral "separate from your contingency" note, not the overspent warning
    SPEND["cushion"]=fill(0);state.meta.startCash=0;renderStress(); // no spend → pool banks positive
    var verdict2=$("stVerdict").innerHTML;
    res.pos={neutral:/separate from your contingency/.test(verdict2)&&!/overspent by/.test(verdict2)};
    return res;
  });

  ck('column header is "Projected cash" (not the ambiguous "Balance")', R.zero.header, JSON.stringify({header:R.zero.header}));
  ck('Starting savings $0 → conspicuous note: these are a trend from a $0 start, not actual cash on hand', R.zero.noteShown&&R.zero.noteWarnsBaseline, R.zero.noteText);
  ck('overspent contingency → verdict says projected cash is NOT the contingency and a positive trend doesn’t refill it', R.zero.connectsContingency, JSON.stringify(R.zero));
  ck('Starting savings set (>$0) → the $0-baseline note disappears', R.set.noteHidden, JSON.stringify(R.set));
  ck('contingency in the black → neutral "separate from your contingency" note, no overspent warning', R.pos.neutral, JSON.stringify(R.pos));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

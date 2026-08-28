/* Verify syncDropdowns: builds Category (parents + clean bill names + Deposit) and Contributor lists from the summary,
   writes them to the hidden source tabs, and applies data validations across the WHOLE ledger (cols E and D). */
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
  await page.waitForFunction(()=>typeof syncDropdowns==='function'&&typeof ddList==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    window.sheetId="X";window.LEDGER_GID=9;
    window.__writes=[];window.__cleared=[];window.__batch=[];
    window.vBatchUpdate=async function(data){Array.prototype.push.apply(window.__writes,data);};
    window.vBatchClear=async function(ranges){Array.prototype.push.apply(window.__cleared,ranges);};
    window.api=async function(url,opts){
      if(/:batchUpdate$/.test(url)){window.__batch.push(JSON.parse(opts.body));return {replies:[]};}
      if(/fields=sheets\(properties/.test(url)){return {sheets:[
        {properties:{title:"Account Ledger",sheetId:9,gridProperties:{rowCount:2500}}},
        {properties:{title:"Account Categories",sheetId:5,gridProperties:{rowCount:1000}}},
        {properties:{title:"Contributors",sheetId:6,gridProperties:{rowCount:400}}}
      ]};}
      return {};
    };
    // Beauty is itemized with bills Hair/Nails/Brows; Groceries is plain. Two contributors.
    state.meta={cats:{beauty:{type:"itemized",items:[{name:"Hair"},{name:"Nails"},{name:"Brows"}]}}};
    state._sheetSubs={};
    state.cats=[{name:"Groceries"},{name:"Beauty"}];
    state.cons=[{name:"Candice"},{name:"Denzell"}];
    // ledger has an AD-HOC category ("Pets") and AD-HOC source ("Side Gig") that were typed while logging but never budgeted
    window.isGoalName=function(){return false;};
    state.rows=[
      [2026,8,'2026-08-01','Me','Groceries','Publix',40,'',''],
      [2026,8,'2026-08-02','Me','Pets','Chewy',30,'',''],
      [2026,8,'2026-08-05','Side Gig','Deposit','',200,'','']
    ];

    var list=ddList();
    var ok1=await syncDropdowns();
    // capture the category + contributor writes
    var catW=window.__writes.filter(w=>/Account Categories'!C2:/.test(w.range))[0];
    var conW=window.__writes.filter(w=>/Contributors'!A2:/.test(w.range))[0];
    var reqs=[];window.__batch.forEach(bd=>(bd.requests||[]).forEach(rq=>reqs.push(rq)));
    var dvs=reqs.filter(rq=>rq.setDataValidation).map(rq=>rq.setDataValidation);
    // second call with no change -> should be a no-op (no new writes/batches)
    var wBefore=window.__writes.length,bBefore=window.__batch.length;
    var ok2=await syncDropdowns();
    var noop=(window.__writes.length===wBefore&&window.__batch.length===bBefore);
    // change the list -> should re-sync
    state.cons.push({name:"Joint"});
    var ok3=await syncDropdowns();
    var conW2=window.__writes.filter(w=>/Contributors'!A2:/.test(w.range)).pop();
    return {list:list, catW:catW, conW:conW, dvs:dvs, ok1:ok1, noop:noop, ok3:ok3, conW2:conW2, cleared:window.__cleared};
  });

  const cats=res.list.cats.join("|");
  ck('category list = Deposit + parents + clean bill names (no ↳) + ad-hoc ledger names, deduped',
     cats==="Deposit|Groceries|Beauty|Hair|Nails|Brows|Pets", cats);
  ck('AD-HOC ledger category ("Pets") is in the SHEET dropdown list even though it is not budgeted', res.list.cats.indexOf("Pets")>=0, cats);
  ck('contributor list = summary contributors + ad-hoc ledger source', res.list.cons.join("|")==="Candice|Denzell|Side Gig", res.list.cons.join("|"));
  ck('AD-HOC ledger source ("Side Gig") is in the SHEET dropdown list even though it is not budgeted', res.list.cons.indexOf("Side Gig")>=0, res.list.cons.join("|"));
  ck('category list written to Account Categories!C2 (Deposit first)',
     !!res.catW&&res.catW.values[0][0]==="Deposit"&&res.catW.values.length===7, JSON.stringify(res.catW&&res.catW.range));
  ck('contributor list written to Contributors!A2', !!res.conW&&res.conW.values[0][0]==="Candice", JSON.stringify(res.conW&&res.conW.range));

  const catDV=res.dvs.find(d=>d.range.startColumnIndex===4), conDV=res.dvs.find(d=>d.range.startColumnIndex===3);
  ck('Category validation on col E over the whole ledger grid (rows 2..2500)',
     !!catDV&&catDV.range.sheetId===9&&catDV.range.startRowIndex===1&&catDV.range.endRowIndex===2500&&catDV.range.endColumnIndex===5, JSON.stringify(catDV&&catDV.range));
  ck('Category validation reads the Account Categories!C list (grown to include the ad-hoc name)',
     !!catDV&&catDV.rule.condition.type==="ONE_OF_RANGE"&&/Account Categories'!\$C\$2:\$C\$8/.test(catDV.rule.condition.values[0].userEnteredValue), JSON.stringify(catDV&&catDV.rule.condition.values));
  ck('Category dropdown allows typing (strict:false) + shows arrow (showCustomUi)',
     !!catDV&&catDV.rule.strict===false&&catDV.rule.showCustomUi===true, JSON.stringify(catDV&&catDV.rule));
  ck('Contributor validation on col D reads the Contributors!A list',
     !!conDV&&conDV.range.startColumnIndex===3&&conDV.range.endColumnIndex===4&&/Contributors'!\$A\$2:\$A\$4/.test(conDV.rule.condition.values[0].userEnteredValue), JSON.stringify(conDV&&conDV.rule.condition.values));
  ck('stale trailing source cells cleared', res.cleared.some(r=>/Account Categories'!C9:/.test(r))&&res.cleared.some(r=>/Contributors'!A5:/.test(r)), JSON.stringify(res.cleared));
  ck('unchanged list -> no-op (no redundant API calls)', res.noop, String(res.noop));
  ck('changed list -> re-syncs (new contributor written)', res.ok3&&!!res.conW2&&res.conW2.values.length===4, JSON.stringify(res.conW2&&res.conW2.values));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

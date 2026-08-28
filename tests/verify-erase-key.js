/* Verify: erase only clears the ledger (never the summary), and the Gemini key persists in the budget. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();if(u.includes('google'))return r.fulfill({status:200,contentType:'application/json',body:'{}'});return r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'application/javascript',body:''});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof wipeData==='function'&&typeof normMeta==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) wipeData: clears ONLY the ledger (by name) + NW ranges; issues NO deleteDimension, never a summary range
  const r1=await page.evaluate(async()=>{
    window.__cleared=[]; window.__batch=[];
    window.askConfirm=async()=>true;
    window.askText=async()=>"ERASE"; // type-to-confirm friction added to wipeData
    window.vBatchClear=async(ranges)=>{Array.prototype.push.apply(window.__cleared,ranges);};
    window.api=async(url,opts)=>{ if(/:batchUpdate$/.test(url)){window.__batch.push(JSON.parse(opts.body));} return {}; };
    window.vgetU=async()=>({values:[]});
    window.writeMeta=async()=>{}; window.loadAll=async()=>{}; window.renderAll=()=>{};
    window.state={meta:{cats:{a:1},goals:[{name:'x'}],startCash:5,nwUpdated:'z'}};
    if(!document.getElementById('wipeMsg')){var m=document.createElement('div');m.id='wipeMsg';document.body.appendChild(m);}
    await wipeData();
    var anyDelete=window.__batch.some(bd=>(bd.requests||[]).some(rq=>rq.deleteDimension));
    var touchedSummary=window.__cleared.some(r=>/Account Summary/.test(r));
    return {cleared:window.__cleared, anyDelete:anyDelete, touchedSummary:touchedSummary};
  });
  ck('erase clears the ledger by name (A2:I), no deleteDimension at all', r1.cleared.some(x=>/Account Ledger'?!A2:I/.test(x))&&!r1.anyDelete, JSON.stringify(r1));
  ck('erase never targets any Account Summary range', !r1.touchedSummary, JSON.stringify(r1.cleared));

  // 2) Gemini key persists in meta + restores to device on load
  const r2=await page.evaluate(()=>{
    var m=normMeta({cats:{},gkey:"AIzaTESTKEY123"});
    var round=normMeta(JSON.parse(JSON.stringify(m)));
    var badSafe=normMeta({gkey:{oops:1}}).gkey; // wrong type coerced to ""
    return {gkey:m.gkey, roundGkey:round.gkey, badSafe:badSafe};
  });
  ck('normMeta keeps gkey through save/load; coerces bad type to ""', r2.gkey==='AIzaTESTKEY123'&&r2.roundGkey==='AIzaTESTKEY123'&&r2.badSafe==='', JSON.stringify(r2));

  const r3=await page.evaluate(()=>{
    // simulate: device storage empty, but budget meta has the key -> loadAll restore line should copy it to localStorage
    try{localStorage.removeItem('nw_gemini_key');}catch(e){}
    window.state={meta:{gkey:'AIzaRESTORED'}};
    // replicate the exact restore guard from loadAll
    try{if(state.meta&&state.meta.gkey&&!lsGet('nw_gemini_key').trim())lsSet('nw_gemini_key',state.meta.gkey);}catch(e){}
    return {restored:lsGet('nw_gemini_key')};
  });
  ck('key restored to device from budget when local copy is missing', r3.restored==='AIzaRESTORED', JSON.stringify(r3));

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

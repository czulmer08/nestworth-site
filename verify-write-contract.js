/* VERIFIED-WRITE CONTRACT. Product invariant: "If NestWorth reports success, persistence was confirmed. If persistence is
   uncertain or failed, don't report success — preserve the user's input, stay recoverable, and surface an actionable error."
   This suite exercises the highest-risk write paths (transaction edit/delete, the metadata document, net-worth balances) and
   asserts the contract holds — not merely that an error string exists somewhere, but that a failed/unverified write causes NO
   false success and NO wrong-row mutation. Runtime tests drive the REAL functions; a few structural guards lock the shape.
   SCOPE: single-client. Live two-device atomicity remains the documented boundary. */
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
  await page.waitForFunction(()=>typeof saveEdit==='function'&&typeof deleteEdit==='function'&&typeof writeMeta==='function'&&typeof applyNW==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

  // TXN-EDIT-002 — the row this editor points at now holds a DIFFERENT transaction (moved/edited elsewhere). saveEdit must
  // REFUSE to overwrite it: no write, reload, inform. (The wrong-$2000-transaction case.)
  const edit=await page.evaluate(async()=>{
    state.rows=[[2026,8,'2026-08-01','Me','Groceries','Publix',50,'lunch','N']];edIdx=0;
    var writes=0,info=0,loaded=0;
    window.vgetU=async function(range){if(/!A2:I2$/.test(String(range)))return {values:[[2026,8,'2026-08-01','Me','Rent','Landlord',2000,'','N']]};return {values:[]};}; // a $2000 rent txn now sits at this row
    window.vBatchUpdate=async function(){writes++;return {};};
    window.loadAll=async function(){loaded++;};window.renderAll=function(){};window.closeEdit=function(){$("editOv").style.display="none";};window.askInfo=async function(){info++;};window.askConfirm=async function(){return true;};
    $("edAmount").value="75";$("edDate").value="2026-08-01";if($("edCategory"))$("edCategory").value="Groceries";$("edSave").disabled=false;
    await saveEdit();
    return {writes:writes,info:info,loaded:loaded,rowUnchanged:state.rows[0][6]===50};
  });
  ck('TXN-EDIT-002: identity mismatch → the differing row is NOT overwritten (no write; reloaded; user informed)', edit.writes===0&&edit.info===1&&edit.loaded===1&&edit.rowUnchanged, JSON.stringify(edit));

  // TXN-DELETE-001 — identity can't be confirmed → delete NOTHING.
  const del=await page.evaluate(async()=>{
    state.rows=[[2026,8,'2026-08-01','Me','Groceries','Publix',50,'lunch','N']];edIdx=0;deleteEdit._busy=false;
    var deletes=0,info=0,loaded=0;
    window.askConfirm=async function(){return true;}; // user confirmed the delete prompt
    window.vgetU=async function(range){if(/!A2:I2$/.test(String(range)))return {values:[[2026,8,'2026-08-01','Me','Rent','Landlord',2000,'','N']]};return {values:[]};};
    window.ledgerGid=async function(){return 123;};
    window.api=async function(url,opts){if(/deleteDimension/.test((opts&&opts.body)||''))deletes++;return {};};
    window.loadAll=async function(){loaded++;};window.renderAll=function(){};window.closeEdit=function(){$("editOv").style.display="none";};window.askInfo=async function(){info++;};
    await deleteEdit();
    return {deletes:deletes,info:info,loaded:loaded,rowStillThere:state.rows.length===1};
  });
  ck('TXN-DELETE-001: identity unconfirmed → NOTHING is deleted (no deleteDimension; reloaded; informed)', del.deletes===0&&del.info===1&&del.loaded===1&&del.rowStillThere, JSON.stringify(del));

  // META-SAVE-001 — a metadata write that can't be confirmed must fail closed: return false, show the retry banner, keep the
  // user's change in memory, and NOT advance the merge baseline (which would silently lose the change on the next merge).
  const meta=await page.evaluate(async()=>{
    var bb=document.getElementById('metaSaveBar');if(bb)bb.remove();
    state.meta=normMeta({startCash:100,goals:[],cats:{},cons:{}});_metaBase=JSON.parse(JSON.stringify(state.meta));
    state.meta.startCash=4242; // the user's change
    window.vgetU=async function(){return {values:[[JSON.stringify(_metaBase)]]};}; // remote still holds the old doc
    window.vBatchUpdate=async function(){throw new Error("network down");};
    var res1=await writeMeta();
    var fail={result:res1,bar:!!document.getElementById('metaSaveBar'),baseAdvanced:_metaBase.startCash===4242,intentKept:state.meta.startCash===4242};
    window.vBatchUpdate=async function(){return {};}; // retry succeeds
    var res2=await writeMeta();
    var ok={result:res2,barCleared:!document.getElementById('metaSaveBar'),baseAdvanced:_metaBase.startCash===4242};
    return {fail:fail,ok:ok};
  });
  ck('META-SAVE-001: failed meta write FAILS CLOSED — returns false, shows retry banner, keeps the change, does NOT advance baseline', meta.fail.result===false&&meta.fail.bar===true&&meta.fail.baseAdvanced===false&&meta.fail.intentKept===true, JSON.stringify(meta.fail));
  ck('META-SAVE-001: successful retry persists — advances baseline and clears the banner', meta.ok.result===true&&meta.ok.baseAdvanced===true&&meta.ok.barCleared===true, JSON.stringify(meta.ok));

  // META-PEND-001 — a meta save that couldn't be confirmed is persisted DURABLY (survives an app close/reload) and re-applied by
  // reconcilePendingMeta on next load, then cleared. This closes the meta half of multi-stage config writes (fold/combine/rename).
  const metaPend=await page.evaluate(async()=>{
    try{localStorage.removeItem('nw_meta_pending');}catch(e){}var bb=document.getElementById('metaSaveBar');if(bb)bb.remove();
    state.meta=normMeta({startCash:100,goals:[],cats:{},cons:{}});_metaBase=JSON.parse(JSON.stringify(state.meta));
    state.meta.startCash=7777; // the change
    window.vgetU=async function(){return {values:[[JSON.stringify(_metaBase)]]};};
    window.vBatchUpdate=async function(){throw new Error("down");};
    await writeMeta(); // fails → should persist the pending doc durably
    var pendStored=null;try{pendStored=JSON.parse(localStorage.getItem('nw_meta_pending')||'null');}catch(e){}
    // simulate a reload: baseline back to the old doc, connection restored
    _metaBase=normMeta({startCash:100,goals:[],cats:{},cons:{}});state.meta=JSON.parse(JSON.stringify(_metaBase));
    var writes=0;window.vBatchUpdate=async function(){writes++;return {};};window.vgetU=async function(){return {values:[[JSON.stringify(_metaBase)]]};};
    await reconcilePendingMeta();
    var pendAfter=null;try{pendAfter=localStorage.getItem('nw_meta_pending');}catch(e){}
    return {pendHadChange:!!(pendStored&&pendStored.startCash===7777),writesOnReconcile:writes,cleared:!pendAfter,reapplied:state.meta.startCash===7777};
  });
  ck('META-PEND-001: an unconfirmed meta save is persisted durably, re-applied on next load, then cleared', metaPend.pendHadChange&&metaPend.writesOnReconcile===1&&metaPend.cleared&&metaPend.reapplied, JSON.stringify(metaPend));

  // Structural guards — scoped to each function's own body (so a pattern in a NEIGHBOURING function can't satisfy/spoil them).
  const S=src;
  function fnBody(name){var i=S.indexOf("async function "+name+"(");if(i<0)i=S.indexOf("function "+name+"(");if(i<0)return "";var a=S.indexOf("\nasync function ",i+6),b2=S.indexOf("\nfunction ",i+6);var e=Math.min(a<0?1e9:a,b2<0?1e9:b2);return S.slice(i,e<1e9?e:i+4000);}
  const applyBody=fnBody("applyNW"),wmBody=fnBody("writeMeta"),rmBody=fnBody("removeNW");
  // NW-ATOMIC-001 — applyNW must not wipe balances on a mid-write failure: single vBatchUpdate of the block, no destructive pre-clear.
  ck('NW-ATOMIC-001: applyNW writes the block in ONE vBatchUpdate with no destructive pre-clear of the NW block', /await vBatchUpdate\(data\)/.test(applyBody)&&!/vBatchClear\(\[NW\+/.test(applyBody), '');
  ck('expense, deposit and recurring-bill creation all use the idempotent durable-id append path', (S.match(/idempotentAppend\(/g)||[]).length>=4, String((S.match(/idempotentAppend\(/g)||[]).length)+' idempotentAppend refs');
  ck('removeNW surfaces a failure (no empty catch on the account-removal write)', /catch\(e\)\{await askInfo/.test(rmBody), '');
  ck('writeMeta advances the baseline ONLY after a confirmed write (metaSaveOK on success, metaSaveFailed on failure)', /await vBatchUpdate\(\[\{range:META_SHEET[\s\S]*?_metaBase=_clone\(merged\)[\s\S]*?metaSaveOK\(\)/.test(wmBody)&&/metaSaveFailed\(\);return false/.test(wmBody), '');
  ck('saveEdit/deleteEdit no longer offer a "Save/Delete anyway" choice on an identity mismatch', !/cancel:"Save anyway"/.test(S)&&!/cancel:"Delete anyway"/.test(S), '');

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.slice(0,3).join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  console.log('  SCOPE: single-client verified-write contract. Live two-device atomicity remains the documented boundary.');
  await b.close();server.close();process.exit((fail||errs.length)?1:0);
})();

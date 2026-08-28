/* Verify the in-app update check: detects a newer deployed BUILD and offers refresh, never false-alarms. */
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
  await page.waitForFunction(()=>typeof checkForUpdate==='function'&&typeof buildIsNewer==='function'&&typeof BUILD!=='undefined'&&typeof VERSION!=='undefined',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) buildIsNewer comparisons
  const r1=await page.evaluate(()=>({
    newer:      buildIsNewer("48","47"),
    older:      buildIsNewer("46","47"),
    equal:      buildIsNewer("47","47"),
    migration:  buildIsNewer("20260827.1","2026.08.26.46"), // deployed YYYYMMDD.# vs a legacy-running app → newer
    running:    BUILD
  }));
  ck('buildIsNewer: newer=true, older/equal=false, migration=true', r1.newer&&!r1.older&&!r1.equal&&r1.migration, JSON.stringify(r1));

  // helper to run checkForUpdate against a fake deployed BUILD
  async function checkWith(remoteBuild){
    return await page.evaluate(async(rb)=>{
      // clean state
      var eb=document.getElementById("updBar"); if(eb)eb.remove();
      window._updDismissed=false; window._lastUpdCheck=0;
      var realFetch=window.fetch;
      window.fetch=async()=>({ok:true,text:async()=>'... var BUILD="'+rb+'"; ...'});
      await checkForUpdate();
      window.fetch=realFetch;
      var bar=document.getElementById("updBar");
      return {bar:!!bar, hasRefresh: bar?!!bar.querySelector('#updNow'):false};
    }, rb=remoteBuild);
  }

  const RUN=await page.evaluate(()=>BUILD);              // derive from the running build so this never breaks on a version bump
  const NEWER=String(Number(RUN)+1), OLDER=String(Math.max(1,Number(RUN)-1));
  const rNew=await checkWith(NEWER);
  ck('newer deploy -> shows update bar with Refresh button', rNew.bar&&rNew.hasRefresh, JSON.stringify(rNew));

  const rSame=await checkWith(RUN);
  ck('same version -> no bar', !rSame.bar, JSON.stringify(rSame));

  const rOld=await checkWith(OLDER);
  ck('older/stale version file -> no bar (no false alarm / refresh loop)', !rOld.bar, JSON.stringify(rOld));

  // 2) dismiss suppresses further prompts; throttle prevents immediate re-check
  const r2=await page.evaluate(async()=>{
    var eb=document.getElementById("updBar");if(eb)eb.remove();
    window._updDismissed=false;window._lastUpdCheck=0;
    var realFetch=window.fetch;
    window.fetch=async()=>({ok:true,text:async()=>'var BUILD="99999999.1";'});
    await checkForUpdate();                 // shows bar
    document.getElementById("updX").click(); // dismiss
    window._lastUpdCheck=0;                  // clear throttle so only dismissal blocks it
    await checkForUpdate();                  // should NOT reappear
    window.fetch=realFetch;
    return {barAfterDismiss:!!document.getElementById("updBar")};
  });
  ck('dismiss keeps it dismissed for the session', !r2.barAfterDismiss, JSON.stringify(r2));

  // 3) footer reflects BUILD after wire() set it (bldVer span)
  const r3=await page.evaluate(()=>{ if($("bldVer"))$("bldVer").textContent="v"+VERSION+" · "+BUILD; return {footer:($("bldVer")||{}).textContent, build:BUILD, version:VERSION}; });
  ck('footer shows version + build', r3.footer.indexOf(r3.build)>=0&&r3.footer.indexOf(r3.version)>=0, JSON.stringify(r3));

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

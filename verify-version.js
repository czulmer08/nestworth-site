/* Verify SemVer + YYYYMMDD.# build number and the migration-aware update comparison (buildKey/buildIsNewer). */
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
  await page.waitForFunction(()=>typeof buildIsNewer==='function'&&typeof VERSION!=='undefined',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const r=await page.evaluate(()=>({
    version:VERSION, build:BUILD,
    seqCounter: buildIsNewer("20260827.2","20260827.1"),   // same day, next deploy
    nextDay:    buildIsNewer("20260828.1","20260827.9"),   // new day beats a high counter on the old day
    equal:      buildIsNewer("20260827.1","20260827.1"),
    migLegacy:  buildIsNewer("20260827.1","2026.08.26.46"), // running legacy -> deployed new date-build is newer
    migInt:     buildIsNewer("20260827.1","48"),            // running interim integer -> newer
    noDownLegacy: buildIsNewer("2026.08.26.46","20260827.1"), // deployed still legacy -> not newer
    noDownInt:  buildIsNewer("48","20260827.1"),            // deployed interim int -> not newer
    exBuild: ('var BUILD="20260827.3";').match(/BUILD\s*=\s*"([\d.]+)"/)[1]
  }));

  ck('VERSION is SemVer (0.x while in dev)', /^\d+\.\d+\.\d+$/.test(r.version), r.version);
  ck('BUILD is YYYYMMDD.#', /^\d{8}\.\d+$/.test(r.build), r.build);
  ck('same-day next deploy is newer', r.seqCounter===true, ''+r.seqCounter);
  ck('a new day beats a high counter on the old day', r.nextDay===true, ''+r.nextDay);
  ck('equal build is not newer', r.equal===false, ''+r.equal);
  ck('migration: date-build newer than legacy + interim-int running app', r.migLegacy&&r.migInt, JSON.stringify({l:r.migLegacy,i:r.migInt}));
  ck('no downgrade: legacy/interim deploy not newer than a date-build app', !r.noDownLegacy&&!r.noDownInt, JSON.stringify({l:r.noDownLegacy,i:r.noDownInt}));
  ck('update regex extracts the YYYYMMDD.# build', r.exBuild==="20260827.3", r.exBuild);

  const disp=await page.evaluate(()=>{ if($("bldVer"))$("bldVer").textContent="v"+VERSION+" · "+BUILD; if($("settVer"))$("settVer").textContent=VERSION; if($("settBuild"))$("settBuild").textContent=BUILD;
    return {foot:($("bldVer")||{}).textContent, sv:($("settVer")||{}).textContent, sb:($("settBuild")||{}).textContent}; });
  ck('Settings shows Version + Build; footer shows both', disp.sv===VERSIONv(disp)&&disp.foot.indexOf(disp.sb)>=0, JSON.stringify(disp));

  let pass=0,fail=0;out.forEach(x=>{console.log((x.ok?'  PASS ':'  FAIL ')+x.n+(x.d?('  ['+x.d+']'):''));x.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
  function VERSIONv(){return r.version;}
})();

/* Verify folder-based budget discovery + selection ordering (fresh-device fallback that survives renames). */
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
  await page.waitForFunction(()=>typeof discoverBudgets==='function'&&typeof orderBudgetsForOpen==='function'&&typeof getNwFolder==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) discoverBudgets: lists owned spreadsheets + resolves shared shortcuts, flags owned vs shared
  const r1=await page.evaluate(async()=>{
    window.getNwFolder=async()=>"folder1";
    window.trackBudget=()=>{};
    window.api=async(url)=>{
      var d=decodeURIComponent(url);
      if(/in parents/.test(d)) return {files:[
        {id:"OWN-A",name:"My Renamed Budget",mimeType:"application/vnd.google-apps.spreadsheet"},
        {id:"OWN-B",name:"NestWorth Budget",mimeType:"application/vnd.google-apps.spreadsheet"},
        {id:"SC1",name:"Holland Household",mimeType:"application/vnd.google-apps.shortcut",shortcutDetails:{targetId:"SHARED-X"}}
      ]};
      return {files:[]};
    };
    var res=await discoverBudgets();
    return res;
  });
  const own=r1.filter(x=>x.owned), shar=r1.filter(x=>!x.owned);
  ck('discoverBudgets: 2 owned + 1 shared, shortcut resolved to target id', own.length===2&&shar.length===1&&shar[0].id==='SHARED-X', JSON.stringify(r1));

  // 2) orderBudgetsForOpen: default-named owned first, then other owned, then shared
  const r2=await page.evaluate(()=>{
    var found=[
      {id:"SC",name:"Household",owned:false},
      {id:"OWN2",name:"Vacation Fund",owned:true},
      {id:"OWN1",name:"NestWorth Budget",owned:true}
    ];
    return orderBudgetsForOpen(found).map(x=>x.id);
  });
  ck('ordering: default-named owned first, then owned, then shared', JSON.stringify(r2)===JSON.stringify(["OWN1","OWN2","SC"]), JSON.stringify(r2));

  // 3) contributor-only person: only a shared shortcut in the folder -> that shared budget is chosen
  const r3=await page.evaluate(()=>{
    var found=[{id:"SHARED-only",name:"Family Budget",owned:false}];
    var ordered=orderBudgetsForOpen(found);
    return {first:ordered[0].id, len:ordered.length};
  });
  ck('contributor-only: a lone shared budget is selectable', r3.first==='SHARED-only'&&r3.len===1, JSON.stringify(r3));

  // 4) rename resilience: an owned budget with a NON-default name is still discovered & selectable (no default-named one present)
  const r4=await page.evaluate(()=>{
    var found=[{id:"RENAMED",name:"Smith Family 2026",owned:true},{id:"SC",name:"Shared",owned:false}];
    return orderBudgetsForOpen(found)[0].id;
  });
  ck('rename resilience: renamed owned budget selected over a shared one', r4==='RENAMED', JSON.stringify(r4));

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

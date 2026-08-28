/* Verify layout detection + dynamic grow-by-10 (insert rows, copy formula row, extend totals). */
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
  await page.waitForFunction(()=>typeof detectLayout==='function'&&typeof growSummary==='function'&&typeof claimRow==='function'&&typeof scanMarkers==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // Install a stateful mock: colA is the summary's column A; insertDimension splices blanks.
  await page.evaluate(()=>{
    window.__batch=[]; window.__vupdates=[];
    // build column A: cats 5..45, TOTAL 46, CONTRIB 48, Contributor 49, income 50..65, TOTAL CONTRIBUTIONS 66
    var colA=[]; for(var i=0;i<80;i++)colA.push("");
    for(var r=5;r<=45;r++)colA[r-1]="Cat"+(r-4);          // 41 categories -> section FULL
    colA[46-1]="TOTAL"; colA[48-1]="CONTRIBUTIONS — who funds this"; colA[49-1]="Contributor";
    for(var r2=50;r2<=65;r2++)colA[r2-1]="Inc"+(r2-49);
    colA[66-1]="TOTAL CONTRIBUTIONS";
    window.__colA=colA;
    window.ssBase=()=>"https://sheets/x";
    window.vgetU=async(range)=>{
      var m=range.match(/!A(\d+):A(\d+)$/); // column A scan
      if(m){var a=+m[1],b=+m[2];var vals=[];for(var r=a;r<=b;r++)vals.push([window.__colA[r-1]||""]);return {values:vals};}
      var m2=range.match(/!A(\d+)$/); // single cell (claimRow verify)
      if(m2){return {values:[[window.__colA[(+m2[1])-1]||""]]};}
      return {values:[]};
    };
    window.api=async(url,opts)=>{
      if(/fields=sheets\.properties/.test(url))return {sheets:[{properties:{title:"2026 Account Summary",sheetId:7}}]};
      if(/:batchUpdate$/.test(url)){
        var body=JSON.parse(opts.body);window.__batch.push(body);
        (body.requests||[]).forEach(function(req){
          if(req.insertDimension){var s=req.insertDimension.range.startIndex,e=req.insertDimension.range.endIndex;var blanks=[];for(var i=0;i<(e-s);i++)blanks.push("");Array.prototype.splice.apply(window.__colA,[s,0].concat(blanks));}
        });
        return {replies:[]};
      }
      return {};
    };
    window.vBatchUpdate=async(data)=>{ // used for total-rewrite AND claimRow name write
      (data||[]).forEach(function(d){window.__vupdates.push({range:d.range,v:d.values[0][0]});
        var mm=d.range.match(/!A(\d+)$/); if(mm)window.__colA[(+mm[1])-1]=d.values[0][0];}); // reflect name writes
    };
  });

  // 1) detectLayout reads the expanded layout
  const r1=await page.evaluate(async()=>{ await detectLayout("2026 Account Summary"); return {CAT_END:CAT_END,CON_START:CON_START,CON_END:CON_END}; });
  ck('detectLayout: CAT_END=45, CON_START=50, CON_END=65', r1.CAT_END===45&&r1.CON_START===50&&r1.CON_END===65, JSON.stringify(r1));

  // 2) growSummary(cat): inserts 10 before TOTAL(46), copyPaste from row 5, extends TOTAL sum to new bound
  const r2=await page.evaluate(async()=>{
    window.__batch=[];window.__vupdates=[];
    var ok=await growSummary("2026 Account Summary","cat");
    var reqs=window.__batch[0].requests;
    var ins=reqs.find(x=>x.insertDimension); var cp=reqs.find(x=>x.copyPaste);
    var totalRewrite=window.__vupdates.find(x=>/SUMIF\(\$A\$5:\$A\$55,.*B5:B55\)/.test(x.v));
    return {ok:ok, insStart:ins&&ins.insertDimension.range.startIndex, insCount:ins&&(ins.insertDimension.range.endIndex-ins.insertDimension.range.startIndex),
      cpSrcStart:cp&&cp.copyPaste.source.startRowIndex, cpSrcColStart:cp&&cp.copyPaste.source.startColumnIndex,
      cpDstRows:cp&&(cp.copyPaste.destination.endRowIndex-cp.copyPaste.destination.startRowIndex),
      newCatEnd:CAT_END, totalRewriteRange:totalRewrite&&totalRewrite.range };
  });
  ck('grow(cat): insert 10 rows before TOTAL (index 45)', r2.ok&&r2.insStart===45&&r2.insCount===10, JSON.stringify(r2));
  ck('grow(cat): copyPaste from category formula row 5, skipping name col A', r2.cpSrcStart===4&&r2.cpSrcColStart===1&&r2.cpDstRows===10, JSON.stringify(r2));
  ck('grow(cat): CAT_END now 55, TOTAL SUM extended to B5:B55 at row 56', r2.newCatEnd===55&&/!B56$/.test(r2.totalRewriteRange||''), JSON.stringify(r2));

  // 3) claimRow on a full section grows then claims a fresh row
  const r3=await page.evaluate(async()=>{
    // reset a fresh full layout
    var colA=[];for(var i=0;i<80;i++)colA.push("");for(var r=5;r<=45;r++)colA[r-1]="Cat"+(r-4);colA[45]="TOTAL";colA[47]="CONTRIBUTIONS";colA[48]="Contributor";for(var r2=50;r2<=65;r2++)colA[r2-1]="Inc"+(r2-49);colA[65]="TOTAL CONTRIBUTIONS";
    window.__colA=colA; await detectLayout("2026 Account Summary");
    var row=await claimRow("2026 Account Summary",CAT_START,CAT_END,"NewCategory","cat");
    return {row:row, nameAtRow: row?window.__colA[row-1]:null, grewCatEnd:CAT_END};
  });
  ck('claimRow: full section grew, claimed a new row (46), name written', r3.row===46&&r3.nameAtRow==='NewCategory'&&r3.grewCatEnd===55, JSON.stringify(r3));

  // 4) grow(con): inserts before TOTAL CONTRIBUTIONS, copies income formula row
  const r4=await page.evaluate(async()=>{
    var colA=[];for(var i=0;i<80;i++)colA.push("");for(var r=5;r<=45;r++)colA[r-1]="Cat"+(r-4);colA[45]="TOTAL";colA[47]="CONTRIBUTIONS";colA[48]="Contributor";for(var r2=50;r2<=65;r2++)colA[r2-1]="Inc"+(r2-49);colA[65]="TOTAL CONTRIBUTIONS";
    window.__colA=colA;await detectLayout("2026 Account Summary");
    window.__batch=[];window.__vupdates=[];
    var ok=await growSummary("2026 Account Summary","con");
    var reqs=window.__batch[0].requests;var ins=reqs.find(x=>x.insertDimension);var cp=reqs.find(x=>x.copyPaste);
    return {ok:ok, insStart:ins&&ins.insertDimension.range.startIndex, cpSrc:cp&&cp.copyPaste.source.startRowIndex, newConEnd:CON_END,
      totalConRewrite:(window.__vupdates.find(x=>/=SUM\(B50:B75\)/.test(x.v))||{}).range };
  });
  ck('grow(con): insert before TOTAL CONTRIBUTIONS (index 65), copy income row 50', r4.ok&&r4.insStart===65&&r4.cpSrc===49, JSON.stringify(r4));
  ck('grow(con): CON_END now 75, TOTAL CONTRIB SUM extended to B50:B75', r4.newConEnd===75&&/!B76$/.test(r4.totalConRewrite||''), JSON.stringify(r4));

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

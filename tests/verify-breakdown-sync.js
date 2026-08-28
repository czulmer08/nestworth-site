/* Verify syncBreakdown writes indented bill rows under itemized parents, with two-criteria spent formulas and a SUMIF-exclude TOTAL. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
const ARR="↳";
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof syncBreakdown==='function'&&typeof billMonths==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    var COLS=["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AB"];
    var sheet={};
    function put(cell,v){sheet[cell]=v;}
    put("A5","Groceries"); ["E","G","I","K","M","O","Q","S","U","W","Y","AA"].forEach(function(c){put(c+"5",500);});
    put("A6","Subscriptions");
    var pbud=[159,20,20,20,20,20,20,20,20,20,20,20];
    ["E","G","I","K","M","O","Q","S","U","W","Y","AA"].forEach(function(c,i){put(c+"6",pbud[i]);});
    CAT_START=5;
    window.detectLayout=async function(){CAT_END=34;return true;};
    window.ensureCapacity=async function(){return true;};
    window.summaryName=function(){return "2026 Account Summary";};
    window.catCfg=function(n){return (n==="Subscriptions")?{type:"itemized",items:[
      {name:"Netflix",amount:20,cadence:"Monthly",month:1,day:5},
      {name:"Amazon Prime",amount:139,cadence:"Annual",month:1,day:1}
    ]}:{type:"monthly",amount:500};};
    window.vgetU=async function(range){
      var vals=[];
      for(var row=CAT_START; row<=CAT_END; row++){
        var r=[];for(var c=0;c<COLS.length;c++){var v=sheet[COLS[c]+row];r.push(v===undefined?"":v);}
        vals.push(r);
      }
      return {values:vals};
    };
    window.vBatchUpdate=async function(data){data.forEach(function(d){
      var m=d.range.match(/!([A-Z]+)(\d+)$/); if(!m)return; sheet[m[1]+m[2]]=d.values[0][0];
    });};
    var ok=await syncBreakdown("2026 Account Summary");
    var snap1=JSON.stringify(sheet);
    await syncBreakdown("2026 Account Summary");
    var snap2=JSON.stringify(sheet);
    function g(cell){return sheet[cell];}
    return {ok:ok,A5:g("A5"),A6:g("A6"),A7:g("A7"),A8:g("A8"),E7:g("E7"),E8:g("E8"),F7:g("F7"),F8:g("F8"),F6:g("F6"),B35:g("B35"),E35:g("E35"),F35:g("F35"),idempotent:(snap1===snap2)};
  });

  ck('parents kept, bill rows inserted under Subscriptions', res.A5==="Groceries"&&res.A6==="Subscriptions"&&res.A7===(ARR+" Netflix")&&res.A8===(ARR+" Amazon Prime"), JSON.stringify({A5:res.A5,A6:res.A6,A7:res.A7,A8:res.A8}));
  ck('bill budgets: Netflix Jan=20, Amazon Prime Jan=139', res.E7===20&&res.E8===139, JSON.stringify({E7:res.E7,E8:res.E8}));
  ck('bill spent formula has native tag (category=parent + company=bill)', /\$E:\$E,"Subscriptions"/.test(res.F7)&&/\$F:\$F,"Netflix"/.test(res.F7), res.F7);
  ck('bill spent formula also totals by NAME (historical "Netflix" and "'+ARR+' Netflix" rows)', res.F7.indexOf('$E:$E,"Netflix"')>=0&&res.F7.indexOf('$E:$E,"'+ARR+' Netflix"')>=0, res.F7);
  ck('parent spent formula matches its own category (no company criterion)', /\$E:\$E,\$A6,/.test(res.F6)&&res.F6.indexOf('$F:$F,')<0, res.F6);
  ck('parent total also folds in each bill by NAME (imported rows connect to the itemized category)', res.F6.indexOf('$E:$E,"Netflix"')>=0&&res.F6.indexOf('$E:$E,"Amazon Prime"')>=0&&res.F6.indexOf('$E:$E,"'+ARR+' Netflix"')>=0, res.F6);
  ck('TOTAL row is SUMIF-exclude of bill rows', res.B35&&res.B35.indexOf('SUMIF($A$5:$A$34,"<>'+ARR+'*",B5:B34)')>=0&&/SUMIF/.test(res.E35)&&/SUMIF/.test(res.F35), JSON.stringify({B35:res.B35}));
  ck('running twice is idempotent', res.idempotent, "");

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

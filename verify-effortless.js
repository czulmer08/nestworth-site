/* Verify Effortless: deterministic merchant normalization + auto-categorization that learns from your own history.
   Cleans noisy statement/receipt merchant strings, and fills blank import categories from how you've categorized before. */
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
  await page.waitForFunction(()=>typeof normalizeMerchant==='function'&&typeof merchantCatIndex==='function'&&typeof impAutoCategorize==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(()=>{
    window.isGoalName=()=>false;
    // 1) normalization of noisy statement strings
    var norm={
      amzn:normalizeMerchant("AMZN MKTP US*RT4X9"),
      sq:normalizeMerchant("SQ *BLUE BOTTLE 0123"),
      tst:normalizeMerchant("TST* CHIPOTLE 445 FL"),
      pos:normalizeMerchant("POS DEBIT WM SUPERCENTER #1234 TAMPA FL"),
      wf:normalizeMerchant("WHOLEFDS MKT 10259"),
      auth:normalizeMerchant("PURCHASE AUTHORIZED ON 03/14 TARGET 00021 FL"),
      clean:normalizeMerchant("Publix")
    };
    var normOk=norm.amzn==="Amazon"&&norm.sq==="Blue Bottle"&&norm.tst==="Chipotle"&&norm.pos==="Walmart"&&norm.wf==="Whole Foods"&&norm.auth==="Target"&&norm.clean==="Publix";

    // 2) learn from ledger history, keyed by normalized merchant
    var Y=2026;
    state.rows=[
      [Y,1,Y+'-01-03','Me','Coffee','SQ *BLUE BOTTLE',6,'','N'],
      [Y,1,Y+'-01-04','Me','Coffee','Blue Bottle',6,'','N'],
      [Y,2,Y+'-02-04','Me','Shopping','AMZN MKTP US',40,'','N'],
      [Y,2,Y+'-02-09','Me','Groceries','PUBLIX #123',55,'','N'],
      [Y,3,Y+'-03-01','Me','Deposit','Job',5000,'','N']   // deposits must NOT pollute the index
    ];
    var idx=merchantCatIndex();
    var learnOk=idx['bluebottle']==='Coffee'&&idx['amazon']==='Shopping'&&idx['publix']==='Groceries'&&!idx['job'];
    // suggestion matches a noisy variant with a store tail (prefix fallback) and via the brand table
    var sugTail=suggestCatFor("BLUE BOTTLE COFFEE #55 SF CA");   // -> "bluebottlecoffeesf" starts with "bluebottle"
    var sugBrand=suggestCatFor("AMZN MKTP US*99Z");              // brand table -> Amazon
    var sugUnknown=suggestCatFor("SOME BRAND NEW CAFE 7788");    // no history -> ""
    var sugOk=sugTail==='Coffee'&&sugBrand==='Shopping'&&sugUnknown==='';

    // 3) import auto-categorization: blanks filled from history, company normalized, file categories respected
    state.cats=[{name:'Coffee'},{name:'Shopping'},{name:'Groceries'},{name:'Dining'}];
    IMPTX=[
      {date:Y+'-05-01',category:'',amount:7.25,company:'SQ *BLUE BOTTLE 0987'},
      {date:Y+'-05-02',category:'',amount:52.10,company:'AMZN MKTP US*8H2'},
      {date:Y+'-05-03',category:'Dining',amount:22,company:'TST* CHIPOTLE 12 FL'},   // file already gave a category → keep it
      {date:Y+'-05-04',category:'',amount:15,company:'UNKNOWN CORNER STORE 4421'}     // no history → stays blank
    ];
    var n=impAutoCategorize();
    var t=IMPTX;
    var importOk=(n===2)
      && t[0].category==='Coffee' && t[0]._auto===true && t[0].company==='Blue Bottle'
      && t[1].category==='Shopping' && t[1]._auto===true && t[1].company==='Amazon'
      && t[2].category==='Dining' && !t[2]._auto && t[2].company==='Chipotle'   // respected, but still normalized
      && t[3].category==='' && !t[3]._auto;

    return {norm,normOk,learnOk,sugTail,sugBrand,sugUnknown,sugOk,n,importOk,
            companies:[t[0].company,t[1].company,t[2].company]};
  });

  ck('normalizes noisy card/bank merchant strings to clean names', res.normOk, JSON.stringify(res.norm));
  ck('learns merchant→category from the ledger, keyed by normalized name; deposits excluded', res.learnOk, String(res.learnOk));
  ck('suggests a category for a store-tail variant (prefix fallback) and via the brand table', res.sugOk, JSON.stringify({tail:res.sugTail,brand:res.sugBrand,unknown:res.sugUnknown}));
  ck('import fills 2 blank categories from history and normalizes companies', res.importOk, JSON.stringify({n:res.n,companies:res.companies}));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

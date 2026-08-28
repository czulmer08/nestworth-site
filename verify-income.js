/* Verify: (1) wizard "Once a year" income -> onetime cfg with month; (2) overflow message names items. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((req,res)=>{if(req.url.startsWith("/app.html")){res.writeHead(200,{'Content-Type':'text/html'});res.end(fs.readFileSync(APP,'utf8'));return;}res.writeHead(200,{'Content-Type':'text/plain'});res.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();if(u.includes('google'))return r.fulfill({status:200,contentType:'application/json',body:'{}'});return r.fulfill({status:200,contentType:u.endsWith('.css')?'text/css':'application/javascript',body:''});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof wizIncCfg==='function'&&typeof blankIncome==='function'&&typeof monthsFor==='function',{timeout:8000});

  const out=[];function check(n,ok,d){out.push({n,ok,d:d||''});}

  // 1) onetime income cfg
  const r1=await page.evaluate(()=>{
    var inc=blankIncome(); inc.type='onetime'; inc.annual='1200'; inc.month=4; inc.name='Tax refund';
    var cfg=wizIncCfg(inc);
    var mv=cfg?monthsFor(cfg):null;
    return {cfg:cfg, aprIsFull:mv?mv[3]===1200:false, othersZero:mv?mv.filter((v,i)=>i!==3).every(v=>v===0):false, annualSum:mv?mv.reduce((a,v)=>a+v,0):null};
  });
  check('Once-a-year income -> {type:onetime, month:4, amount:1200}', r1.cfg&&r1.cfg.type==='onetime'&&r1.cfg.month===4&&r1.cfg.amount===1200, JSON.stringify(r1.cfg));
  check('Amount lands only in the chosen month (Apr)', r1.aprIsFull&&r1.othersZero&&r1.annualSum===1200, JSON.stringify({apr:r1.aprIsFull,others0:r1.othersZero,sum:r1.annualSum}));

  // 1b) blank onetime -> null (skipped, not counted)
  const r1b=await page.evaluate(()=>{var inc=blankIncome();inc.type='onetime';inc.annual='';return wizIncCfg(inc);});
  check('Empty once-a-year income is skipped (null)', r1b===null, JSON.stringify(r1b));

  // 1c) type label for onetime income
  const r1c=await page.evaluate(()=>typeLabel({type:'onetime',month:4}));
  check('onetime income shows a friendly label', /One-time · Apr/.test(r1c), r1c);

  // 2) income overflow message names sources (6 valid incomes, cap 5)
  const r2=await page.evaluate(async()=>{
    window.WZ={editMode:false,cats:[],incomes:[
      {name:'Salary',type:'monthly',monthly:'3000'},
      {name:'Side gig',type:'monthly',monthly:'500'},
      {name:'Rental',type:'monthly',monthly:'800'},
      {name:'Dividends',type:'monthly',monthly:'100'},
      {name:'Refund',type:'onetime',annual:'400',month:5},
      {name:'Bonus',type:'onetime',annual:'2000',month:12}
    ]};
    window.state=window.state||{}; state.cats=[]; state.cons=[]; state.meta={cats:{},cons:{},goals:[]};
    // stub network-ish helpers so wizCreate runs to the message without real IO
    window.summaryName=()=>'2026 Account Summary';
    window.vBatchClear=async()=>{}; window.vBatchUpdate=async()=>{}; window.writeMeta=async()=>{};
    window.loadAll=async()=>{}; window.renderAll=()=>{}; window.closeOv=()=>{};
    // ensure a wizCreate button + msg exist
    if(!document.getElementById('wizCreate')){var btn=document.createElement('button');btn.id='wizCreate';document.body.appendChild(btn);}
    await wizCreate();
    var msg=document.getElementById('wizMsg');
    return {html:msg?msg.innerHTML:'(no msg)', bad:msg?msg.className.indexOf('bad')>=0:false};
  });
  check('overflow message names the 1 dropped income source & the 5-cap', /5 income sources/.test(r2.html)&&/Bonus/.test(r2.html)&&r2.bad, r2.html);

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

/* Verify: annual paycheck income + records move when pulling a category into an itemized list. */
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
  await page.waitForFunction(()=>typeof wizIncCfg==='function'&&typeof absorbRetagData==='function'&&typeof addCat==='function'&&typeof wizCreate==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) annual paycheck spreads across the year
  const r1=await page.evaluate(()=>{
    var inc=blankIncome(); inc.type='paycheck'; inc.freq=1; inc.perCheck='60000'; inc.keepMode='all';
    var cfg=wizIncCfg(inc); var mv=cfg?monthsFor(cfg):null;
    return {cfg:cfg, permo:mv?mv[0]:null, allEqual:mv?mv.every(v=>Math.abs(v-mv[0])<0.005):false, sum:mv?Math.round(mv.reduce((a,v)=>a+v,0)):null};
  });
  ck('annual paycheck ($60k, freq 1) -> ~$5000/mo, all 12 equal, sum $60k', r1.cfg&&r1.cfg.freq===1&&Math.abs(r1.permo-5000)<0.5&&r1.allEqual&&r1.sum===60000, JSON.stringify({permo:r1.permo,sum:r1.sum}));

  // 2) absorbRetagData maps source -> parent (E), stamps bill name into empty F
  const r2=await page.evaluate(()=>{
    window.state=window.state||{};
    state.rows=[
      [2026,3,'2026-03-05','','Gas','Shell',50,'',''],   // ledger row 2, F filled
      [2026,4,'2026-04-05','','Gas','',60,'',''],         // ledger row 3, F empty
      [2026,4,'2026-04-06','','Groceries','Publix',20,'',''] // unrelated
    ];
    var d=absorbRetagData('Gas','Car');
    return d.map(x=>({range:x.range,v:x.values[0][0]}));
  });
  const hasE2Car=r2.some(x=>/!E2$/.test(x.range)&&x.v==='Car');
  const hasE3Car=r2.some(x=>/!E3$/.test(x.range)&&x.v==='Car');
  const hasF3Gas=r2.some(x=>/!F3$/.test(x.range)&&x.v==='Gas');
  const noF2   =!r2.some(x=>/!F2$/.test(x.range));       // F2 was filled (Shell) -> untouched
  const noGroc =!r2.some(x=>x.v==='Car'&&/!E4$/.test(x.range));
  ck('retag moves Gas entries to Car (E), stamps bill into empty F, leaves others alone', hasE2Car&&hasE3Car&&hasF3Gas&&noF2&&noGroc, JSON.stringify(r2));

  // 3) LIVE: edit itemized "Car", pull "Gas" -> Gas ledger moves to Car, Gas row cleared, meta dropped
  const r3=await page.evaluate(async()=>{
    window.__cap=[]; window.__clr=[];
    window.state={cats:[{name:'Car',row:10,annual:0,mbud:0,bud12:[]},{name:'Gas',row:8,annual:2400,mbud:200,bud12:[]}],
      cons:[], goals:[], assets:[],debts:[],
      rows:[[2026,3,'2026-03-05','','Gas','Shell',50,'',''],[2026,4,'2026-04-05','','Gas','',60,'','']],
      meta:{cats:{car:{type:'itemized',items:[]},gas:{type:'monthly',amount:200}},cons:{},goals:[]}};
    window.vBatchUpdate=async(d)=>{Array.prototype.push.apply(window.__cap,d);};
    window.vBatchClear=async(r)=>{Array.prototype.push.apply(window.__clr,r);};
    window.writeMeta=async()=>{}; window.loadAll=async()=>{}; window.renderAll=()=>{}; window.claimRow=async()=>0;
    window.catEdit='Car';
    document.getElementById('cName').value='Car';
    document.getElementById('cType').value='itemized';
    window.BILLS=[{name:'Gas',amount:200,cadence:'Monthly',month:1,day:'',months:[],_from:'Gas'}];
    await addCat();
    var capE=window.__cap.filter(x=>/!E[0-9]+$/.test(x.range)).map(x=>x.range+'='+x.values[0][0]);
    return {capE:capE, clrHasGasRow:window.__clr.some(r=>/!A8$/.test(r)), gasMetaGone:!state.meta.cats.gas};
  });
  ck('live pull: Gas ledger rows retagged to Car', r3.capE.some(s=>/!E2=Car/.test(s))&&r3.capE.some(s=>/!E3=Car/.test(s)), JSON.stringify(r3.capE));
  ck('live pull: Gas standalone row cleared & meta dropped', r3.clrHasGasRow&&r3.gasMetaGone, JSON.stringify({clr:r3.clrHasGasRow,meta:r3.gasMetaGone}));

  // 4) WIZARD: new budget, itemized "Car" absorbing "Gas" -> ledger retag at create, Gas not created standalone
  const r4=await page.evaluate(async()=>{
    window.__cap=[];
    window.state={cats:[],cons:[],goals:[],assets:[],debts:[],
      rows:[[2026,3,'2026-03-05','','Gas','Shell',50,'',''],[2026,4,'2026-04-05','','Gas','',60,'','']],
      meta:{cats:{},cons:{},goals:[]}};
    window.WZ={editMode:false,step:3,packs:{},cats:[
      {name:'Car',cfg:{type:'itemized',items:[{name:'Gas',amount:200,cadence:'Monthly',month:1,day:''}]},_absorb:['Gas']}
    ],incomes:[]};
    window.vBatchUpdate=async(d)=>{Array.prototype.push.apply(window.__cap,d);};
    window.vBatchClear=async()=>{}; window.writeMeta=async()=>{}; window.loadAll=async()=>{}; window.renderAll=()=>{}; window.closeOv=()=>{};
    if(!document.getElementById('wizCreate')){var x=document.createElement('button');x.id='wizCreate';document.body.appendChild(x);}
    if(!document.getElementById('wizMsg')){var m=document.createElement('div');m.id='wizMsg';document.body.appendChild(m);}
    await wizCreate();
    var capE=window.__cap.filter(x=>/!E[0-9]+$/.test(x.range)).map(x=>x.range+'='+x.values[0][0]);
    var carWritten=window.__cap.some(x=>/Account Summary/.test(x.range)&&x.values&&x.values[0]&&x.values[0][0]==='Car');
    return {retagged:capE.some(s=>/=Car/.test(s)), carWritten:carWritten, msg:(document.getElementById('wizMsg').textContent||'')};
  });
  ck('wizard create: absorbed Gas entries retagged to Car', r4.retagged&&r4.carWritten, JSON.stringify(r4));

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

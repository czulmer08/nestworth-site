/* Verify the editable "Banked before this year" (carry-in) override. */
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
  await page.waitForFunction(()=>typeof carryInFor==='function'&&typeof catBalance==='function'&&typeof normMeta==='function',{timeout:8000});

  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // 1) carryInFor: computed when no override, override when set
  const r1=await page.evaluate(()=>{
    window.state=window.state||{};
    state.carryIn={gas:-37585.31, groceries:100};
    state.meta={cats:{},cons:{},goals:[],carry:{}};
    var computed=carryInFor('Gas');
    state.meta.carry={gas:0};
    var overridden=carryInFor('Gas');
    var still=carryInFor('Groceries'); // no override -> computed
    return {computed:computed, overridden:overridden, still:still};
  });
  ck('carryInFor uses computed when no override', Math.abs(r1.computed-(-37585.31))<0.01&&Math.abs(r1.still-100)<0.01, JSON.stringify(r1));
  ck('carryInFor uses override (0) when set', r1.overridden===0, JSON.stringify(r1));

  // 2) catBalance reflects the override (kills the giant negative banked)
  const r2=await page.evaluate(()=>{
    window.state.rows=[];
    window.state.spend={gas:[100,100,100,0,0,0,0,0,0,0,0,0]}; // Jan-Mar spent 100 each
    window.state.carryIn={gas:-37585.31};
    window.state.meta={cats:{},cons:{},goals:[],carry:{}};
    // budget 200/mo; current month = say 4 -> months 1..3 counted
    window.bYear=()=>2026; window.curYear=()=>2026; window.curMonth=()=>4;
    window.adoptionYM=()=>200601; // far back -> big negative computed carry
    var cat={name:'Gas',bud12:[200,200,200,200,200,200,200,200,200,200,200,200]};
    var before=catBalance(cat);            // uses computed carry (huge negative)
    state.meta.carry={gas:0};
    var after=catBalance(cat);             // override 0 -> only this-year accumulation: (200-100)*3 = 300
    return {before:before, after:after};
  });
  ck('catBalance huge-negative before override', r2.before<-30000, JSON.stringify(r2));
  ck('catBalance sane after override=0 (3×(200−100)=300)', Math.abs(r2.after-300)<0.01, JSON.stringify(r2));

  // 3) normMeta preserves the carry map through a save/load round-trip
  const r3=await page.evaluate(()=>{
    var m=normMeta({cats:{},carry:{gas:250.5,rent:0}});
    var round=normMeta(JSON.parse(JSON.stringify(m)));
    return {hasCarry:!!m.carry, gas:m.carry.gas, roundGas:round.carry.gas, badShapeSafe:JSON.stringify(normMeta({carry:"oops"}).carry)};
  });
  ck('normMeta keeps carry map + survives round-trip', r3.hasCarry&&r3.gas===250.5&&r3.roundGas===250.5, JSON.stringify(r3));
  ck('normMeta coerces a bad carry value to {}', r3.badShapeSafe==='{}', r3.badShapeSafe);

  let pass=0,fail=0;
  out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

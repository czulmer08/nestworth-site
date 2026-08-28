/* Verify the tab bar sits at the true viewport bottom on BOTH a short page and a long page (internal-scroll app shell, no body scroll). */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage({viewport:{width:390,height:844}});
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof switchView==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // Show the app shell + go to the (short) Goals tab
  const short=await page.evaluate(()=>{
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
    document.getElementById('appScreen').classList.add('on');
    switchView('goals');
    var tb=document.querySelector('.tabbar').getBoundingClientRect();
    var cs=getComputedStyle(document.querySelector('.tabbar'));
    var bodyScrolls=document.body.scrollHeight>window.innerHeight+2;
    return {tabbarBottom:Math.round(tb.bottom), vh:window.innerHeight, position:cs.position, bodyScrolls:bodyScrolls, bodyOverflow:getComputedStyle(document.body).overflow};
  });
  ck('tab bar is position:fixed (pinned to the viewport, not dependent on container height)', short.position==='fixed', JSON.stringify(short));
  ck('SHORT page (Goals): tab bar bottom == viewport bottom', Math.abs(short.tabbarBottom-short.vh)<=1, JSON.stringify(short));
  ck('body does not scroll (overflow hidden)', !short.bodyScrolls && /hidden/.test(short.bodyOverflow), JSON.stringify(short));

  // THE REGRESSION THAT KEPT BITING: iOS can compute the app container (100dvh) SHORTER than the real screen. Force that
  // exact condition and confirm the fixed bar still sits at the true viewport bottom with NOTHING below it.
  const shortDvh=await page.evaluate(()=>{
    document.getElementById('appScreen').classList.add('on');
    // simulate a 60px dvh shortfall by capping the shell height below the window
    var short=window.innerHeight-60;
    document.documentElement.style.height=short+'px';
    document.body.style.height=short+'px';
    document.getElementById('appScreen').style.height=short+'px';
    var tb=document.querySelector('.tabbar').getBoundingClientRect();
    var res={tabbarBottom:Math.round(tb.bottom), vh:window.innerHeight, gapBelow:Math.round(window.innerHeight-tb.bottom)};
    document.documentElement.style.height='';document.body.style.height='';document.getElementById('appScreen').style.height='';
    return res;
  });
  ck('SHORT-container (dvh bug): bar STILL at true viewport bottom, no gap below', Math.abs(shortDvh.gapBelow)<=1, JSON.stringify(shortDvh));

  // Now stuff a LONG page: inject tall content into the goals view and confirm the bar still pins to the bottom, and the inner wrap scrolls
  const long=await page.evaluate(()=>{
    var v=document.getElementById('view-goals');
    var big=document.createElement('div'); big.id='__tall'; big.style.height='4000px'; v.appendChild(big);
    var wrap=document.querySelector('.wrap');
    var innerScrolls=wrap.scrollHeight>wrap.clientHeight+2;
    // scroll the inner content to the bottom; the tab bar must not move
    wrap.scrollTop=wrap.scrollHeight;
    var tb=document.querySelector('.tabbar').getBoundingClientRect();
    var bodyScrolled=window.scrollY;
    big.remove();
    return {tabbarBottom:Math.round(tb.bottom), vh:window.innerHeight, innerScrolls:innerScrolls, bodyScrolled:bodyScrolled};
  });
  ck('LONG page: inner content scrolls (the wrap, not the body)', long.innerScrolls, JSON.stringify(long));
  ck('LONG page: tab bar STILL pinned to viewport bottom after scrolling content', Math.abs(long.tabbarBottom-long.vh)<=1, JSON.stringify(long));
  ck('LONG page: body itself never scrolled', long.bodyScrolled===0, JSON.stringify(long));

  // Sign-in / splash screens still fill and center (they use .center, not .wrap)
  const splash=await page.evaluate(()=>{
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
    document.getElementById('signinScreen').classList.add('on');
    var sc=document.getElementById('signinScreen').getBoundingClientRect();
    return {h:Math.round(sc.height), vh:window.innerHeight};
  });
  ck('sign-in screen fills the viewport height', Math.abs(splash.h-splash.vh)<=1, JSON.stringify(splash));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

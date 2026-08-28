/* Verify the first-run guided tour (coach marks) + the Feature guide overlay. */
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');
const server=http.createServer((q,r)=>{if(q.url.startsWith("/app.html")){r.writeHead(200,{'Content-Type':'text/html'});r.end(fs.readFileSync(APP,'utf8'));return;}r.writeHead(200,{'Content-Type':'text/plain'});r.end("");});
(async()=>{
  await new Promise(r=>server.listen(0,r));const port=server.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const page=await b.newPage();await page.setViewportSize({width:390,height:844});
  const errs=[];page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  await page.addInitScript(()=>{window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken:()=>{}}),revoke:(t,c)=>c&&c()},id:{disableAutoSelect:()=>{}}},picker:{}};window.gapi={load:(_,o)=>o&&o.callback&&o.callback()};});
  await page.route('**/*',r=>{const u=r.request().url();if(u.includes('127.0.0.1'))return r.continue();return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto('http://127.0.0.1:'+port+'/app.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof startTour==='function'&&typeof positionStep==='function'&&typeof renderGuide==='function'&&typeof maybeStartTour==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    // make the app screen visible and neutralize view-side effects the tour triggers
    window.renderSettings=function(){};window.fitStileNums=function(){};window.maybeOfferPullIn=function(){};
    state.cats=[];state.goals=[];state.cons=[];state.rows=[];state.meta={cats:{},cons:{},prefs:{}};
    show('appScreen');
    try{localStorage.removeItem('nw_tour_seen');}catch(e){}
    var wait=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    startTour(0);await wait();
    var dots=document.querySelectorAll('#tourDots i').length;
    var onAtStart=$("tourWrap").classList.contains("on");
    var titleWelcome=$("tourTitle").textContent;
    var holeNohole0=$("tourHole").classList.contains("nohole"); // welcome step: no target
    var tipL0=parseFloat($("tourTip").style.left); // centered, not offscreen
    var backHidden0=$("tourBack").style.visibility==="hidden";

    tourNext();await wait(); // step 1: Add tab
    var addViewOn=$("view-add").classList.contains("on");
    var holeShown1=!$("tourHole").classList.contains("nohole")&&parseFloat($("tourHole").style.width)>0;
    var tipInView1=(function(){var l=parseFloat($("tourTip").style.left),t=parseFloat($("tourTip").style.top);return l>=0&&l<=390&&t>=0&&t<=844;})();

    // jump to the Month step and confirm the view actually switched under the highlight
    _ti=3;tourGo();await wait();
    var monthViewOn=$("view-month").classList.contains("on");
    var nextLabelMid=$("tourNext").textContent;

    // last step shows "Done"
    _ti=7;tourGo();await wait();
    var settingsViewOn=$("view-settings").classList.contains("on");
    var doneLabel=$("tourNext").textContent;

    tourBack();await wait();var backWorks=(_ti===6);

    // Wren changes pose across steps
    var poses={};for(var k=0;k<8;k++){_ti=k;tourGo();await wait();poses[$("tourWren").className]=1;}
    var poseVariety=Object.keys(poses).length;
    // a profiles/sharing step exists
    var hasProfiles=TOUR.some(function(s){return /profile/i.test(s.title)||/switch between/i.test(s.body);});

    endTour();
    var offAfterEnd=!$("tourWrap").classList.contains("on");
    var seen=localStorage.getItem('nw_tour_seen');

    // Feature guide
    renderGuide();
    var cats=document.querySelectorAll('#guideBody .guidecat').length;
    var rows=document.querySelectorAll('#guideBody .guiderow').length;
    openGuide();
    var guideOpen=getComputedStyle($("guideOv")).display==="flex";
    closeOv("guideOv");

    return {dots,onAtStart,titleWelcome,holeNohole0,tipL0,backHidden0,addViewOn,holeShown1,tipInView1,monthViewOn,nextLabelMid,settingsViewOn,doneLabel,backWorks,offAfterEnd,seen,cats,rows,guideOpen,poseVariety,hasProfiles};
  });

  ck('tour opens with 8 steps and a dot per step', res.onAtStart&&res.dots===8, JSON.stringify({on:res.onAtStart,dots:res.dots}));
  ck('Wren changes pose across the tour steps', res.poseVariety>=5, 'distinct poses='+res.poseVariety);
  ck('the tour includes a Profiles: share & switch step', res.hasProfiles, String(res.hasProfiles));
  ck('welcome step is centered (no spotlight hole) with Back hidden', res.holeNohole0&&res.backHidden0&&res.tipL0>=0, JSON.stringify({nohole:res.holeNohole0,back:res.backHidden0,l:res.tipL0}));
  ck('step 2 switches to Add and spotlights a real element on-screen', res.addViewOn&&res.holeShown1&&res.tipInView1, JSON.stringify({add:res.addViewOn,hole:res.holeShown1,tip:res.tipInView1}));
  ck('a mid step actually switches the underlying view (Month)', res.monthViewOn&&res.nextLabelMid==="Next", JSON.stringify({m:res.monthViewOn,lbl:res.nextLabelMid}));
  ck('final step switches to Settings and the button reads "Done"', res.settingsViewOn&&res.doneLabel==="Done", JSON.stringify({s:res.settingsViewOn,lbl:res.doneLabel}));
  ck('Back steps backward', res.backWorks, String(res.backWorks));
  ck('finishing closes the tour and records it as seen (won\'t nag again)', res.offAfterEnd&&res.seen==="1", JSON.stringify({off:res.offAfterEnd,seen:res.seen}));
  ck('Feature guide renders all 5 categories and 21 feature rows', res.cats===5&&res.rows===21, JSON.stringify({cats:res.cats,rows:res.rows}));
  ck('Feature guide overlay opens', res.guideOpen, String(res.guideOpen));

  const sm=await page.evaluate(async()=>{
    var sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
    window.renderSettings=function(){};
    renderGuide();
    var first=document.querySelector('#guideBody .guiderow');
    var isBtn=first.tagName==='BUTTON'&&first.hasAttribute('data-k')&&/Show me/.test(first.textContent);
    // view-only target: jump to Month and close the guide
    openGuide();showFeature({v:'month'});await sleep(220);
    var closed=getComputedStyle($("guideOv")).display==="none";
    var wentMonth=$("view-month").classList.contains("on");
    // accordion target: expands the right Settings section
    showFeature({v:'settings',acc:'optimize-spreadsheet'});await sleep(240);
    var accH=document.querySelector('#view-settings .acc-hd[data-acc="optimize-spreadsheet"]');
    var accOpen=accH&&accH.getAttribute('aria-expanded')==='true';
    var onSettings=$("view-settings").classList.contains("on");
    // picker target: opens the category picker
    window.__po=false;window.openCatPicker=function(){window.__po=true;};
    showFeature({v:'add',ov:'openCatPicker'});await sleep(220);
    return {isBtn,closed,wentMonth,accOpen,onSettings,pickerOpened:window.__po===true};
  });
  ck('each row is a tappable "Show me" button', sm.isBtn, String(sm.isBtn));
  ck('a "Show me" jumps to the right tab and closes the guide', sm.closed&&sm.wentMonth, JSON.stringify({closed:sm.closed,month:sm.wentMonth}));
  ck('a Settings feature expands its own section', sm.onSettings&&sm.accOpen, JSON.stringify({s:sm.onSettings,open:sm.accOpen}));
  ck('a picker feature opens the category picker', sm.pickerOpened, String(sm.pickerOpened));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

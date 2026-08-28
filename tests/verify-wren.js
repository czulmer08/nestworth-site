/* Verify Wren — the scripted in-app guide: intent matching, chat rendering, "Show me" navigation, fallback, launchers. */
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
  await page.waitForFunction(()=>typeof openWren==='function'&&typeof wrenMatch==='function'&&typeof wrenAsk==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  const res=await page.evaluate(async()=>{
    window.renderSettings=function(){};window.fitStileNums=function(){};window.maybeOfferPullIn=function(){};window.openCatPicker=function(){window.__pick=true;};
    state.cats=[{name:'Food'}];state.goals=[];state.cons=[];state.rows=[];state.meta={cats:{},cons:{},prefs:{}};show('appScreen');document.body.setAttribute('data-view','add');
    var sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

    // matching: natural phrasings land on the right intent
    var m1=wrenMatch("how do I add my paycheck?");
    var m2=wrenMatch("how do I share this with my husband");
    var m3=wrenMatch("the month column is messed up");
    var m4=wrenMatch("where did my money go this month");
    var m5=wrenMatch("asdfqwer zzz");
    var mtx=wrenMatch("how do I add a transaction?");
    var chipsAllMatch=WREN_CHIPS.every(function(c){return !!wrenMatch(c);}); // every quick-topic chip must resolve to an intent
    var matchOK=m1&&m1.go.v==='budget'&&m2&&m2.acc===undefined&&m2.go.acc==='share-this-budget'&&m3&&m3.go.acc==='optimize-spreadsheet'&&m4&&m4.go.v==='month'&&m5===null&&mtx&&mtx.go.v==='add';

    // opening Wren greets + shows chips
    openWren();
    var opened=getComputedStyle($("wrenOv")).display==='flex';
    var greeted=/I'm Wren/.test($("wrenLog").textContent);
    var chips=$("wrenChips").querySelectorAll('.wchip').length;

    // asking a question shows a brief typing indicator, then a Wren answer with a "Show me"
    wrenAsk("how do I add income?");
    var typingSeen=$("wrenLog").querySelector('.wtype')!==null; // dots appear immediately
    var searchAv=!!$("wrenLog").querySelector('.wmsg .av.wren-search'); // she "searches" while thinking
    await sleep(700); // wait past the typing delay
    var typingGone=$("wrenLog").querySelector('.wtype')===null;
    var userBub=$("wrenLog").querySelectorAll('.wmsg.me').length;
    var showMe=[].some.call($("wrenLog").querySelectorAll('.wact button'),b=>/Show me/.test(b.textContent));

    // clicking "Show me" navigates + closes Wren
    var smBtn=[].find.call($("wrenLog").querySelectorAll('.wact button'),b=>/Show me/.test(b.textContent));
    smBtn.click();await sleep(60);
    var wentBudget=$("view-budget").classList.contains("on");
    var wrenClosed=getComputedStyle($("wrenOv")).display==='none';

    // a picker intent triggers the category picker
    window.__pick=false;wrenAsk("I want to add a new category");await sleep(700);
    var sms=[].filter.call($("wrenLog").querySelectorAll('.wact button'),b=>/Show me/.test(b.textContent));
    var pk=sms[sms.length-1]; // the newest reply's button
    pk.click();await sleep(220);
    var pickerCalled=window.__pick===true;

    // fallback for gibberish offers guide + tour
    wrenAsk("qwertyuiop nonsense");await sleep(700);
    var fbTexts=[].map.call($("wrenLog").querySelectorAll('.wact button'),b=>b.textContent).join('|');
    var fallbackOK=/couldn't find that/.test($("wrenLog").textContent)&&/Open the guide/.test(fbTexts)&&$("wrenLog").querySelector('.wren-confused')!==null;

    // the tour launcher intent
    wrenAsk("give me a tour");await sleep(700);
    var tourBtn=[].some.call($("wrenLog").querySelectorAll('.wact button'),b=>/Start the tour/.test(b.textContent));
    // she uses her studious (coffee) pose for spreadsheet topics
    var opt=wrenMatch("optimize my spreadsheet"); var optMood=opt&&opt.mood;

    // personality: mood-specific avatars on her replies + no em dashes in her copy
    var emDash=WREN_INTENTS.some(function(it){return /—/.test(it.a);});
    var moodClassSeen=[].some.call($("wrenLog").querySelectorAll('.wmsg .av'),function(a){return /wren-(happy|glasses|study|cheer)/.test(a.className);});
    var userHasNoAvatar=$("wrenLog").querySelector('.wmsg.me .av')===null;
    // a technical topic uses the "glasses" (thinking) avatar
    var pv=wrenMatch("is my data private"); var pvMood=pv&&pv.mood;
    document.body.setAttribute('data-view','add'); // a view is always active on the app screen (mocked loadAll can clear it in tests)
    // system dialogs are clean now — no cartoon on errors or confirmations (kept elevated)
    askInfo("Couldn't do that","test");
    var errNoWren=!$("askOv").classList.contains("wren-info")&&!document.getElementById("askWren");
    closeOv("askOv");
    askConfirm({title:"Delete?",msg:"x",ok:"Delete"});
    var confirmNoWren=!$("askOv").classList.contains("wren-info");
    closeOv("askOv");
    return {chipsAllMatch,searchAv,matchOK,opened,greeted,chips,userBub,showMe,wentBudget,wrenClosed,pickerCalled,fallbackOK,tourBtn,emDash,moodClassSeen,userHasNoAvatar,pvMood,typingSeen,typingGone,optMood,
      errNoWren,confirmNoWren,fabInDom:!!document.getElementById('wrenFab'),fabShown:getComputedStyle(document.getElementById('wrenFab')).display!=='none'};
  });

  ck('Wren matches natural questions to the right feature (and returns null on gibberish)', res.matchOK, String(res.matchOK));
  ck('every quick-topic chip resolves to an intent', res.chipsAllMatch, String(res.chipsAllMatch));
  ck('opening Wren greets the user and shows quick topic chips', res.opened&&res.greeted&&res.chips>=5, JSON.stringify({o:res.opened,g:res.greeted,chips:res.chips}));
  ck('asking a question adds your message + a Wren reply with a "Show me"', res.userBub>=1&&res.showMe, JSON.stringify({me:res.userBub,show:res.showMe}));
  ck('tapping "Show me" jumps to the feature and closes Wren', res.wentBudget&&res.wrenClosed, JSON.stringify({b:res.wentBudget,closed:res.wrenClosed}));
  ck('a picker feature opens the category picker', res.pickerCalled, String(res.pickerCalled));
  ck('gibberish falls back gracefully with guide + tour offers', res.fallbackOK, String(res.fallbackOK));
  ck('asking for a tour offers to start it', res.tourBtn, String(res.tourBtn));
  ck('the floating "Ask Wren" button is present and visible on the app screen', res.fabInDom&&res.fabShown, JSON.stringify({dom:res.fabInDom,shown:res.fabShown}));
  ck('Wren uses mood-based avatars on her replies (personality)', res.moodClassSeen&&res.userHasNoAvatar, JSON.stringify({mood:res.moodClassSeen,userClean:res.userHasNoAvatar}));
  ck('the privacy answer uses her shield (privacy) pose', res.pvMood==='privacy', String(res.pvMood));
  ck('her copy has no em dashes (as requested)', res.emDash===false, 'emDashFound='+res.emDash);
  ck('she shows a typing indicator, then replaces it with her reply', res.typingSeen&&res.typingGone, JSON.stringify({typing:res.typingSeen,cleared:res.typingGone}));
  ck('the thinking indicator uses her searching pose', res.searchAv, String(res.searchAv));
  ck('spreadsheet topics use her studious (coffee) pose', res.optMood==='study', String(res.optMood));
  ck('system dialogs stay clean — no cartoon on errors or confirmations', res.errNoWren&&res.confirmNoWren, JSON.stringify({errClean:res.errNoWren,confirmClean:res.confirmNoWren}));

  const egg=await page.evaluate(()=>{
    document.querySelectorAll('.view').forEach(function(v){v.classList.remove('on');});$("view-worth").classList.add('on');
    state.goals=[];state.debts=[];state.meta=state.meta||{};state.meta.goals=[];
    // a genuine new high: this month (10000) beats every prior month (best was 5000)
    state.assets=[{name:"Checking",bal:10000,row:2}];
    state.nwHist=[{ym:202605,net:5000,assets:5000,debts:0},{ym:202606,net:10000,assets:10000,debts:0}];
    renderWorth();var high=!!document.querySelector('#wNet .nw-egg .wren-nestegg');
    // not a new high: this month (9000) is below the prior best (20000)
    state.assets=[{name:"Checking",bal:9000,row:2}];
    state.nwHist=[{ym:202605,net:20000,assets:20000,debts:0},{ym:202606,net:9000,assets:9000,debts:0}];
    renderWorth();var notHigh=!!document.querySelector('#wNet .nw-egg');
    // a negative net worth never celebrates, even at its "highest"
    state.assets=[];state.debts=[{name:"Loan",bal:5000,row:2}];
    state.nwHist=[{ym:202605,net:-9000,assets:0,debts:9000},{ym:202606,net:-5000,assets:0,debts:5000}];
    renderWorth();var neg=!!document.querySelector('#wNet .nw-egg');
    // throttle: tapping × acknowledges this high; it won't nag again at the same level, but a higher high shows once more
    try{localStorage.removeItem('nw_hi_ack');}catch(e){}
    state.debts=[];state.assets=[{name:"Checking",bal:10000,row:2}];
    state.nwHist=[{ym:202605,net:5000,assets:5000,debts:0},{ym:202606,net:10000,assets:10000,debts:0}];
    renderWorth();var beforeAck=!!document.querySelector('#wNet .nw-egg');
    document.getElementById('nwEggX').click(); // acknowledge → stores 10000, re-renders
    var afterAck=!!document.querySelector('#wNet .nw-egg'); // gone now
    state.assets=[{name:"Checking",bal:12000,row:2}];
    state.nwHist=[{ym:202605,net:5000,assets:5000,debts:0},{ym:202606,net:12000,assets:12000,debts:0}];
    renderWorth();var higherShowsAgain=!!document.querySelector('#wNet .nw-egg');
    try{localStorage.removeItem('nw_hi_ack');}catch(e){}
    return {high,notHigh,neg,beforeAck,afterAck,higherShowsAgain};
  });
  ck('a new all-time-high net worth shows the nest-egg Wren (and only then)', egg.high&&!egg.notHigh&&!egg.neg, JSON.stringify({high:egg.high,notHigh:egg.notHigh,neg:egg.neg}));
  ck('the new-high celebration shows once, hides when dismissed, and returns only on a higher high', egg.beforeAck&&!egg.afterAck&&egg.higherShowsAgain, JSON.stringify({before:egg.beforeAck,after:egg.afterAck,higher:egg.higherShowsAgain}));

  const fab=await page.evaluate(()=>{
    document.body.setAttribute('data-view','add');closeOv('wrenOv');
    var f=document.getElementById('wrenFab');
    var restsAtFirst=f.classList.contains('rest')&&getComputedStyle(f).borderRadius!=='0px'; // a compact ? by default
    f.click();var expands=f.classList.contains('open')&&!f.classList.contains('rest')&&getComputedStyle($("wrenOv")).display==='none'; // first tap reveals "Ask Wren", chat still closed
    f.click();var opensChat=getComputedStyle($("wrenOv")).display==='flex'&&f.classList.contains('rest'); // second tap opens the chat, pill collapses back
    closeOv('wrenOv');
    // a horizontal swipe dismisses it
    function pe(t,x){f.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:700,bubbles:true,pointerId:1}));}
    pe('pointerdown',330);pe('pointermove',430);pe('pointerup',430);
    var swipesAway=f.classList.contains('gone');
    // the Settings toggle hides it for good (persisted) and brings it back
    try{localStorage.setItem('nw_help_off','1');}catch(e){}applyFabPref();
    var toggledOff=getComputedStyle(f).display==='none';
    try{localStorage.removeItem('nw_help_off');}catch(e){}applyFabPref();
    var toggledOn=getComputedStyle(f).display!=='none'&&f.classList.contains('rest');
    return {restsAtFirst,expands,opensChat,swipesAway,toggledOff,toggledOn};
  });
  ck('the floating ? expands to Ask Wren on tap, opens the chat on the next tap, and swipes away to dismiss', fab.restsAtFirst&&fab.expands&&fab.opensChat&&fab.swipesAway, JSON.stringify({rest:fab.restsAtFirst,exp:fab.expands,open:fab.opensChat,swipe:fab.swipesAway}));
  ck('the Settings toggle hides the ? helper for good and restores it', fab.toggledOff&&fab.toggledOn, JSON.stringify({off:fab.toggledOff,on:fab.toggledOn}));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

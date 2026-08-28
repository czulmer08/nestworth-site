/* Verify: (a) Recent-entries list filters to the selected category (expense) / source (deposit); (b) the budget switcher lists budgets and marks the current one. */
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
  await page.waitForFunction(()=>typeof renderRecent==='function'&&typeof paintBudSwitch==='function'&&typeof setMode==='function',{timeout:8000});
  const out=[];const ck=(n,ok,d)=>out.push({n,ok,d:d||''});

  // seed rows: [Y,M,date,payee/source,category,company,amount,...]
  await page.evaluate(()=>{
    window.isGoalName=function(){return false;};
    window.reimbTag=function(){return "";};
    window.openEdit=function(){};
    window.shortDate=function(d){return String(d||"");};
    window.money=function(n){return "$"+(Number(n)||0).toFixed(2);};
    state={rows:[
      [2026,8,'2026-08-01','Me','Groceries','Publix',50,'',''],
      [2026,8,'2026-08-02','Me','Gas','Shell',40,'',''],
      [2026,8,'2026-08-03','Me','Groceries','Aldi',30,'',''],
      [2026,7,'2026-07-15','Paycheck','Deposit','Employer',2000,'',''],
      [2026,8,'2026-08-05','Side gig','Deposit','Etsy',150,'','']
    ]};
  });

  // 1) Expense mode, category = Groceries -> only the 2 Groceries rows; header updates
  const r1=await page.evaluate(()=>{
    setMode('expense');
    document.getElementById('fCategory').value='Groceries';
    renderRecent();
    var items=[].map.call(document.querySelectorAll('#elist .eitem'),function(li){return li.querySelector('.co').textContent;});
    return {items:items, hdr:document.getElementById('recentHdr').textContent};
  });
  ck('expense+category filters to that category (2 Groceries)', r1.items.length===2&&r1.items.indexOf('Publix')>=0&&r1.items.indexOf('Aldi')>=0&&r1.items.indexOf('Shell')<0&&/Groceries/.test(r1.hdr), JSON.stringify(r1));

  // 2) Expense mode, no category -> shows all non-goal entries (5), header "Recent entries"
  const r2=await page.evaluate(()=>{
    document.getElementById('fCategory').value='';
    renderRecent();
    return {count:document.querySelectorAll('#elist .eitem').length, hdr:document.getElementById('recentHdr').textContent};
  });
  ck('expense+no category shows everything recent', r2.count===5&&r2.hdr==='Recent entries', JSON.stringify(r2));

  // 3) Deposit mode, source = Side gig -> only that source's deposit (Etsy)
  const r3=await page.evaluate(()=>{
    setMode('deposit');
    // dSource is a <select>; inject the option then select it
    var s=document.getElementById('dSource'); s.innerHTML='<option>Paycheck</option><option>Side gig</option>'; s.value='Side gig';
    renderRecent();
    var items=[].map.call(document.querySelectorAll('#elist .eitem'),function(li){return li.querySelector('.co').textContent;});
    return {items:items, hdr:document.getElementById('recentHdr').textContent};
  });
  ck('deposit+source filters to that source (Etsy only)', r3.items.length===1&&r3.items[0]==='Etsy'&&/Side gig/.test(r3.hdr), JSON.stringify(r3));

  // 4) Deposit mode, no source picked (blank) -> shows all deposits (2), not expenses
  const r4=await page.evaluate(()=>{
    var s=document.getElementById('dSource'); s.innerHTML='<option value="">—</option>'; s.value='';
    renderRecent();
    var items=[].map.call(document.querySelectorAll('#elist .eitem'),function(li){return li.querySelector('.co').textContent;});
    return {items:items};
  });
  ck('deposit+no source shows only deposits (2)', r4.items.length===2&&r4.items.indexOf('Employer')>=0&&r4.items.indexOf('Etsy')>=0&&r4.items.indexOf('Publix')<0, JSON.stringify(r4));

  // 5) Budget switcher lists tracked budgets and flags the active one
  const r5=await page.evaluate(()=>{
    window.sheetId='B2'; window.budgetName='Holland House';
    window.lsHidden=function(){return [];};
    window.lsGetBudgets=function(){return [{id:'B1',name:'Personal'},{id:'B2',name:'Holland House'},{id:'B3',name:'Rental'}];};
    paintBudSwitch(null);
    var rows=[].map.call(document.querySelectorAll('#budSwitchBody .budswrow'),function(el){return {name:el.querySelector('.bn').textContent, on:el.classList.contains('on'), id:el.getAttribute('data-id')};});
    return {rows:rows};
  });
  const active=r5.rows.filter(x=>x.on);
  ck('switcher lists all budgets, marks current', r5.rows.length===3&&active.length===1&&active[0].name==='Holland House', JSON.stringify(r5));

  // 6) tapping a different budget confirms then calls budgetSwitch; tapping the current one just closes
  const r6=await page.evaluate(async()=>{
    window.__switched=null; window.budgetSwitch=function(id){window.__switched=id;};
    window.askConfirm=async function(){return true;};
    paintBudSwitch(null);
    document.getElementById('budSwitchOv').style.display='flex';
    // tap a non-current row (Rental / B3)
    var target=[].filter.call(document.querySelectorAll('#budSwitchBody .budswrow'),function(el){return el.getAttribute('data-id')==='B3';})[0];
    target.click();
    await new Promise(r=>setTimeout(r,20));
    var switchedAway=window.__switched;
    // tap current (B2) -> should just close, not switch
    window.__switched=null;
    var cur=[].filter.call(document.querySelectorAll('#budSwitchBody .budswrow'),function(el){return el.getAttribute('data-id')==='B2';})[0];
    cur.click();
    await new Promise(r=>setTimeout(r,20));
    return {switchedAway:switchedAway, curClosed:document.getElementById('budSwitchOv').style.display==='none', switchedOnCur:window.__switched};
  });
  ck('tap other budget -> budgetSwitch(id); tap current -> just closes', r6.switchedAway==='B3'&&r6.curClosed&&r6.switchedOnCur===null, JSON.stringify(r6));

  let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d?('  ['+r.d+']'):''));r.ok?pass++:fail++;});
  if(errs.length)console.log('  page errors: '+errs.join(' | '));
  console.log('\n'+pass+' passed, '+fail+' failed.');
  await b.close();server.close();process.exit(fail?1:0);
})();

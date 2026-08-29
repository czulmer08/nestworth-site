/* MUTATION TESTING — the strongest test-of-the-tests. Deliberately sabotage the app in controlled ways (each a KNOWN bad
   implementation of a real financial rule), run a targeted suite against the mutated app, and require it to turn RED for the
   RIGHT reason. A green suite only convinces once we've proven it catches known-wrong code.

   VALIDITY GATE (this is what makes the result trustworthy). For every mutation we require the full three-phase evidence:
     1. BASELINE  — the target suite must PASS CLEANLY on the unmutated app (ran to completion, 0 failures).
     2. MUTATED   — the target suite must FAIL BY ASSERTION: it must run to completion and report ≥1 failed check.
     3. RESTORED  — the target suite must PASS CLEANLY again after byte-exact restore.
   Anything that is NOT a clean pass / genuine assertion failure — a missing dependency (e.g. Playwright not installed), a
   browser-launch failure, a syntax error, a timeout, a process crash before the suite printed its summary — is classified as
   INVALID, never "caught". An INVALID run means we learned nothing and the harness says so, instead of green-washing a crash.
   The original app.html is always restored (finally). */
const {execSync}=require('child_process');const fs=require('fs');const path=require('path');
const APP=path.join(__dirname,'app.html');const ORIG=fs.readFileSync(APP,'utf8');

const MUT=[
  {n:'annual surplus: income−budget → income+budget',           find:'surplus:r2(income-budget-goalSave)',                                    repl:'surplus:r2(income+budget-goalSave)',                                     by:'verify-decisions.js'},
  {n:'as-of cutoff removed (future-dated rows counted)',         find:'return !(iso&&iso>a);',                                                  repl:'return true;',                                                           by:'verify-audit-v56.js'},
  {n:'3-paycheck calendar ignores the check count',             find:'_perNet(_effAmt(i))*cnt[i]-keepM',                                       repl:'_perNet(_effAmt(i))*1-keepM',                                            by:'verify-percheck.js'},
  {n:'residual penny remainder → last element (can go negative)',find:'var cand=res.filter(function(g){return (g._resMo||0)>0.005;})',          repl:'var cand=[res[res.length-1]]',                                           by:'verify-property.js'},
  {n:'contingency coverage ignores the available buffer',        find:'r2(Math.min(availableBuffer,totalDeficit))',                             repl:'r2(totalDeficit)',                                                       by:'verify-contingency-coverage.js'},
  {n:'budget-used doubled (linked goal counted twice)',          find:'(c&&c.mused!=null)?c.mused:',                                            repl:'(c&&c.mused!=null)?c.mused*2:',                                          by:'verify-coverage.js'},
  {n:'net worth ignores debts (assets only)',                    find:'return r2(ta-td);',                                                      repl:'return r2(ta);',                                                         by:'verify-golden.js'},
  {n:'monthly actuals drops uncategorized spending',             find:'else if(isExpenseRow(r))exp+=amt;',                                      repl:'else if(isExpenseRow(r)&&(""+(r[4]||"")).trim())exp+=amt;',              by:'verify-property.js'},
  {n:'deposits miscounted as expense (income → 0)',              find:'if(isDepositRow(r))inc+=amt;',                                           repl:'if(isDepositRow(r))exp+=amt;',                                           by:'verify-property.js'},
  {n:'FIN-ASOF-001: as-of dropped from monthActualTotals',       find:'else if(typeof _asOfOK==="function"&&!_asOfOK(r))return;',                repl:'else if(false)return;',                                                  by:'verify-engine-invariants.js'},
  {n:'FIN-ASOF-002: as-of dropped from goalContribMonth',        find:'Number(r[1])!==mo||(typeof _asOfOK==="function"&&!_asOfOK(r)))return;',   repl:'Number(r[1])!==mo)return;',                                              by:'verify-engine-invariants.js'},
  {n:'FIN-NW-001: net worth drops stand-alone goals',            find:'reduce(function(a,x){return a+(x.bal||0);},0)+stTot;',                   repl:'reduce(function(a,x){return a+(x.bal||0);},0)+0;',                        by:'verify-engine-invariants.js'},
  {n:'GF gap: cross-category offset ignored (underRoom dropped)',   find:'underAvail=r2((cr.underRoom||0)+Math.max(0,-unb));',                     repl:'underAvail=r2(0+Math.max(0,-unb));',                                     by:'verify-goal-funding.js'},
  {n:'contingency temporal routing removed (WHEN answered as IS)', find:'if(_temporal){',                                                        repl:'if(false&&_temporal){',                                                  by:'verify-contingency-history.js'},
  {n:'cash-flow current month double-counts income (max→sum)',     find:'im=Math.max(ai[m],inc[m])',                                             repl:'im=ai[m]+inc[m]',                                                        by:'verify-cashflow-current-month.js'},
  {n:'$0-baseline cash-flow note suppressed',                      find:'if(Math.abs(start)<0.005){',                                            repl:'if(false){',                                                            by:'verify-cashflow-presentation.js'},
  {n:'contingency trend chart removed from the card',              find:'h+=contingencyTrendHTML();',                                            repl:'h+="";',                                                                by:'verify-contingency-trend.js'},
  {n:'unbudgeted consumption ignored in goal funding',             find:'var unb=r2((typeof unbudgetedConsumption==="function")?unbudgetedConsumption():0);', repl:'var unb=0;',                                        by:'verify-goal-funding.js'},
];

// Run a suite; capture exit code + combined output so we can classify WHY it passed/failed (not just the exit code).
function runSuite(file){
  try{const out=execSync('node '+JSON.stringify(path.join(__dirname,file)),{cwd:__dirname,stdio:['ignore','pipe','pipe'],timeout:220000,encoding:'utf8'});
    return {code:0,out:out||'',timedOut:false};}
  catch(e){const timedOut=!!(e.killed||e.signal==='SIGTERM'||/ETIMEDOUT/.test(String(e.code||'')));
    return {code:(e.status==null?1:e.status),out:((e.stdout||'')+'\n'+(e.stderr||'')),timedOut};}
}
// A run counts as "reached its verdict" only if it printed one of the known suite summary lines. Parse the failure count.
function summarize(out){let m;
  if(m=out.match(/(\d+)\s+passed,\s+(\d+)\s+failed/))return {ran:true,failed:+m[2]};
  if(m=out.match(/"total":\s*\d+/)){const f=out.match(/"fail":\s*(\d+)/);return {ran:true,failed:f?+f[1]:null};}
  if(m=out.match(/OVERALL:\s*(\d+)\/(\d+)\s+cases passed/))return {ran:true,failed:(+m[2])-(+m[1])};
  return {ran:false,failed:null};
}
// HARNESS-level breakage (dependency/browser/env) — NOT the app being wrong. These make a run INVALID, never "caught".
function harnessBroken(out){return /Cannot find module|MODULE_NOT_FOUND|Executable doesn't exist|playwright install|browserType\.launch|EADDRINUSE|listen EACCES|npm ERR/i.test(out);}
function passedClean(r){const s=summarize(r.out);return r.code===0&&!r.timedOut&&!harnessBroken(r.out)&&s.ran&&s.failed===0;}
// Genuine assertion failure: ran to its verdict, reported ≥1 failed check (or finished nonzero with its summary printed),
// and did not hit a harness/timeout/dependency crash.
function failedByAssertion(r){const s=summarize(r.out);
  if(r.timedOut||harnessBroken(r.out)||!s.ran)return false;
  return (s.failed!=null&&s.failed>0)||(r.code!==0);}
function invalidReason(r){if(r.timedOut)return'timeout';if(harnessBroken(r.out))return'harness/dependency/browser failure';if(!summarize(r.out).ran)return'no suite summary (crashed before verdict)';return'';}

const suites=Array.from(new Set(MUT.map(m=>m.by)));
const results=[];const baseline={};const restored={};
try{
  // PHASE 1 — baseline: each unique suite must pass cleanly on the untouched app, else its mutations are INVALID.
  for(const s of suites)baseline[s]=runSuite(s);
  // PHASE 2 — per mutation
  for(const m of MUT){
    const occ=ORIG.split(m.find).length-1;
    if(occ!==1){results.push({m,status:'BADFIND',occ});continue;}
    if(!passedClean(baseline[m.by])){results.push({m,status:'INVALID',phase:'baseline',why:invalidReason(baseline[m.by])||'baseline not clean'});continue;}
    fs.writeFileSync(APP,ORIG.replace(m.find,m.repl));
    const mut=runSuite(m.by);
    fs.writeFileSync(APP,ORIG); // restore immediately
    if(failedByAssertion(mut))results.push({m,status:'CAUGHT'});
    else if(passedClean(mut))results.push({m,status:'SURVIVED'});
    else results.push({m,status:'INVALID',phase:'mutated',why:invalidReason(mut)||'mutation did not yield a clean assertion verdict'});
  }
  // PHASE 3 — restored: each unique suite must pass cleanly again (byte-exact app is back).
  for(const s of suites)restored[s]=runSuite(s);
}finally{fs.writeFileSync(APP,ORIG);}

const byteExact=fs.readFileSync(APP,'utf8')===ORIG;
let caught=0,survived=0,bad=0,invalid=0;
results.forEach(r=>{
  if(r.status==='CAUGHT'){caught++;console.log('  CAUGHT   ['+r.m.by+'] '+r.m.n);}
  else if(r.status==='SURVIVED'){survived++;console.log('  SURVIVED ['+r.m.by+'] '+r.m.n+'  ← COVERAGE GAP: this bad implementation passed the suite');}
  else if(r.status==='BADFIND'){bad++;console.log('  BAD-FIND '+r.m.n+'  ← mutation target not unique ('+r.occ+' occurrences) — app source moved, update the mutation');}
  else{invalid++;console.log('  INVALID  ['+r.m.by+'] '+r.m.n+'  ← '+r.phase+': '+r.why+' (learned nothing — NOT counted as caught)');}
});
// restore-phase verdicts
const restoreFails=suites.filter(s=>!passedClean(restored[s]));
console.log('');
suites.forEach(s=>{const okB=passedClean(baseline[s]),okR=passedClean(restored[s]);
  console.log('  suite '+(okB&&okR?'OK   ':'WARN ')+s+'  — baseline:'+(okB?'clean':('INVALID('+invalidReason(baseline[s])+')'))+'  restored:'+(okR?'clean':('INVALID('+invalidReason(restored[s])+')')));});
const realMut=MUT.length; // all entries should be genuine (no BADFIND) in a healthy tree
console.log('\n  '+caught+'/'+realMut+' mutations CAUGHT by a genuine assertion failure'
  +(survived?(' · '+survived+' SURVIVED (coverage gap)'):'')
  +(invalid?(' · '+invalid+' INVALID (harness/dependency — inconclusive)'):'')
  +(bad?(' · '+bad+' bad-find'):'')
  +'  · app.html restored byte-exact: '+byteExact);
if(invalid)console.log('  NOTE: INVALID runs mean the target suite could not produce a trustworthy verdict here (often Playwright not installed). Fix the environment and re-run — do not read INVALID as "caught".');
// Trustworthy green requires: every mutation caught, all baselines+restores clean, byte-exact restore, and ZERO invalid/survived/bad.
process.exit((survived||bad||invalid||restoreFails.length||!byteExact||caught!==realMut)?1:0);

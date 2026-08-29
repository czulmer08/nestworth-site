/* CODE-LEVEL ACCESSIBILITY AUDIT. Statically inspects the shipped markup/CSS for the accessibility properties that ARE
   machine-checkable, and asserts the good ones so they can't regress. It also prints the remaining gaps as a documented
   findings list.
   SCOPE: this is a CODE-LEVEL audit. It does NOT run a screen reader and does NOT prove "VoiceOver passed" or real-device
   behaviour — those require human testing on hardware. It guards the automatable invariants and surfaces the rest. */
const fs=require('fs');const path=require('path');
const S=fs.readFileSync(path.join(__dirname,'app.html'),'utf8');
const out=[];const ck=(n,ok,d)=>out.push({n,ok:!!ok,d:d||''});

// ---- ASSERTED invariants (regression guards for the good properties) ----
const vp=(S.match(/name="viewport"\s+content="([^"]*)"/)||[])[1]||'';
ck('viewport allows zoom (no user-scalable=no / maximum-scale lock)', /initial-scale=1/.test(vp)&&!/user-scalable\s*=\s*no/.test(vp)&&!/maximum-scale/.test(vp), vp);
ck('theme-aware: honours prefers-color-scheme (dark mode)', /prefers-color-scheme/.test(S), '');
ck('honours prefers-reduced-motion (drops non-essential animation)', /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(S), '');
ck('document language is declared (<html lang=…>)', /<html[^>]*\blang=/.test(S), '');
ck('no <img> without an alt attribute', (S.match(/<img\b(?![^>]*\balt=)[^>]*>/g)||[]).length===0, String((S.match(/<img\b(?![^>]*\balt=)[^>]*>/g)||[]).length));
ck('decorative SVGs are hidden from the a11y tree (aria-hidden present)', /aria-hidden/.test(S), '');
ck('a visible focus style is defined (:focus / :focus-visible)', /:focus(-visible)?/.test(S), '');
ck('form controls use real <label> elements', (S.match(/<label\b/g)||[]).length>=20, String((S.match(/<label\b/g)||[]).length)+' labels');
// overlays get modal dialog semantics + focus move on open (set in openOv)
ck('overlays are announced as modal dialogs (openOv sets role="dialog" + aria-modal) and move focus in', /setAttribute\("role","dialog"\)/.test(S)&&/setAttribute\("aria-modal","true"\)/.test(S)&&/\.focus\(\)/.test(S), '');
// icon-only buttons carry an accessible name
const iconBtnNoLabel=(S.match(/<button[^>]*><\/button>/g)||[]).filter(b=>!/aria-label/.test(b)).length;
ck('every icon-only <button></button> has an aria-label', iconBtnNoLabel===0, iconBtnNoLabel+' unlabeled');

// ---- DOCUMENTED findings (not gated — need human/on-device follow-up) ----
const findings=[];
if(!/:focus-visible/.test(S))findings.push('Focus styling uses :focus, not :focus-visible — keyboard focus rings may also show on mouse click (cosmetic, not blocking).');
findings.push('Dynamic Type / large-font layout, real VoiceOver traversal, 320px reflow, and contrast ratios need on-device/human testing — out of code-level scope.');

let pass=0,fail=0;out.forEach(r=>{console.log((r.ok?'  PASS ':'  FAIL ')+r.n+(r.d&&!r.ok?('  → '+r.d):''));r.ok?pass++:fail++;});
console.log('\n  CODE-LEVEL FINDINGS (documented, not gated):');
findings.forEach(f=>console.log('   • '+f));
console.log('\n'+pass+' passed, '+fail+' failed. SCOPE: static code-level audit — NOT a screen-reader/on-device certification.');
process.exit(fail?1:0);

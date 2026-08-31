# NestWorth — repo reorganization runbook

Goal: get your **development IP off the public web** without knocking the live site offline. Do the steps in this order — the visibility/deploy change is **last** on purpose.

## Important correction on "make the source repo private"

If your site is served by **GitHub Pages on a free plan, a private repo cannot use Pages** (private Pages needs GitHub Pro/Team/Enterprise). So the safe, free model is:

- **Public repo = the trimmed *deploy* only** (browser files + LICENSE). It stays public so Pages keeps working — but it no longer contains `MODEL_SPEC.md`, the test suite, fixtures, `BETA_STUDY.md`, etc.
- **Private repo = all development IP.**

That already achieves your objective (dev IP not public). Making the deploy repo *itself* private is optional and only needed if you upgrade Pages or move to another host (Netlify/Cloudflare Pages/Vercel all serve from a private repo on free tiers — a good later move).

---

## Step 1 — Add IP protection to the CURRENT repo now (safe, no visibility change)

From the delivered files:
```bash
# in a local clone of czulmer08/mynestworth
cp /path/to/LICENSE       ./LICENSE
cp /path/to/terms.html    ./terms.html          # the IP-patched Terms (adds §4 + © footer)
git add LICENSE terms.html
git commit -m "Add proprietary LICENSE and IP/ownership terms"
git push
```
Also add `© 2026 Ulmer Consulting, LLC. All rights reserved.` to the site/app footer and `about.html`.

## Step 2 — Lock the Google API key (Google Cloud Console, not the repo)

`app.html` carries a browser API key (`AIzaSyB0o9…`). Browser keys are public by design, but restrict it: **Application restriction → HTTP referrers** = your NestWorth domain(s); **API restriction** = only the APIs it uses (Picker/Drive). Do this regardless of repo visibility.

## Step 3 — Create the PRIVATE development repo (full history/IP)

```bash
# push the whole current tree (with history) to a new PRIVATE repo
gh repo create czulmer08/nestworth-dev --private --source=. --remote=dev --push
```
This preserves `MODEL_SPEC.md`, `verify-*.js`, `golden-suite.js`, `test-harness.js`, `tests/`, `fixtures/`, `BETA_STUDY.md`, `MIGRATIONS.md`, `WRITE_AUDIT.md`, `TEST_RESULTS.md`, `test.html`, `parity-audit.html`, and the delta/GitHub build zips — private, where they belong.

## Step 4 — Trim the PUBLIC repo to the deploy bundle

The delivered **`nestworth-public-deploy.zip`** is exactly the public tree (browser files + `LICENSE` + patched `terms.html` + latest `app.html` v0.68.66 + `nestworth-template.xlsx`, which the app fetches by the relative `TEMPLATE_URL`). Either drop its contents over the public repo, or remove the dev files in place:
```bash
git rm -r --cached MODEL_SPEC.md TEST_RESULTS.md BETA_STUDY.md MIGRATIONS.md WRITE_AUDIT.md \
                   golden-suite.js test-harness.js test.html parity-audit.html download \
                   verify-*.js tests fixtures 0[0-7]-*.json
git rm -r MODEL_SPEC.md TEST_RESULTS.md BETA_STUDY.md MIGRATIONS.md WRITE_AUDIT.md \
          golden-suite.js test-harness.js test.html parity-audit.html download \
          verify-*.js tests fixtures 0[0-7]-*.json
mv "README (1).md" README.md          # make the real README the primary one
git add -A && git commit -m "Trim public repo to deploy assets; add LICENSE; keep dev IP in private repo"
git push
```
> Removing these from the tree does **not** remove them from *history* — but your history was audited and contains **no secrets or personal data**, so that's fine. (If you ever want a truly clean public history, start the public repo fresh from just these files.)

## Step 5 — Verify the live site still serves

Load the site and confirm: app loads, sign-in works, **creating a new budget works** (the template fetch via `TEMPLATE_URL="nestworth-template.xlsx"` needs the template present — it is, in the bundle), Wren images render (`wren/` folder), icons/manifest load. Only proceed once green.

## Step 6 — (Optional, last) tighten hosting

- Keep the trimmed public repo public for free Pages, **or** move hosting to Netlify/Cloudflare Pages/Vercel and point them at your new **private** repo (free, and then nothing is public but the served files).

## Also recommended

- **Strip/minify the deployed `app.html`.** It ships to the browser regardless, but it currently also carries your full internal changelog and dev notes (e.g. "found by reading the user's live Holland sheet"). Minifying removes those from public view. Do this as a *tested* step — run the full `verify-*` suite against the minified file to confirm identical behavior — I can produce and verify that build for you.
- **Housekeeping already handled in the bundle:** the stray `download` file, the duplicated root fixtures, and the two-README mixup are all resolved.
- **Trademark:** start a USPTO word-mark search/application for "NestWorth" in parallel.

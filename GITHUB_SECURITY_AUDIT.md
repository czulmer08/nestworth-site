# NestWorth — GitHub repository audit (`czulmer08/mynestworth`)

**Scanned:** the live public repository — full working tree **and all 95 commits of git history.** Nothing was changed on GitHub.

## Bottom line

**The dangerous stuff is not there.** No credential leak, and no personal financial data — in the current files *or* anywhere in history. That means **you do not need to rewrite git history** for secrets or data. The work here is IP protection and repo hygiene, not incident response.

---

## 1. Secret / credential scan — PASS

| Checked | Result |
|---|---|
| Google OAuth **client secret** (`GOCSPX-…`) | **None**, ever (0 commits) |
| Private keys (`BEGIN … PRIVATE KEY`) | **None**, ever |
| Service-account JSON | **None** |
| Hardcoded tokens (GitHub `ghp_`, Slack `xox…`, AWS `AKIA…`, OpenAI `sk-…`) | **None** |
| `access_token` / `refresh_token` | Only as **variable names** in the OAuth flow, no literal values |

**Two public-by-design values are present (this is expected, not a leak):**

- **OAuth client ID** `1048635246954-…apps.googleusercontent.com` — client IDs are *not* secret for browser/web apps. Fine to be public.
- **Google API key** `AIzaSyB0o9…` in `app.html` (and `test.html`) — a browser API key. It is *meant* to be visible in client-side code, but it **must be locked down in Google Cloud Console**: restrict it to your HTTP referrers (your NestWorth domain) and to only the APIs it needs (e.g. Picker/Drive). **Action: verify those restrictions now** — an unrestricted browser key can be abused against your quota. (Also delete `test.html` from the deploy; it needlessly carries the client ID.)

## 2. Personal / financial data scan — PASS

- **No personal ledger ever committed.** No `HollandHouse_*`, `CZUH_*`, or `user-template.xlsx` in the tree or in history. The only spreadsheet is the **blank `nestworth-template.xlsx`** (no data).
- Your **live sheet ID** (`1cGUrIN4…`) appears **nowhere** in the repo or history.
- "Holland" / "Candice" hits are **author attribution** (about/index/terms) and **synthetic test labels** (e.g. a fake `'Candice','Deposit',3000` row in a test) — not real transactions.
- Your README already warns never to commit real data, and that discipline held.

**Conclusion: no history purge required.** (If you ever *do* need one later, the tool is `git filter-repo` or BFG — but you don't need it today.)

---

## 3. Intellectual-property gaps — FIXED (files provided)

You were right: there is **no `LICENSE`, no copyright notice, and no IP section in the Terms.** Provided in this folder:

- **`LICENSE`** — a proprietary "all rights reserved" notice (explicitly *not* open-source), so no one can mistake a source-available repo for a free-to-copy one. Put it at the repo root **and** ship it in the public deploy.
- **`terms.html`** — your live Terms, patched: a new **"4. Ownership and intellectual property"** section (copyright, the single narrow personal-use grant, and an explicit prohibition on copying/modifying/redistributing/commercializing or building a substantially similar product), sections renumbered 5–12, and a **© 2026 Ulmer Consulting, LLC. All rights reserved.** line added to the footer. Drop this in over your current `terms.html`.

Recommended one-liner to add to the app/site footer and `about.html` too:
`© 2026 Ulmer Consulting, LLC. All rights reserved.`

> Have an attorney review the wording before a commercial launch, but adding this now closes the "looks open-source" gap immediately.

## 4. Repo structure — split private dev from public deploy

Everything is public today, including your development IP (`MODEL_SPEC.md` — your financial-model/invariants doc, the whole `verify-*.js` suite, the mutation strategy, fixtures, `BETA_STUDY.md`). None of that is needed to run NestWorth. Recommended split:

**Public deployment repo (only what the browser loads):**
```
index.html  app.html  about.html  privacy.html  terms.html(patched)
sw.js  manifest.webmanifest  LICENSE
apple-touch-icon.png  icon-512.png  (favicon)
logo.svg  logo.jpg  "NestWorth Logo.png"  nestworth-social-preview.png
the Wren pose images (cheer/concerned/…/working .png)
setup-checklist.html  summary-preview.html   ← only if you link them to users
```

**Private development repo (move out of public):**
```
MODEL_SPEC.md  TEST_RESULTS.md  BETA_STUDY.md  MIGRATIONS.md  WRITE_AUDIT.md
verify-*.js  golden-suite.js  test-harness.js  tests/
fixtures/  (and the duplicated 00-*.json … 07-*.json at the repo root)
test.html            ← dev sign-in harness (also carries the client ID)
parity-audit.html    ← QA page, not a user page
the real README (as the dev README)
```

**Deployment dependency to preserve:** the app fetches the blank template from `TEMPLATE_URL`. Keep `nestworth-template.xlsx` served wherever that URL points, or setup breaks — don't just delete it without repointing the URL.

**Harden the deployed `app.html` too:** it necessarily ships to the browser, but it currently also contains your full internal changelog and dev notes — including comments like *"found by reading the user's live Holland sheet."* Before broader beta, **minify the deployed `app.html`** (or at least strip the long `//` dev-comment/changelog block and internal remarks). Client-side code can always be inspected, but this stops handing readers your narrated development history and model reasoning.

## 5. Repo hygiene (cosmetic, do during the reorg)

- **Two READMEs:** root `README.md` is actually the *fixtures* readme; `README (1).md` is the real NestWorth README. Make the real one `README.md` and move the fixtures readme back under `fixtures/meta/`.
- **`download`** — a stray file that's just a copy of an old `.gitignore`. Delete it.
- **Duplicated fixtures** at the repo root (`00-…json`…`07-…json`) duplicate `fixtures/meta/`. Keep one copy (under `fixtures/meta/`).
- Your `.gitignore` is good; the source-only convention held. (I also hardened it recently to keep root-level screenshots out.)

## 6. Trademark (separate track)

"NestWorth" is used as a brand. Consider a USPTO search + application for the word mark (and logo) if you're heading to commercial release. Not urgent for the repo, but worth starting in parallel.

---

## Do-this order (matches your priorities)

1. **Now:** add `LICENSE` at the repo root; replace `terms.html` with the patched version; add the © footer line to the site/app. Lock down the Google API key restrictions in Cloud Console.
2. **Now:** (done here) confirmed — no secrets or personal data to purge from history.
3. **Plan:** create the private dev repo, move the dev IP into it, trim the public repo to the deploy list above, and minify/strip the deployed `app.html`.
4. **Carefully, last:** only after the deploy is served from the trimmed public repo, flip the old repo's visibility — so you don't knock the live site (GitHub Pages) offline mid-switch.
5. **Parallel:** trademark search/application.

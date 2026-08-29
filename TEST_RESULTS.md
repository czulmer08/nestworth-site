# NestWorth — executed test results

**Build under test:** v0.68.15 · Build 20260829.103
**app.html SHA-256:** `a33cd0ee5bfd52332353c79ebb5278f0afe8551f381ed8f9572f06060244b5ad`
**Executed:** 2026-08-29 16:31 UTC
**Environment:** headless Chromium 141.0.7390.37 (Playwright) on Node v22.22.2, Linux cloud container.

## Execution provenance (read this first)

These are **actual run results** from executing the suites against the exact build above (verify the hash against `app.html`). Not a design review.

- ✅ Every suite below ran to completion and reported the pass/fail counts shown.
- ✅ `verify-mutation.js` ran with its **validity gate**: baseline clean → mutant fails **by assertion** → restored clean; a missing-dependency / browser-launch / syntax / timeout crash is reported INVALID, never "caught."
- ⚠️ These ran in **headless Chromium in a Linux cloud container** — NOT on Safari/iPhone, Chrome/Android, or any physical device.
- ⚠️ `verify-perf.js` numbers are a **relative regression baseline**, not device timings.
- ⚠️ **No suite here proves live two-device simultaneous-write atomicity or real-device UX.** Client-side Google Sheets row reservation is not a server-side compare-and-swap; that remains a documented architectural boundary requiring real-device / backend validation. It is not something this harness claims to prove.

## Headline

| | |
|---|---|
| Test files | **93** (92 functional suites + mutation) |
| Functional suites | **92 / 92 pass**, 0 failed |
| Total assertions | **~1,000** (804 `passed`-style + 64 golden invariants + 133 Wren-golden) |
| Randomized households (fuzz) | **9,000**, 9/9 identity invariants |
| Beta-readiness harnesses | new-user journey **6/6**, household journeys (H1,H3–H8) **8/8**, chaos-user **9/9**, first-run tour timing **5/5** — each break-audited |
| Goal-funding (planned vs supportable) | helper golden **6/6**, engine reconciliation **7/7**, contingency↔goals narration **4/4** — full cash identity reconciles; each break-audited |
| Mutation (validity-gated, run alone) | **12 / 12 CAUGHT by genuine assertion failure**; app.html restored byte-exact |

## The requested release-artifact suites (explicit)

| Suite | Result |
|---|---|
| `verify-write-contract.js` | **10 / 10** — TXN-EDIT-002, TXN-DELETE-001, META-SAVE-001, META-PEND-001, NW-ATOMIC-001 + structural guards |
| `verify-migration.js` | **22 / 22** — corpus-driven (8 checked-in fixtures), financial-fingerprint preservation, idempotency, backup, fail-safe, mid-session write-lock |
| `verify-idempotent.js` | **8 / 8** — single + **multi-row** durable-id append, ambiguous-write reconcile, PERSIST-IDEMP-002 (fail-closed marker) |
| pending-meta reconciliation | covered in `verify-write-contract.js` (META-PEND-001) + `verify-migration.js` |
| `verify-golden-invariants.js` | **64 / 64**, 0 fail |
| `verify-property.js` | **8 / 8** |
| `verify-fuzz.js` | **9 / 9** over **9,000** randomized households |
| `verify-wren-golden.js` | **122 / 122 cases · 133 / 133 assertions** |
| `verify-mutation.js` (validity gate) | **12 / 12 CAUGHT**, byte-exact restore |
| `verify-chaos.js` | **9 / 9** (single-client fault injection) |
| `verify-security.js` | **18 / 18** |
| `verify-starter-share.js` | **20 / 20** (fail-closed sharing) |
| `verify-pullin.js` | **33 / 33** (incl. PULL-RECOVERY-001 + `= + - @` tab/CR sanitation table) |
| `verify-a11y.js` | **10 / 10** (code-level; NOT a screen-reader certification) |
| `verify-perf.js` | **5 / 5** (headless baseline, 1k–100k rows) |
| `verify-new-user-journey.js` | **6 / 6** — clean-start journey, *user-sees = engine = persisted* oracle |
| `verify-household-journeys.js` | **8 / 8** — stranger households H1, H3–H8 (variable income, tight cash, high debt, refunds, residual, uncategorized) |
| `verify-chaos-user.js` | **9 / 9** — misuse / malformed input / double-tap / archive-with-money / delete-source |
| `verify-firstrun-tour.js` | **5 / 5** — the auto-tour defers past the first-run choice (v0.68.13 fix) |
| `verify-goal-funding.js` | **6 / 6** — planned vs supportable residual: under/on-plan, envelope-self, shared-contingency, uncovered, floor; reconciliation invariants |
| `verify-goal-funding-reconcile.js` | **7 / 7** — engine-level cash identity across every goal type (fixed, category-linked, residual, capped) + coverage layer + floor |
| `verify-contingency-goals.js` | **4 / 4** — Review + Wren narrate planned-vs-supported honestly (reassure only when residual truly intact) |

**All requested suites executed on v0.68.15 and passed.**

## Full per-suite output (all 93 files)

```
verify-a11y.js                   10 passed, 0 failed   (code-level; not a screen-reader cert)
verify-adopt-itemized.js         4 passed, 0 failed
verify-adversarial.js            26 passed, 0 failed
verify-append-concurrency.js     3 passed, 0 failed
verify-audit-v56.js              12 passed, 0 failed
verify-audit2.js                 4 passed, 0 failed
verify-audit3.js                 6 passed, 0 failed
verify-audit4.js                 5 passed, 0 failed
verify-audit5.js                 6 passed, 0 failed
verify-backup.js                 3 passed, 0 failed
verify-bill-breakdown.js         3 passed, 0 failed
verify-breakdown-sync.js         8 passed, 0 failed
verify-carry.js                  6 passed, 0 failed
verify-catyear.js                4 passed, 0 failed
verify-chaos.js                  9 passed, 0 failed
verify-chaos-user.js             9 passed, 0 failed   (misuse / malformed input)
verify-contingency-coverage.js   25 passed, 0 failed
verify-contingency-goals.js      4 passed, 0 failed   (Review+Wren narrate planned-vs-supported)
verify-coverage.js               12 passed, 0 failed
verify-decisions-ui.js           13 passed, 0 failed
verify-decisions.js              7 passed, 0 failed
verify-discover.js               4 passed, 0 failed
verify-dropdowns.js              13 passed, 0 failed
verify-effortless.js             4 passed, 0 failed
verify-engine-invariants.js      3 passed, 0 failed   (FIN-ASOF-001/002, FIN-NW-001)
verify-erase-key.js              4 passed, 0 failed
verify-fixes.js                  6 passed, 0 failed
verify-firstrun-tour.js          5 passed, 0 failed   (auto-tour defers past first-run)
verify-fold.js                   5 passed, 0 failed
verify-formpref-profile.js       6 passed, 0 failed
verify-freshness.js              4 passed, 0 failed
verify-fuzz.js                   9 passed, 0 failed   (9,000 randomized households)
verify-gemini-share.js           4 passed, 0 failed
verify-goal-cap.js               9 passed, 0 failed
verify-golden-invariants.js      64 total, 0 fail
verify-golden.js                 12 passed, 0 failed
verify-goal-funding.js           6 passed, 0 failed   (planned vs supportable residual)
verify-goal-funding-reconcile.js 7 passed, 0 failed   (engine cash identity, all goal types)
verify-grow.js                   7 passed, 0 failed
verify-hidecat.js                8 passed, 0 failed
verify-household-journeys.js      8 passed, 0 failed   (stranger households H1,H3-H8)
verify-idempotent.js             8 passed, 0 failed
verify-import-income.js          4 passed, 0 failed
verify-income-calendar.js        13 passed, 0 failed
verify-income-direct.js          4 passed, 0 failed
verify-income-freq.js            6 passed, 0 failed
verify-income-suggest.js         4 passed, 0 failed
verify-income.js                 5 passed, 0 failed
verify-itemized-tag.js           6 passed, 0 failed
verify-lastpick.js               9 passed, 0 failed
verify-ledger-norm.js            5 passed, 0 failed
verify-ledger.js                 4 passed, 0 failed
verify-life-changes.js           7 passed, 0 failed
verify-manualupd.js              6 passed, 0 failed
verify-midyear-pay.js            13 passed, 0 failed
verify-migration.js              22 passed, 0 failed
verify-model.js                  4 passed, 0 failed
verify-nest-review.js            14 passed, 0 failed
verify-new-user-journey.js       6 passed, 0 failed   (clean-start 3-way oracle)
verify-optimize.js               8 passed, 0 failed
verify-overbudget-sign.js        3 passed, 0 failed
verify-parent-chip.js            7 passed, 0 failed
verify-percheck-chain.js         23 passed, 0 failed
verify-percheck.js               8 passed, 0 failed
verify-perf.js                   5 passed, 0 failed   (relative baseline)
verify-property.js               8 passed, 0 failed
verify-pullin.js                 33 passed, 0 failed
verify-recent-monthscope.js      2 passed, 0 failed
verify-recent-sort.js            3 passed, 0 failed
verify-recent-switch.js          6 passed, 0 failed
verify-reconcile.js              5 passed, 0 failed
verify-scan-fallback.js          4 passed, 0 failed
verify-search-type.js            3 passed, 0 failed
verify-security.js               18 passed, 0 failed
verify-session.js                5 passed, 0 failed
verify-sharewiz.js               6 passed, 0 failed
verify-starter-share.js          20 passed, 0 failed
verify-tabbar.js                 8 passed, 0 failed
verify-table-grow.js             3 passed, 0 failed
verify-tour.js                   15 passed, 0 failed
verify-trim.js                   5 passed, 0 failed
verify-update.js                 6 passed, 0 failed
verify-version.js                9 passed, 0 failed   (confirms v0.68.12 · 20260829.100)
verify-wizard-preserve.js        8 passed, 0 failed
verify-wren-analyze.js           8 passed, 0 failed
verify-wren-analyze2.js          8 passed, 0 failed
verify-wren-analyze3.js          19 passed, 0 failed
verify-wren-golden.js            122/122 cases · 133/133 assertions
verify-wren-residual.js          6 passed, 0 failed
verify-wren-unified.js           5 passed, 0 failed
verify-wren.js                   20 passed, 0 failed
verify-write-contract.js         10 passed, 0 failed
verify-mutation.js               12/12 CAUGHT (run alone) · app.html restored byte-exact
```

## What's new since the prior report (v0.68.10 → v0.68.15)

- **Application-wide verified-write contract** — `writeMeta` root fix (baseline advances only on confirmed persistence; failures surface a retry banner and are durably recoverable), transaction edit/delete refuse on unverified row identity, atomic net-worth save, expense/recurring writes on the durable-id path. (`verify-write-contract.js`.)
- **Formal schema migration** — `schemaVersion`, ordered idempotent migrations, pre-migration backup, fail-safe + write-lock on a newer schema, financial-fingerprint preservation across a **checked-in fixture corpus** (`fixtures/meta/`). (`verify-migration.js`.)
- **Beta-readiness harnesses** — clean-start new-user journey with the *user-sees = engine = persisted* oracle, stranger-household journeys (H1, H3–H8), and a chaos-user misuse suite; each break-audited. (`verify-new-user-journey.js`, `verify-household-journeys.js`, `verify-chaos-user.js`.)
- **Onboarding fix (v0.68.13)** — the auto-tour no longer launches over the first-run choice; it waits for the user to pick a path and land on a clear screen. (`verify-firstrun-tour.js`.)
- **Contingency ↔ goals clarity, then a real model distinction (v0.68.14 → v0.68.15)** — the "Can you cover it?" block and Wren now answer whether an over-budget month touches goals. The blanket "goals are unaffected" was corrected: new authoritative `goalFundingStatus()` distinguishes **planned** from **currently-supportable** residual funding (only the cash-absorbed slice of an overage erodes residual; fixed and category-linked goals are reserved before the leftover; envelope self-coverage and shared contingency kept distinct). Proven at the engine level with the full cash-reconciliation identity across every goal type + coverage layer + the floor. (`verify-goal-funding.js`, `verify-goal-funding-reconcile.js`, `verify-contingency-goals.js`.) Floor-aware multi-month cash-flow reconciliation is deliberately deferred as future work (see `BETA_STUDY.md` Part 7).

## Still owed before public 1.0 (NOT covered by the above — needs real hardware/people)

1. **Two real phones on one shared Nest** — simultaneous adds; the documented client-only reservation boundary needs a live check, not a claim.
2. **Safari / installed-PWA behavior on iPhone**, then Chrome/Android and desktop Chrome.
3. **App-kill / reopen during a write**; expired-OAuth transitions; account switching.
4. **VoiceOver, Dynamic Type, 320px reflow, real contrast** — on-device accessibility.
5. **Live Google Drive sharing drill** (starter-copy) on a populated dummy household.
6. **Hostile-text dataset** through the full lifecycle (import → Wren → search → edit → share → receipt scan → reload).
7. **Unfamiliar-user beta.**

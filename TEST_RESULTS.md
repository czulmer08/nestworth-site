# NestWorth — executed test results

**Build under test:** v0.68.12 · Build 20260829.100
**app.html SHA-256:** `5229b467d19043d99c39a30dfb21d9c5f29b9531523190a0a9c0594ecfda5468`
**Executed:** 2026-08-29 14:52 UTC
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
| Test files | **86** (85 functional suites + mutation) |
| Functional suites | **85 / 85 pass**, 0 failed |
| Total assertions | **~892** (695 `passed`-style + 64 golden invariants + 133 Wren-golden) |
| Randomized households (fuzz) | **9,000**, 9/9 identity invariants |
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

**All requested suites executed on v0.68.12 and passed.**

## Full per-suite output (all 86 files)

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
verify-contingency-coverage.js   25 passed, 0 failed
verify-coverage.js               12 passed, 0 failed
verify-decisions-ui.js           13 passed, 0 failed
verify-decisions.js              7 passed, 0 failed
verify-discover.js               4 passed, 0 failed
verify-dropdowns.js              13 passed, 0 failed
verify-effortless.js             4 passed, 0 failed
verify-engine-invariants.js      3 passed, 0 failed   (FIN-ASOF-001/002, FIN-NW-001)
verify-erase-key.js              4 passed, 0 failed
verify-fixes.js                  6 passed, 0 failed
verify-fold.js                   5 passed, 0 failed
verify-formpref-profile.js       6 passed, 0 failed
verify-freshness.js              4 passed, 0 failed
verify-fuzz.js                   9 passed, 0 failed   (9,000 randomized households)
verify-gemini-share.js           4 passed, 0 failed
verify-goal-cap.js               9 passed, 0 failed
verify-golden-invariants.js      64 total, 0 fail
verify-golden.js                 12 passed, 0 failed
verify-grow.js                   7 passed, 0 failed
verify-hidecat.js                8 passed, 0 failed
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

## What's new since the prior report (v0.68.10 → v0.68.12)

- **Application-wide verified-write contract** — `writeMeta` root fix (baseline advances only on confirmed persistence; failures surface a retry banner and are durably recoverable), transaction edit/delete refuse on unverified row identity, atomic net-worth save, expense/recurring writes on the durable-id path. (`verify-write-contract.js`, new.)
- **Formal schema migration** — `schemaVersion`, ordered idempotent migrations, pre-migration backup, fail-safe + write-lock on a newer schema, financial-fingerprint preservation across a **checked-in fixture corpus** (`fixtures/meta/`). (`verify-migration.js`, new.)
- **Multi-row goal-move idempotency** and **pending-meta reconciliation** added to `verify-idempotent.js` / `verify-write-contract.js`.

## Still owed before public 1.0 (NOT covered by the above — needs real hardware/people)

1. **Two real phones on one shared Nest** — simultaneous adds; the documented client-only reservation boundary needs a live check, not a claim.
2. **Safari / installed-PWA behavior on iPhone**, then Chrome/Android and desktop Chrome.
3. **App-kill / reopen during a write**; expired-OAuth transitions; account switching.
4. **VoiceOver, Dynamic Type, 320px reflow, real contrast** — on-device accessibility.
5. **Live Google Drive sharing drill** (starter-copy) on a populated dummy household.
6. **Hostile-text dataset** through the full lifecycle (import → Wren → search → edit → share → receipt scan → reload).
7. **Unfamiliar-user beta.**

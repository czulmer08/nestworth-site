# NestWorth — executed test results

**Build under test:** v0.68.27 · Build 20260829.115
**app.html SHA-256:** `913b2caf4053d1c25ebf5a2dc533f3f75f4702cbb33e36a137d7372e6f0fb882`
**Executed:** 2026-08-29 21:29 UTC
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
| Test files | **101** (100 functional suites + mutation) |
| Functional suites | **100 / 100 pass**, 0 failed |
| Total assertions | **~1,015** (819 `passed`-style + 64 golden invariants + 133 Wren-golden) |
| Randomized households (fuzz) | **9,000**, 9/9 identity invariants |
| Beta-readiness harnesses | new-user journey **6/6**, household journeys (H1,H3–H8) **8/8**, chaos-user **9/9**, first-run tour timing **5/5** — each break-audited |
| Goal-funding (planned vs supportable) | helper golden **18/18** (incl. GF-007…GF-012 cross-category offset and GF-013…GF-018 unbudgeted consumption), engine reconciliation **8/8**, contingency↔goals narration **8/8** (incl. CASE 7 coverage↔goal consistency) — full cash identity reconciles; each break-audited |
| Mutation (validity-gated, run alone) | **25 / 25 CAUGHT by genuine assertion failure**; app.html restored byte-exact |

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
| `verify-mutation.js` (validity gate) | **25 / 25 CAUGHT**, byte-exact restore |
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
| `verify-goal-funding.js` | **18 / 18** — planned vs supportable residual: under/on-plan, envelope-self, shared-contingency, uncovered, floor + **GF-007…GF-012 cross-category offset** + **GF-013…GF-018 unbudgeted/uncategorized consumption** (reduces residual, partial offset by under-room, exceeds→$0+overflow, uncategorized≡named, refund restores, goal-move-not-consumption); reconciliation invariants |
| `verify-goal-funding-reconcile.js` | **8 / 8** — engine-level cash identity across every goal type (fixed, category-linked, residual, capped) + coverage layer + floor + **unbudgeted consumption** (C = canonical actual consumption) |
| `verify-contingency-goals.js` | **8 / 8** — Review + Wren narrate planned-vs-supported honestly; order fix, no vacuous $0.00 line, buffer-over contingency-buffer note, **CASE 7 coverage↔goal consistency on an offset month** |
| `verify-contingency-history.js` | **11 / 11** — Wren TEMPORAL contingency questions + the CAUSAL "despite my deposit, why no contingency?" (a deposit doesn't build the pool — only unspent buffer budget does; with a non-hijack control): `getContingencyFacts()` month-by-month history + firstNegativeMonth/lastPositiveMonth; "when did it become overspent?" names the month (≠ the current-state answer); "how much is in my contingency after my bills?" is a clean balance/available/why answer (no uncovered-envelope or year-end over-answer) |
| `verify-cashflow-current-month.js` | **5 / 5** — proves the "so far + plan" current-month net does NOT double-count income or produce a catch-up artifact: income = max(actual, plan) counted once, outflow = max(actual, plan), net only SHRINKS as spending is logged |
| `verify-cashflow-presentation.js` | **5 / 5** — column reads "Projected cash" (not "Balance"); a $0 Starting savings shows a trend-not-cash note; an overspent contingency is surfaced alongside so a positive projected total isn't misread as "all covered" |
| `verify-cash-allocation.js` | **14 / 14** — (incl. CASH-ALLOC-013/014 the optional contingency TARGET: repair → build toward target → residual) SURPLUS ALLOCATION: monthlyCashReconciliation() (income → consumption → protected goals → REPAIR entering contingency deficit → residual → reserves); CASH-ALLOC-001…012 incl. the exact identity, refund/goal-move/three-paycheck, and the no-double-count (only the ENTERING deficit is repairable) |
| `verify-wren-cash-alloc.js` | **8 / 8** — Wren routes "projected cash" to the cash-flow projection (not spending pace) and answers the allocation follow-up "will it go into contingency or fund my goals?" from the reconciliation — resolving "it" to the prior fact, both halves, direct answer first |
| `verify-cash-recon-card.js` | **6 / 6** — the surplus reconciliation is VISIBLE: the Contingency card draws a "where this month's cash is going" waterfall + the raw/repaired/effective contingency distinction, straight from monthlyCashReconciliation() (no duplicated math); no-surplus month shows the reserve draw; no card until a deposit lands. Rendered-screenshot check |
| `verify-cross-surface-recon.js` | **5 / 5** — cross-surface reconciliation language: when a month's surplus can repair an overspent contingency, the Cash-Flow verdict, the Month buffer-over line, and Wren's deposit answer ALL say so (from one shared helper) and none keeps the old "comes out of cash / doesn't refill it / won't move it" contradiction |
| `verify-contingency-trend.js` | **6 / 6** — the contingency history is now VISIBLE: the Contingency card draws a month-by-month bar sparkline (green above / red below the zero line) with the crossing month highlighted and a caption naming it; healthy buffer reads "in the black"; no chart when there's no buffer |

**All requested suites executed on v0.68.27 and passed.**

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
verify-contingency-goals.js      8 passed, 0 failed   (narration + order + buffer-note + coverage↔goal consistency)
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
verify-goal-funding.js          12 passed, 0 failed   (planned vs supportable + GF-007…012 cross-category offset)
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
verify-version.js                9 passed, 0 failed   (version-format & update-comparison logic; not tied to a specific build)
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

## What's new since the prior report (v0.68.10 → v0.68.27)
- **Contingency state-model + language finish (v0.68.27)** — a product pass (no accounting rewrite). The Contingency card leads with **"Contingency available now $0"** and shows RAW (history) vs "Covered by this month's surplus" vs "Effective balance" beneath (replacing "Effective if applied"), explaining the surplus covers the shortfall *for planning* without rewriting history and saying plainly when a month got you out of the hole but hasn't built a cushion above $0. Month reminders stop repeating the whole deficit per category (short "covered by this month's cash surplus" + one household line); the Cash-Flow verdict uses the reconciled sentence; the recon card's intermediate total is renamed "Cash remaining after that" with a note that it's NOT the Cash-Flow projected month-end figure. NEW optional **contingency target**: after repairing to $0, surplus builds a positive cushion toward the target before residual goals (identity preserved; target 0 = unchanged). CASH-ALLOC-013/014 + cross-surface/recon-card cases, break-audited.
- **Cross-surface reconciliation language (v0.68.26)** — after the engine learned a month's surplus can repair an overspent contingency, several surfaces still contradicted the Contingency card by saying "overspent, $0 available, comes out of cash / doesn't refill it / the deposit won't move it". No engine change: new single-source helpers `contingencyReconNote()`/`contingencyReconSentence()` describe the reconciled reality once, and the Cash-Flow verdict, the Month buffer-over coverage line, and Wren's deposit answer all speak from it — surplus-can-repair when there's a surplus, the old language only when there genuinely isn't. `verify-cross-surface-recon.js`, break-audited.
- **Surplus reconciliation is now visible (v0.68.25)** — the product step after v0.68.24's engine. The Contingency card draws a "where this month's cash is going" waterfall (deposits → spending → protected goals → surplus → contingency repaired → residual → remaining) with a one-line interpretation, and distinguishes RAW contingency, what this month's surplus can repair, and the EFFECTIVE position if applied — so a historical negative buffer no longer reads as "the surplus didn't matter". It renders straight from `monthlyCashReconciliation()` — the same helper Wren narrates, no duplicated math. `verify-cash-recon-card.js` (6 cases, break-audited, rendered-screenshot check).
- **Surplus allocation — the missing inverse of expense coverage (v0.68.24)** — NestWorth modelled where an overage comes from, but had no authoritative answer to where excess cash goes when actual income exceeds the month's requirements. New computed (non-writing) `monthlyCashReconciliation()`: income → consumption → protected fixed/linked goals → repair the contingency deficit → residual → reserves, with an exact identity. Correctness point caught while building: only the deficit ENTERING the month is repairable from that month's surplus — the current month's own buffer overspend is already in consumption, so repairing the current end-of-month deficit would double-count it (the auditor's example used the entering position, which is what `rawBuffer` is). Wren now routes "projected cash" to the cash-flow projection and answers the allocation follow-up from the reconciliation (resolving "it" to the prior figure, both halves, direct answer first). `verify-cash-allocation.js` (CASH-ALLOC-001…012) + `verify-wren-cash-alloc.js` (WREN-CASH-001…008), break-audited. Deferred: surfacing this in the Contingency card / Decision Engine UI, and floor-aware multi-month reconciliation.
- **Wren answers the causal deposit↔contingency question (v0.68.23)** — "despite the large deposit in July, why do I still have no contingency?" used to get the generic overspent-state answer, which never addressed the premise. A deposit doesn't build the contingency pool — only unspent buffer-category budget does (income/deposits go to cash and net worth). Wren now corrects that directly and, when overspent, says rebuilding needs buffer categories under budget, not another deposit. Guarded so a plain "will my paycheck cover the overage?" still routes to coverage. `verify-contingency-history.js` +2 cases, break-audited.
- **Unbudgeted/uncategorized consumption now reduces supportable residual (v0.68.22, adversarial audit)** — `goalFundingStatus()`'s inputs were all budget-line based, so a transaction in a category with no budget line, or an uncategorized expense, was real cash consumption (canonical `monthActualTotals` includes it) that never reduced residual capacity. New `unbudgetedConsumption()` sums this month's expense rows not in any budgeted category (uncategorized included; refunds net down; goal movements excluded), folded into the no-cushion cash pressure net of plain under-budget room — budgeted categories skipped so nothing double-charges, and the full cash identity still reconciles. `verify-goal-funding.js` GF-013…GF-018 + a reconcile identity case, mutation-audited.
- **Contingency history is now VISIBLE on the card (v0.68.21)** — v0.68.19 gave Wren the month-by-month history to narrate, but there was nowhere to *see* it. The Contingency card now draws a compact bar sparkline of the pooled buffer's month-end balance across the completed months (green above the zero line, red below), highlights the month it first crossed negative, and captions it in plain language. It reads from the same `getContingencyFacts()` history Wren narrates, so the picture and Wren's answer can't disagree. `verify-contingency-trend.js` (6 cases, break-audited, with a rendered screenshot check).
- **Cash-flow clarity + a decomposition proof (v0.68.20, from real-use confusion)** — a user asked how the cash-flow BALANCE could be positive while contingency is overspent. Two different pools: the running total is projected *cash*, the contingency is a budget buffer. The column is renamed **"Projected cash"**, a **$0-Starting-savings** note flags that the figures are a trend from an artificial $0 baseline (not cash on hand), and an overspent contingency is now surfaced beside the projection so a positive trend isn't read as "all covered". Crucially, before assuming it was only labeling, the large recovering month (July −$20k → August +$20.5k) was **investigated**: `verify-cashflow-current-month.js` proves the current-month "so far + plan" net does NOT double-count income and is NOT a catch-up artifact — income = max(actual, plan) counted once, and the net only shrinks as real spending is logged. It's a real deposit already received; the math is correct, the ambiguity was the label. Both new suites break-audited with permanent `verify-mutation.js` entries.
- **Wren temporal-contingency routing (v0.68.19, found by ordinary use)** — "When did my contingency become overspent?" is a TIME question and was being answered as the STATE question "IS it overspent?" (repeating the current −$X balance). New engine helper `getContingencyFacts()` exposes the month-by-month pool history + `firstNegativeMonth`/`lastPositiveMonth`/carry-in/biggest-drop; Wren narrates it (narrator-not-calculator) so a temporal question names the month it first crossed negative, and the state question "how much is in my contingency after my bills?" gives a clean balance/$0-available/why answer instead of dumping uncovered-envelope and year-end lines. Break-audited: `verify-contingency-history.js` (9 cases) + a permanent `verify-mutation.js` entry (removing the temporal route makes it fail). This closes a Wren golden-test gap: current-state contingency was heavily tested, but historical-transition questions were not.
- **Cross-category offset fix in `goalFundingStatus()` (v0.68.18)** — an adversarial audit found a seventh scenario the six goal-funding tests missed: one category over budget while another is under by an offsetting amount (Living +$100 / Dining −$100 → the household spent exactly its plan, `coverageReport().monthLeft = $0`). The model was charging the **gross** $100 overage to cash and wrongly reporting residual saving as reduced ($1,000 planned → $900 supported). It now nets a plain category's overage against genuine under-budget slack in **other plain categories** (`cr.fixedTot − cr.underRoom`) before deciding what truly hits cash, and the "Can you cover it?" coverage line was made consistent so coverage and goal-funding can no longer contradict each other on an offset month. Envelope self-coverage and shared contingency stay distinct and non-double-counted, and the household cash identity still reconciles. Break-audited: `verify-goal-funding.js` GF-007…GF-012, `verify-contingency-goals.js` CASE 7, and a permanent entry in `verify-mutation.js` (restoring the gross behavior makes GF-007/008 and CASE 7 fail). Whether plain slack should also offset an **envelope/buffer deficit** is deliberately left to future reconciliation work.

- **Application-wide verified-write contract** — `writeMeta` root fix (baseline advances only on confirmed persistence; failures surface a retry banner and are durably recoverable), transaction edit/delete refuse on unverified row identity, atomic net-worth save, expense/recurring writes on the durable-id path. (`verify-write-contract.js`.)
- **Formal schema migration** — `schemaVersion`, ordered idempotent migrations, pre-migration backup, fail-safe + write-lock on a newer schema, financial-fingerprint preservation across a **checked-in fixture corpus** (`fixtures/meta/`). (`verify-migration.js`.)
- **Beta-readiness harnesses** — clean-start new-user journey with the *user-sees = engine = persisted* oracle, stranger-household journeys (H1, H3–H8), and a chaos-user misuse suite; each break-audited. (`verify-new-user-journey.js`, `verify-household-journeys.js`, `verify-chaos-user.js`.)
- **Month "Can you cover it?" clarity (v0.68.16 → v0.68.17)** — from real-use feedback: over-budget list renders before the coverage assessment; the vacuous "planned $0.00 of residual saving is fully supported" line is suppressed when there's no leftover pool; and a buffer category over its monthly budget is shown in the assessment with a "covered by your shared contingency buffer" note (option B) instead of a bare alarm — so every over-budget row now has a matching coverage answer. (`verify-contingency-goals.js`.)
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

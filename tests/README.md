# NestWorth test suites

Deterministic, headless tests for the financial model and workflows. Each file loads `app.html`
in headless Chromium, mocks the Google API layer, drives real app functions, and asserts outputs.

## Run
    npm i -D playwright
    npx playwright install chromium
    # from the repo root (app.html one level up, or copy these into the repo root):
    for f in tests/verify-*.js; do node "$f" || echo "FAILED: $f"; done

Each file prints "N passed, M failed" and exits non-zero on failure — drop the loop into CI.

## Coverage (highlights)
- Concurrency: verify-append-concurrency.js (atomic reserve-and-verify append)
- Model: verify-model.js (current-month Plan+actual, goal funding months)
- Income: verify-income-calendar.js (weekly/biweekly ×52÷12 & ×26÷12, real payday calendar, year rollover)
- Analytics: verify-wren*.js, verify-wren-analyze*.js (Layers 1–3)
- Freshness: verify-freshness.js (per-account stale flags)
- Backup/erase: verify-backup.js  ·  Sharing: verify-sharewiz.js
- Gemini key: verify-gemini-share.js (device-only default, opt-in share)
- Categories/imports/goals/ledger: verify-catyear.js, verify-import-income.js, verify-ledger.js, verify-audit2.js, etc.

The paths inside each test assume it can fetch app.html over a tiny local http server it starts itself,
serving from its own __dirname — keep them beside app.html (or adjust the DIR/APP constant at the top).

# Historical metadata fixtures

Each `.json` file here is a **NestWorth Meta document** as an older generation of the app
would have written it (unversioned = schema v0). `verify-migration.js` loads every file in
this directory and, for each one, asserts that migrating it to the current schema:

- stamps the current `schemaVersion`,
- is **idempotent** (migrating an already-migrated doc changes nothing),
- **preserves the data** (every field of the normalized original survives), and
- **preserves financial meaning** — the authoritative engine computes identical household
  facts (net worth, monthly income/spending, goal balances, contingency) before and after.

## Adding a real prior-generation document
Preferred over synthetic shapes: if you can recover the Meta A2 JSON from an actual older
Nest (a real user's or a test account's), paste it as a new `NN-description.json` file here.
It is picked up automatically — no test changes needed. Strip anything you don't want checked
in (there should be no secrets in Meta; the optional API key, if ever present, must be removed).

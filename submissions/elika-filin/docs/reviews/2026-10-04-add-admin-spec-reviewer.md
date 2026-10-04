# Review · add-admin · spec-reviewer · 2026-10-04T13:21:44.802Z

> agent: spec-reviewer · tools: Read, Grep, Glob, Bash(pnpm test *) · model: claude-opus-5[1m] · turns: 46 · cost: $2.59 · 218 s
> The reviewer is a separate `claude -p` session with read-only tools; the maker never sees this prompt.

## 1. Findings

No findings: every scenario has a test asserting its exact WHEN/THEN values, every `[x]` task's behaviour is in the code, and no project rule is broken (`process.env` only in `apps/api/src/config.ts`; handlers parse → call one `src/lib/` function → return JSON; all adapters in tests are `vi.fn` fakes over `data/shops/`).

## 2. Coverage

- Scenario: Config reads ADMIN_TOKEN — covered by apps/api/src/config.test.ts:36
- Scenario: Login with the right token sets the session cookie — covered by apps/api/src/routes/admin.test.ts:228
- Scenario: Login with a wrong token — covered by apps/api/src/routes/admin.test.ts:243
- Scenario: Login without a configured token — covered by apps/api/src/routes/admin.test.ts:253
- Scenario: Login body without a token is rejected — covered by apps/api/src/routes/admin.test.ts:263
- Scenario: Logout clears the cookie — covered by apps/api/src/routes/admin.test.ts:278
- Scenario: Session reflects the cookie — covered by apps/api/src/routes/admin.test.ts:294
- Scenario: Missing cookie is unauthorized — covered by apps/api/src/routes/admin.test.ts:316
- Scenario: Tampered cookie is unauthorized — covered by apps/api/src/routes/admin.test.ts:343
- Scenario: Valid cookie passes the guard — covered by apps/api/src/routes/admin.test.ts:365
- Scenario: Unconfigured admin rejects every cookie — covered by apps/api/src/routes/admin.test.ts:376
- Scenario: Missing file reads as defaults — covered by apps/api/src/lib/store/admin-settings.test.ts:36
- Scenario: Reads persisted settings — covered by apps/api/src/lib/store/admin-settings.test.ts:49
- Scenario: Update writes atomically — covered by apps/api/src/lib/store/admin-settings.test.ts:60
- Scenario: Invalid file content is an error — covered by apps/api/src/lib/store/admin-settings.test.ts:79
- Scenario: Persisted data source overrides DATA_SOURCE — covered by apps/api/src/routes/products-visibility.test.ts:126
- Scenario: Settings on a fresh install — covered by apps/api/src/routes/admin.test.ts:387
- Scenario: Switch to snapshot applies immediately — covered by apps/api/src/routes/admin.test.ts:398
- Scenario: Switch back to live — covered by apps/api/src/routes/admin.test.ts:428
- Scenario: Invalid settings body — covered by apps/api/src/routes/admin.test.ts:452
- Scenario: Live mode lists products beyond the first ten — covered by apps/api/src/routes/admin.test.ts:480
- Scenario: Snapshot mode with a visibility array — covered by apps/api/src/routes/admin.test.ts:520
- Scenario: Fallback shop lists its snapshot — covered by apps/api/src/routes/admin.test.ts:550
- Scenario: Unavailable shop lists nothing — covered by apps/api/src/routes/admin.test.ts:570
- Scenario: Hide a visible product — covered by apps/api/src/routes/admin.test.ts:598
- Scenario: Show a product beyond the first ten — covered by apps/api/src/routes/admin.test.ts:630
- Scenario: Unknown product — covered by apps/api/src/routes/admin.test.ts:662
- Scenario: Malformed id or body — covered by apps/api/src/routes/admin.test.ts:677
- Scenario: Loading state — covered by apps/web/src/pages/AdminPage.test.tsx:170
- Scenario: Not authenticated shows the login form — covered by apps/web/src/pages/AdminPage.test.tsx:186
- Scenario: Authenticated shows the panel — covered by apps/web/src/pages/AdminPage.test.tsx:202
- Scenario: Wrong token — covered by apps/web/src/pages/AdminPage.test.tsx:251
- Scenario: Admin not configured — covered by apps/web/src/pages/AdminPage.test.tsx:267
- Scenario: Login failure other than 401/503 and alert reset — covered by apps/web/src/pages/AdminPage.test.tsx:284
- Scenario: Successful login opens the panel — covered by apps/web/src/pages/AdminPage.test.tsx:314
- Scenario: Radio switches the data source — covered by apps/web/src/pages/AdminPage.test.tsx:338
- Scenario: Source switch failure keeps the radio — covered by apps/web/src/pages/AdminPage.test.tsx:360
- Scenario: Unticking hides a product — covered by apps/web/src/pages/AdminPage.test.tsx:379
- Scenario: Ticking shows a product — covered by apps/web/src/pages/AdminPage.test.tsx:398
- Scenario: Save failure keeps the checkbox — covered by apps/web/src/pages/AdminPage.test.tsx:419
- Scenario: Status notes per shop — covered by apps/web/src/pages/AdminPage.test.tsx:437
- Scenario: Logout returns to the login form — covered by apps/web/src/pages/AdminPage.test.tsx:464
- Scenario: Admin requests send method, path and body — covered by apps/web/src/api/client.test.ts:168
- Scenario: Product id is URL-encoded in the visibility path — covered by apps/web/src/api/client.test.ts:250
- Scenario: Login failures carry the status — covered by apps/web/src/api/client.test.ts:261
- Scenario: Selection keeps the first ten of each shop in order — covered by apps/api/src/lib/catalog.test.ts:90
- Scenario: Selection serves the chosen ids in upstream order — covered by apps/api/src/lib/catalog.test.ts:116
- Scenario: Ids missing upstream are ignored and an empty list hides the shop — covered by apps/api/src/lib/catalog.test.ts:139
- Scenario: Catalog honours the admin's visibility — covered by apps/api/src/routes/products-visibility.test.ts:83
- Scenario: A visibility change is served without restart — covered by apps/api/src/routes/products-visibility.test.ts:112
- Scenario: Header navigation on the catalog page — covered by apps/web/src/App.test.tsx:112
- Scenario: Light color scheme is forced — covered by apps/web/src/theme.test.ts:10

## 3. Verdict

READY TO ARCHIVE — 26/26 tasks `[x]`, `pnpm test` green (27 files, 178 tests passed), all 52 scenarios covered with their exact values, and the human smoke run is recorded in `docs/session-notes.md:80` (no `smoke: ____` placeholder left).

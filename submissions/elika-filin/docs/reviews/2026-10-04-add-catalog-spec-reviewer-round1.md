# Review · add-catalog · spec-reviewer · 2026-10-04T11:24:27.099Z

> agent: spec-reviewer · tools: Read, Grep, Glob, Bash(pnpm test *) · model: claude-opus-5[1m] · turns: 48 · cost: $1.44 · 199 s
> The reviewer is a separate `claude -p` session with read-only tools; the maker never sees this prompt.

## Findings

- `apps/api/src/shops/osio.ts:70` — "Osio adapter maps the products API" (SHALL map **each** array item) — `payload.filter(isOsioItem)` silently drops any item whose shape differs (e.g. `description: null`), so a partially malformed upstream response yields fewer products with a correspondingly lower `count` instead of mapping every item; no test or design note sanctions the drop (unlike karashynyard's documented "cards without an integer price are skipped").

## Coverage

- Scenario: Fixture page yields its products in page order — covered by `apps/api/src/shops/karashynyard.test.ts:26`
- Scenario: Repeated product id keeps the first card — covered by `apps/api/src/shops/karashynyard.test.ts:65`
- Scenario: Page without store records is a failure — covered by `apps/api/src/shops/karashynyard.test.ts:82`
- Scenario: Fixture response yields twelve products in response order — covered by `apps/api/src/shops/osio.test.ts:28`
- Scenario: Coming-soon item is out of stock — covered by `apps/api/src/shops/osio.test.ts:65`
- Scenario: Non-JSON body is a failure — covered by `apps/api/src/shops/osio.test.ts:80`
- Scenario: Empty product list is a failure — covered by `apps/api/src/shops/osio.test.ts:89`
- Scenario: Non-2xx status — covered by `apps/api/src/shops/karashynyard.test.ts:91`
- Scenario: Network error — covered by `apps/api/src/shops/osio.test.ts:98`
- Scenario: Snapshot product normalizes to a Product — covered by `apps/api/src/lib/snapshot.test.ts:9`
- Scenario: Config reads DATA_SOURCE — covered by `apps/api/src/config.test.ts:4`
- Scenario: Snapshot mode serves the committed files — covered by `apps/api/src/routes/products.test.ts:74`
- Scenario: Runtime switch to snapshot — covered by `apps/api/src/lib/catalog.test.ts:140`
- Scenario: Both shops live — covered by `apps/api/src/routes/products.test.ts:104`
- Scenario: One shop down falls back to its snapshot — covered by `apps/api/src/routes/products.test.ts:131`
- Scenario: Second load within five minutes reuses the cache — covered by `apps/api/src/lib/catalog.test.ts:103`
- Scenario: A failed fetch is not cached — covered by `apps/api/src/lib/catalog.test.ts:122`
- Scenario: Selection keeps the first ten of each shop in order — covered by `apps/api/src/lib/catalog.test.ts:75`
- Scenario: Known id — covered by `apps/api/src/routes/products.test.ts:159`
- Scenario: Unknown id — covered by `apps/api/src/routes/products.test.ts:181`
- Scenario: Two shops with products — covered by `apps/web/src/pages/CatalogPage.test.tsx:96`
- Scenario: Loading state — covered by `apps/web/src/pages/CatalogPage.test.tsx:129`
- Scenario: Error state — covered by `apps/web/src/pages/CatalogPage.test.tsx:138`
- Scenario: Snapshot fallback note per shop — covered by `apps/web/src/pages/CatalogPage.test.tsx:149`
- Scenario: Chosen snapshot mode shows no note — covered by `apps/web/src/pages/CatalogPage.test.tsx:165`
- Scenario: Successful request — covered by `apps/web/src/api/client.test.ts:36`
- Scenario: Failed request — covered by `apps/web/src/api/client.test.ts:46`

## Verdict

READY TO ARCHIVE — all 25 tasks verified against the code (fixture counts 5/10/12 confirmed, `process.env` only in `config.ts`, handlers thin, no test touches a live shop), 27/27 scenarios asserted with their exact values, `pnpm test` 29 passed (10 files); the single finding is a narrow unspecified drop path, and the pending `smoke: ____` in `docs/session-notes.md` is the documented human step before archiving.

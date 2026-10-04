# Review · add-catalog · spec-reviewer · 2026-10-04T11:35:33.189Z

> agent: spec-reviewer · tools: Read, Grep, Glob, Bash(pnpm test *) · model: claude-opus-5[1m] · turns: 45 · cost: $1.27 · 183 s
> The reviewer is a separate `claude -p` session with read-only tools; the maker never sees this prompt.

## Findings

No findings — every scenario has a test asserting its exact WHEN/THEN values, every `[x]` task's behaviour is in the code, no project rule is broken (`process.env` only in `apps/api/src/config.ts:14`; handlers in `apps/api/src/routes/products.ts` call one `src/lib` function each; all adapter tests use `apps/api/fixtures/` with a stub `FetchLike`; adapters return typed failures instead of throwing).

## Coverage

- Scenario: Snapshot product normalizes to a Product — covered by apps/api/src/lib/snapshot.test.ts:12
- Scenario: A failed snapshot read is retried — covered by apps/api/src/lib/snapshot.test.ts:34
- Scenario: Config reads DATA_SOURCE — covered by apps/api/src/config.test.ts:4
- Scenario: Snapshot mode serves the committed files — covered by apps/api/src/routes/products.test.ts:77
- Scenario: Runtime switch to snapshot — covered by apps/api/src/lib/catalog.test.ts:159
- Scenario: Both shops live — covered by apps/api/src/routes/products.test.ts:107
- Scenario: One shop down falls back to its snapshot — covered by apps/api/src/routes/products.test.ts:134
- Scenario: Shop down and its snapshot unreadable — covered by apps/api/src/routes/products.test.ts:157
- Scenario: Second load within five minutes reuses the cache — covered by apps/api/src/lib/catalog.test.ts:103
- Scenario: A failed fetch is not cached — covered by apps/api/src/lib/catalog.test.ts:122
- Scenario: Concurrent cold loads call each adapter once — covered by apps/api/src/lib/catalog.test.ts:140
- Scenario: Selection keeps the first ten of each shop in order — covered by apps/api/src/lib/catalog.test.ts:75
- Scenario: Known id — covered by apps/api/src/routes/products.test.ts:187
- Scenario: Unknown id — covered by apps/api/src/routes/products.test.ts:209
- Scenario: Fixture page yields its products in page order — covered by apps/api/src/shops/karashynyard.test.ts:26
- Scenario: Repeated product id keeps the first card — covered by apps/api/src/shops/karashynyard.test.ts:65
- Scenario: Page without store records is a failure — covered by apps/api/src/shops/karashynyard.test.ts:82
- Scenario: Fixture response yields twelve products in response order — covered by apps/api/src/shops/osio.test.ts:28
- Scenario: Malformed item is skipped — covered by apps/api/src/shops/osio.test.ts:92
- Scenario: Request carries the tenant header — covered by apps/api/src/shops/osio.test.ts:65
- Scenario: Coming-soon item is out of stock — covered by apps/api/src/shops/osio.test.ts:77
- Scenario: Non-JSON body is a failure — covered by apps/api/src/shops/osio.test.ts:103
- Scenario: Empty product list is a failure — covered by apps/api/src/shops/osio.test.ts:112
- Scenario: Non-2xx status — covered by apps/api/src/shops/karashynyard.test.ts:91
- Scenario: Network error — covered by apps/api/src/shops/osio.test.ts:121
- Scenario: Two shops with products — covered by apps/web/src/pages/CatalogPage.test.tsx:96
- Scenario: Loading state — covered by apps/web/src/pages/CatalogPage.test.tsx:132
- Scenario: Error state — covered by apps/web/src/pages/CatalogPage.test.tsx:141
- Scenario: Snapshot fallback note per shop — covered by apps/web/src/pages/CatalogPage.test.tsx:152
- Scenario: Chosen snapshot mode shows no note — covered by apps/web/src/pages/CatalogPage.test.tsx:188
- Scenario: Unavailable shop — covered by apps/web/src/pages/CatalogPage.test.tsx:168
- Scenario: Successful request — covered by apps/web/src/api/client.test.ts:36
- Scenario: Failed request — covered by apps/web/src/api/client.test.ts:46

## Verdict

READY TO ARCHIVE — 32/32 tasks `[x]`, all 33 scenarios covered with their exact values, `pnpm test` 40 passed (12 files), `spec:check ok — specs: 0 · active changes: 2 · archived: 0`, and the human smoke line in `docs/session-notes.md:44` is filled in (`live [ 'karashynyard:live:10', 'osio:live:10' ] 20`).

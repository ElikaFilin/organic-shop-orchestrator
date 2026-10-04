# Review · add-basket · spec-reviewer · 2026-10-04T12:18:25.356Z

> agent: spec-reviewer · tools: Read, Grep, Glob, Bash(pnpm test *) · model: claude-opus-5[1m] · turns: 40 · cost: $1.78 · 219 s
> The reviewer is a separate `claude -p` session with read-only tools; the maker never sees this prompt.

## 1. Findings

`apps/api/src/config.ts:32` — "Data directory configuration" ("by default the repository's `.data` … resolved from `apps/api/src/config.ts`, not from the working directory") — `env.DATA_DIR ?? DEFAULT_DATA_DIR` accepts an empty `DATA_DIR`, so `DATA_DIR=` yields `dataDir: ""` and `server.ts:28` writes `baskets.json` into the process's working directory; the sibling `SNAPSHOT_DIR` has an explicit empty-value guard at `config.ts:25`, this one does not. Non-blocking.

## 2. Coverage

- Scenario: First request sets the basket cookie — covered by apps/api/src/routes/basket.test.ts:77
- Scenario: Request with the cookie reuses the basket — covered by apps/api/src/routes/basket.test.ts:89
- Scenario: Malformed cookie gets a fresh basket — covered by apps/api/src/routes/basket.test.ts:109
- Scenario: Totals add up the lines — covered by apps/api/src/routes/basket.test.ts:124
- Scenario: Unavailable product counts zero — covered by apps/api/src/routes/basket.test.ts:150
- Scenario: Add a product with an explicit quantity — covered by apps/api/src/routes/basket.test.ts:172
- Scenario: Add without a quantity defaults to one — covered by apps/api/src/routes/basket.test.ts:194
- Scenario: Adding an existing line merges and caps at 99 — covered by apps/api/src/routes/basket.test.ts:209
- Scenario: Unknown product is rejected — covered by apps/api/src/routes/basket.test.ts:237
- Scenario: Change the quantity — covered by apps/api/src/routes/basket.test.ts:255
- Scenario: Change a line that does not exist — covered by apps/api/src/routes/basket.test.ts:273
- Scenario: Remove a line — covered by apps/api/src/routes/basket.test.ts:287
- Scenario: Remove a line that does not exist — covered by apps/api/src/routes/basket.test.ts:309
- Scenario: Clear a basket with lines — covered by apps/api/src/routes/basket.test.ts:320
- Scenario: Invalid body — covered by apps/api/src/routes/basket.test.ts:347
- Scenario: Invalid product id in the path — covered by apps/api/src/routes/basket.test.ts:379
- Scenario: Missing file means no baskets — covered by apps/api/src/lib/store/baskets.test.ts:36
- Scenario: Reads a basket from an existing file — covered by apps/api/src/lib/store/baskets.test.ts:44
- Scenario: Update writes the basket to the file — covered by apps/api/src/lib/store/baskets.test.ts:53
- Scenario: Write is atomic and keeps other baskets — covered by apps/api/src/lib/store/baskets.test.ts:63
- Scenario: Config reads DATA_DIR — covered by apps/api/src/config.test.ts:15
- Scenario: Header link counts the lines on mount — covered by apps/web/src/App.test.tsx:99
- Scenario: Two lines with totals — covered by apps/web/src/pages/BasketPage.test.tsx:85
- Scenario: Empty basket — covered by apps/web/src/pages/BasketPage.test.tsx:124
- Scenario: Changing the quantity updates the line — covered by apps/web/src/pages/BasketPage.test.tsx:138
- Scenario: Removing a line — covered by apps/web/src/pages/BasketPage.test.tsx:159
- Scenario: Clearing the basket — covered by apps/web/src/pages/BasketPage.test.tsx:182
- Scenario: Line without a product — covered by apps/web/src/pages/BasketPage.test.tsx:197
- Scenario: getBasket requests the basket — covered by apps/web/src/api/client.test.ts:70
- Scenario: Mutations send method, path and JSON body — covered by apps/web/src/api/client.test.ts:81
- Scenario: Failed request rejects with method, path and status — covered by apps/web/src/api/client.test.ts:125
- Scenario: Add from the catalog card — covered by apps/web/src/components/ProductCard.test.tsx:111

## 3. Verdict

READY TO ARCHIVE — all 32 scenarios have a test asserting their exact WHEN/THEN values, all 21 tasks are `[x]` with the described code on disk, `pnpm test` is green (Test Files 16 passed, Tests 84 passed), and the one finding is a latent config edge case, not a spec contradiction.

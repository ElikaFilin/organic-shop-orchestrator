# Верифікація (червоне → зелене): докази використання

Скорочення: `T` = `submissions/elika-filin/sessions` (транскрипти `claude -p`-ітерацій `scripts/loop.mjs`);
`W` = `submissions/elika-filin/sessions/workflows` (журнали й транскрипти workflow-агентів, що писали червоні тести).
Git — репозиторій `/Users/elikafilin/Documents/home_projects/organic-shop-orchestrator`. Timestamp'и транскриптів — UTC (`Z`), у git — `+0300`.

## 1. Що доводимо

Що для кожної з трьох змін (add-catalog, add-basket, add-admin) тести за сценаріями спеки були написані **до** коду, реально
запускались і падали (червоне), що незалежний checker підтвердив «падають з правильної причини», і що агент робив їх зеленими
через той самий гейт `pnpm check`. І головне — що агент **міняв поведінку** через практику: цитував червоний прогін і лише
потім редагував код; гейт у промпті та Stop-hook не давали завершитись без зеленого.

## 2. Докази

### Д1. Git: три пари комітів «test … — red» → «feat … — green» з цифрами прогонів
Де: `git log --date=iso --format='%H|%ad|%s'` і `git show -s <hash>` у репозиторії.
```
e869183965072b69157da48bd860e959472e1093|2026-10-04 14:13:17 +0300|test(catalog): scenario tests first — red
  Test Files  8 failed | 2 passed (10)
       Tests  1 failed | 2 passed (3)
d91e931248faff81c46e7c0672c54baa7c04ef62|2026-10-04 14:41:43 +0300|feat(catalog): shop adapters, catalog API with snapshot fallback, catalog page — green
  Test Files  13 passed (13)
       Tests  47 passed (47)
b5ebfd744014bf6dea99a4f0ce40f700d939dc11|2026-10-04 15:06:56 +0300|test(basket): scenario tests first — red
  Test Files  7 failed | 9 passed (16)
       Tests  16 failed | 47 passed (63)
84fe87014cadf7af6cf8215c991188acdf357d4a|2026-10-04 15:34:59 +0300|feat(basket): anonymous cookie basket, JSON-file store, basket page — green
  Test Files  18 passed (18)
       Tests  103 passed (103)
695f34cce90c4d5017429df6c9d23aaeb5b59fed|2026-10-04 16:08:22 +0300|test(admin): scenario tests first — red
  Test Files  13 failed | 14 passed (27)
       Tests  23 failed | 103 passed (126)
43a4a23a405ade4485e8ada06dbb980ed29b1eff|2026-10-04 16:28:06 +0300|feat(admin): token login, settings store, visibility toggles, live/snapshot switch, nav + light theme — green
  Test Files  27 passed (27)
       Tests  182 passed (182)
```
Що це показує: червоний коміт завжди передує зеленому (14:13→14:41, 15:06→15:34, 16:08→16:28); цифри збігаються з реальними прогонами у Д2 і Д5.

### Д2. Реальні червоні прогони, з яких узято цифри комітів (транскрипти workflow-агентів «red-tests»)
Де: `W/wf_548ac787-9ce/agent-a003f4087a5a9af4b.jsonl`, рядок 101, `2026-10-04T11:03:32.123Z` (session `364dc8be-543d-4eb4-afd8-6b19b67b4f42`, agent `a003f4087a5a9af4b`, label `red-tests`), tool_result команди `pnpm test 2>&1 | sed … | tail -150` (рядок 99):
```
 Test Files  8 failed | 2 passed (10)
      Tests  1 failed | 2 passed (3)
 FAIL  |api| src/shops/karashynyard.test.ts [ apps/api/src/shops/karashynyard.test.ts ]
Error: Cannot find module './karashynyard' imported from …/apps/api/src/shops/karashynyard.test.ts
```
Де: `W/wf_1e32404a-7c6/agent-a0900c3c1d90d5b3b.jsonl`, рядок 124, `2026-10-04T12:04:28.697Z` (agent `fix-red`: після знахідки checker'а додано +4 тести, 59→63):
```
 Test Files  7 failed | 9 passed (16)
      Tests  16 failed | 47 passed (63)
```
Де: `W/wf_3dd9141d-f38/agent-a64c12899f94f6935.jsonl`, рядок 173, `2026-10-04T12:56:07.504Z` (agent `red-tests`, команда `pnpm test > …/red-run-group1.txt 2>&1; …`, рядок 171):
```
 Test Files  13 failed | 14 passed (27)
      Tests  23 failed | 103 passed (126)
 FAIL  |web| src/components/AdminLoginForm.test.tsx [ apps/web/src/components/AdminLoginForm.test.tsx ]
Error: Failed to resolve import "./AdminLoginForm" from "apps/web/src/components/AdminLoginForm.test.tsx". Does the file exist?
```
Що це показує: три рядки `Test Files N failed` з комітів Д1 існують як tool_result за 2–12 хв до коміту; причина падіння — «модуля немає», тобто тести писались до коду.

### Д3. Незалежний checker: `"failsForRightReason":true` для всіх трьох червоних workflow
Де: `W/wf_548ac787-9ce/journal.jsonl`, рядки 4–5 (checker `af0b67f3ade74b76d`; його власний прогін — `agent-af0b67f3ade74b76d.jsonl` рядок 71, `2026-10-04T11:06:09.718Z`: ` Test Files  8 failed | 2 passed (10)`):
```
{"type":"started",…,"agentId":"af0b67f3ade74b76d","label":"check-red","phase":"Verify red"}
…"findings":[…],"uncoveredScenarios":[],"failsForRightReason":true,"verdict":"approve"}}
```
Де: `W/wf_1e32404a-7c6/journal.jsonl`, рядок 5 (checker `a8a5c24867e7ef1a3`; власний прогін `agent-a8a5c24867e7ef1a3.jsonl` рядок 81, `2026-10-04T11:53:49.168Z`):
```
"uncoveredScenarios":["All 32 `#### Scenario` headings in specs/basket-api, specs/basket-web and specs/catalog-web have exactly one test with the same literal values — no spec scenario is uncovered.", …],"failsForRightReason":true,"verdict":"approve"}}
```
Де: `W/wf_3dd9141d-f38/journal.jsonl`, рядок 5 (checker `af82835ca0484cdc2`; власний прогін `agent-af82835ca0484cdc2.jsonl` рядок 78, `2026-10-04T13:00:53.247Z`), finding[2]:
```
"issue":"Task 1.12 is ticked but cannot be verified from disk: `.agent-log/actions.jsonl` ends at 2026-10-04T12:34Z (15:34 local), before the add-admin test files were written … My own run reproduces the expected red output (23 failed / 103 passed, every failure a missing module, missing export or red assertion; add-catalog's and add-basket's tests green), so the tick is consistent with reality but rests on the maker's transcript." … "failsForRightReason":true,"verdict":"approve"
```
Що це показує: червоне перевіряв не автор тестів, а окремий агент, який сам запускав `pnpm test` і відтворив ті самі цифри; у add-basket його знахідка (вимоги без сценарію) спричинила фазу `fix-red` (journal рядки 6–7) — звідси 59→63 у Д2.

### Д4. Loop-ітерація: червоний tool_result → агент цитує червоне → Edit коду → зелене (поведінка, не файл)
Де: `T/63ea697e-2d6e-4a0e-a7df-ab6ea2f3007c.jsonl` (add-catalog, run 2): рядок 69, `2026-10-04T11:26:57.826Z`, tool_result `pnpm test 2>&1 | tail -40` → рядок 74 (assistant, `11:27:00.466Z`) → рядок 75 (`Edit apps/api/src/shops/types.ts`) → рядок 243, `2026-10-04T11:29:44.376Z`:
```
 FAIL  |api| src/shops/osio.test.ts > osio adapter > Request carries the tenant header
AssertionError: expected undefined to deeply equal { Object (Application-Instance) }
 Test Files  1 failed | 9 passed (10)
      Tests  1 failed | 29 passed (30)
```
```
Red: `AssertionError: expected undefined to deeply equal { Object (Application-Instance) }` — `Tests 1 failed | 29 passed (30)`. Now green it.
```
```
 Test Files  12 passed (12)
      Tests  40 passed (40)
```
Де: `T/b1b8f360-588a-44b4-b9d7-2f849bb6f7a6.jsonl` (add-admin, run 2): рядок 127, `2026-10-04T13:23:32.616Z` → рядок 132 (assistant, `13:23:39.128Z`) → рядок 265, `2026-10-04T13:25:54.826Z`:
```
 FAIL  |api| src/routes/products-visibility.test.ts > Hidden product still resolves by id
AssertionError: expected 404 to be 200 // Object.is equality
 Test Files  2 failed | 25 passed (27)
      Tests  4 failed | 178 passed (182)
```
```
Red run confirmed (4 failed, exactly the new tests). Now 8.2:
```
```
 Test Files  27 passed (27)
      Tests  182 passed (182)
```
Те саме: `T/0ddbad8f-f09c-42f1-ba1d-be9bbbe0fb32.jsonl` рядок 61 (` Test Files  1 failed (1)`, `12:33:02Z`) → рядок 65 «Red confirmed: `expected '/api/basket/items/osio:a#b' to be '/api/basket/items/osio:a%23b'`. Now the fix.» → рядок 66 `Edit apps/web/src/api/client.ts` → рядок 72 (`Tests  6 passed (6)`);
`T/f5f6a0cf-0721-43a8-991e-484042fdbedf.jsonl` рядок 133 (` Test Files  4 failed | 9 passed (13)`, `11:39:38Z`) → рядок 144 «Red run confirmed — 5 failed | 42 passed (47). Now implementing 10.2.» → рядок 167 (`47 passed`);
`T/75ad9a1b-4714-44c1-a945-063939a55e0c.jsonl` рядок 175 (` Test Files  5 failed | 11 passed (16)`, `12:25:04Z`) → рядок 190 → рядок 277 (`91 passed`).
Що це показує: у п'яти ітераціях агент сам запускав тести до коду, бачив червоне, явно називав його і лише тоді редагував продакшн-файл; зелене — наступний прогін того самого `pnpm test`.

### Д5. Останній зелений прогін кожної зміни — через гейт `node scripts/check-verdict.mjs`, а не на словах
Де (tool_result команди `node scripts/check-verdict.mjs …`): `T/f5f6a0cf-0721-43a8-991e-484042fdbedf.jsonl` рядок 189, `2026-10-04T11:40:44.645Z` (catalog); `T/0ddbad8f-f09c-42f1-ba1d-be9bbbe0fb32.jsonl` рядок 94, `2026-10-04T12:33:57.684Z` (basket); `T/b1b8f360-588a-44b4-b9d7-2f849bb6f7a6.jsonl` рядок 318, `2026-10-04T13:27:06.185Z` (admin):
```
> pnpm typecheck && pnpm lint && pnpm test && pnpm spec:check && pnpm hooks:selftest
 Test Files  13 passed (13)
      Tests  47 passed (47)
spec:check ok — specs: 0 · active changes: 2 · archived: 0
 Test Files  18 passed (18)
      Tests  103 passed (103)
spec:check ok — specs: 3 · active changes: 2 · archived: 1
 Test Files  27 passed (27)
      Tests  182 passed (182)
spec:check ok — specs: 5 · active changes: 1 · archived: 2
```
Що це показує: 47/103/182 із зелених комітів Д1 — реальні прогони гейта всередині ітерацій (перші ітерації: `T/e5097db2-…` рядок 256 `11:20:09Z` — `Tests  29 passed (29)`; `T/2f12c37d-…` рядок 418 `12:13:42Z` — `84 passed`; `T/30cc6a10-…` рядок 494 `13:17:07Z` — `178 passed`).

### Д6. Склад гейта і як червоне потрапляє агентові в промпт
Де: `package.json` рядок 13; `scripts/loop.mjs` рядки 71 і 75; `T/2f12c37d-9271-4824-9abf-9c12fee80816.jsonl` рядок 4, `2026-10-04T12:07:00.880Z` (перший user-промпт ітерації add-basket run 1):
```
"check": "pnpm typecheck && pnpm lint && pnpm test && pnpm spec:check && pnpm hooks:selftest",
```
```
behaviour is fully implemented and verified. Scenario tests come first; quote the red run before you make it green.
- pnpm check: ${g.ok ? "GREEN" : `RED (exit ${g.exit})`}${g.summary ? ` — ${g.summary}` : ""}
```
```
- pnpm check: RED (exit 2)
- failing lines:
    apps/api typecheck: src/config.test.ts(17,25): error TS2339: Property 'dataDir' does not exist on type 'AppConfig'.
```
Що це показує: гейт — typecheck+lint+tests+spec+hooks разом; `loop.mjs` сам прогнав його (RED, exit 2) і вклав червоні рядки в промпт — ітерація стартує з реального червоного стану, а не з переказу.

### Д7. Stop-hook реально зупинив агента без зеленого прогону — і агент виконав гейт
Де: `T/e9adb367-b16d-4fcc-9232-76cd460c2928.jsonl` рядок 37, `2026-10-04T14:24:03.951Z` (user, Stop hook feedback) → рядок 43 (`Bash node scripts/check-verdict.mjs`) → рядок 44, `14:24:19.798Z` (` Tests  182 passed (182)`) → рядок 49 (assistant). Хук: `.claude/hooks/stop-gate.mjs` рядки 2–6.
```
Stop hook feedback:
[node ${CLAUDE_PROJECT_DIR}/.claude/hooks/stop-gate.mjs]: Blocked by hook (stop-gate): source files were edited after the last green pnpm check. Run `node scripts/check-verdict.mjs` and quote its summary lines before finishing.
```
```
Green: `Tests  182 passed (182)` · `spec:check ok — specs: 8 · active changes: 0 · archived: 3` (exit 0).
```
Що це показує: інваріант «не завершуй без зеленого» тримає хук, а не добра воля — агент хотів відповісти «DONE», був заблокований і замість цього запустив гейт.

## 3. Як відтворити

```bash
cd /Users/elikafilin/Documents/home_projects/organic-shop-orchestrator
git log --date=iso --format='%h|%ad|%s' | grep -E ' — (red|green)$'                                  # Д1
git show -s e869183 b5ebfd7 695f34c d91e931 84fe870 43a4a23 | grep -E 'Test Files|Tests '              # цифри в комітах
T=submissions/elika-filin/sessions
W=submissions/elika-filin/sessions/workflows
grep -n -o 'failsForRightReason":[a-z]*' $W/wf_*/journal.jsonl                                          # Д3: 3 × true
# Д2/Д4/Д5: кожен tool_result з рядком "Test Files" — файл, рядок, час, підсумок
node -e 'const fs=require("fs");for(const f of process.argv.slice(1)){fs.readFileSync(f,"utf8").split("\n").forEach((l,i)=>{let o;try{o=JSON.parse(l)}catch{return}
for(const c of (o.message?.content||[]))if(c.type==="tool_result"){const t=typeof c.content==="string"?c.content:(c.content||[]).map(x=>x.text||"").join("\n");
const m=t.match(/Test Files[^\n]*/);if(m)console.log(f.split("/").pop(),"L"+(i+1),o.timestamp,"|",m[0].trim())}})}' $T/*.jsonl $W/wf_{548ac787-9ce,1e32404a-7c6,3dd9141d-f38}/agent-*.jsonl
grep -c 'Stop hook feedback' $T/*.jsonl | grep -v ':0$'                                                 # Д7: лише e9adb367
```

## 4. Чесно: чого не знайшли / що лише існує

- У **першій** loop-ітерації кожної зміни (`T/e5097db2-…`, `T/2f12c37d-…`, `T/30cc6a10-…`) агент **не запускав власного червоного `pnpm test`**: червоне він отримав у промпті від `loop.mjs` (Д6), а його перший тестовий tool_result уже зелений (`e5097db2` рядок 207, `11:19:06Z`: ` Test Files  10 passed (10)`). Сам агент пише: «group 1's red run was already in the transcript» (`2f12c37d` рядок 433). Червоне руками агента є лише у workflow-транскриптах (Д2) та в ітераціях 2–3 (Д4).
- Checker двічі зафіксував, що червоний прогін автора тестів **не аудитується з `.agent-log/actions.jsonl`** (записи поза hook-логованою сесією): `wf_1e32404a` finding[0], `wf_3dd9141d` finding[2] (Д3). Його власне відтворення — єдиний незалежний доказ червоного для add-basket/add-admin.
- `journal.jsonl` **не має timestamp'ів**; час у Д3 узято з транскриптів checker-агентів.
- Stop-hook у реальних loop-ітераціях **жодного разу не спрацював** (`Stop hook feedback` — нуль у 20 сесіях): агенти самі завершували через `check-verdict.mjs`. Єдине реальне спрацювання — окрема демо-сесія `e9adb367` (17:24 локального, після всіх комітів), запущена власником саме щоб показати хук. Рядки `PASS  stop-gate blocks…` у виводі `pnpm check` — self-test хука, не реальний блок.
- У `T/75ad9a1b-…` рядок 175 одна з 6 червоних — власна помилкова guard-асерція агента (`expected 59.97 not to be 59.97`); агент виправив **тест** (рядок 191, `Edit apps/api/src/routes/basket.test.ts`), пояснивши чому (рядок 190), і зберіг pinned-значення спеки. Задокументовано в `docs/loops/2026-10-04T12-19-57-add-basket.md`, але формально це випадок «червоне зникло правкою тесту».

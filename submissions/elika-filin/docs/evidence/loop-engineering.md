# Доказ практики «Цикли» (loop engineering) — `scripts/loop.mjs`

## 1. Що доводимо

Кожен із 9 рядків `.agent-log/loop.jsonl` відповідає реальній сесії `claude -p`, у якій агент (а) отримав згенерований циклом
промпт «Current state (computed by scripts/loop.mjs …)», (б) працював під allow-list циклу, (в) закінчив вердиктом `check-verdict.mjs`,
а один раз (г) зупинився сам за правилом «if the spec is wrong, stop and say so» — цикл зафіксував «stuck», людина вирішила комітом, наступний прогін став зеленим.

**Чесно про зіставлення.** `loop.mjs` не зберігає session id (`scripts/loop.mjs:146` пише лише `ts, change, iteration,
gateBefore, gateAfter, tasksBefore, tasksAfter, turns, outputTokens, costUsd, agentMs, spentUsd`). Сесії знайдено за часом:
перший timestamp транскрипту ∈ [row.ts − agentMs − 60 s, row.ts]. У кожне вікно потрапила рівно одна сесія, і в кожній
перше user-повідомлення (рядок 4 файлу) — промпт циклу. Скрипт зіставлення — у розділі 3.

Транскрипти (далі `T/`): `/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator-submissions-elika-filin/`. Усі дати — 2026-10-04.

| loop.jsonl | row.ts | change · iter | agentMs | turns | session id = `T/<id>.jsonl` | first … last timestamp | assistant-записів (msg id) | docs/loops |
|---|---|---|---|---|---|---|---|---|
| :1 | 11:20:33.362Z | add-catalog · 1 | 427426 | 65 | e5097db2-d85f-44f2-b6ae-c2a1736a26c9 | 11:13:20.246Z … 11:20:26.057Z | 85 (25) | `2026-10-04T11-13-17-add-catalog.md:7` |
| :2 | 11:30:47.338Z | add-catalog · 1 | 250254 | 59 | 63ea697e-2d6e-4a0e-a7df-ab6ea2f3007c | 11:26:30.652Z … 11:30:39.201Z | 80 (36) | `2026-10-04T11-26-22-add-catalog.md:7` |
| :3 | 11:41:09.621Z | add-catalog · 1 | 215995 | 40 | f5f6a0cf-0721-43a8-991e-484042fdbedf | 11:37:26.954Z … 11:41:01.341Z | 57 (23) | `2026-10-04T11-37-18-add-catalog.md:7` |
| :4 | 12:14:11.725Z | add-basket · 1 | 424284 | 100 | 2f12c37d-9271-4824-9abf-9c12fee80816 | 12:06:59.877Z … 12:14:02.563Z | 129 (60) | `2026-10-04T12-06-56-add-basket.md:7` |
| :5 | 12:29:59.872Z | add-basket · 1 | 585178 | 70 | 75ad9a1b-4714-44c1-a945-063939a55e0c | 12:20:07.445Z … 12:29:51.067Z | 96 (54) | `2026-10-04T12-19-57-add-basket.md:7` |
| :6 | 12:31:27.861Z | add-basket · 2 | 71345 | 9 | e3512a14-3e5b-46a2-9a11-620bf77a38d0 | 12:30:08.750Z … 12:31:18.601Z | 14 (7) | `2026-10-04T12-19-57-add-basket.md:40` |
| :7 | 12:34:25.490Z | add-basket · 1 | 98294 | 17 | 0ddbad8f-f09c-42f1-ba1d-be9bbbe0fb32 | 12:32:39.560Z … 12:34:16.275Z | 29 (14) | `2026-10-04T12-32-30-add-basket.md:7` |
| :8 | 13:17:30.029Z | add-admin · 1 | 536080 | 110 | 30cc6a10-0ffa-4c7a-8868-60d9c2e6d4ab | 13:08:26.022Z … 13:17:20.657Z | 143 (72) | `2026-10-04T13-08-22-add-admin.md:7` |
| :9 | 13:27:29.065Z | add-admin · 1 | 317831 | 63 | b1b8f360-588a-44b4-b9d7-2f849bb6f7a6 | 13:22:03.161Z … 13:27:19.406Z | 89 (52) | `2026-10-04T13-21-52-add-admin.md:7` |

«turns» — поле `num_turns` із JSON-виводу `claude -p`, яке записав `loop.mjs`; «assistant-записів» — кількість рядків
`type:"assistant"` у транскрипті (у дужках — унікальних `message.id`). Це різні лічильники, їх не звіряли.

## 2. Докази

### Д1. Промпт циклу справді прийшов у сесію — шаблон у коді та те, що отримав агент

Де: шаблон `scripts/loop.mjs:73` → `T/63ea697e-2d6e-4a0e-a7df-ab6ea2f3007c.jsonl:4` (type user, ts 2026-10-04T11:26:31.637Z,
sessionId 63ea697e-2d6e-4a0e-a7df-ab6ea2f3007c = loop.jsonl:2, `tasksBefore 25/32`):

```
Current state (computed by scripts/loop.mjs, not from memory):
- tasks: 25/32 done; next open: - [ ] 8.1 `apps/api/src/shops/osio.test.ts` — add the test "Request carries the tenant header": a stub fetch `vi.fn()` that
- pnpm check: GREEN — Tests  29 passed (29) · spec:check ok — specs: 0 · active changes: 2 · archived: 0
```

Червоний варіант — `T/2f12c37d-9271-4824-9abf-9c12fee80816.jsonl:4` (ts 2026-10-04T12:07:00.880Z = loop.jsonl:4, `gateBefore 2`, `tasksBefore 9/21`):

```
- tasks: 9/21 done; next open: - [ ] 2.1 `packages/shared/src/index.ts`: add `BasketIdSchema`, `ProductIdSchema`, `BasketQuantitySchema`,
- pnpm check: RED (exit 2)
- failing lines:
    apps/api typecheck: src/config.test.ts(17,25): error TS2339: Property 'dataDir' does not exist on type 'AppConfig'.
```

Що це показує: числа у промпті (25/32 і 29 passed; 9/21 і exit 2) дорівнюють `tasksBefore`/`gateBefore` відповідних рядків loop.jsonl — промпт згенерував гейт, а не людина, і агент його справді отримав.

### Д2. Агент закінчує так, як вимагає промпт: запускає `check-verdict.mjs` і цитує його рядки

Де: правило `scripts/loop.mjs:79-80` («Finish by running … check-verdict.mjs» на :79, «and quoting its summary lines» на :80) → tool_use Bash
`T/63ea697e-2d6e-4a0e-a7df-ab6ea2f3007c.jsonl:273` (ts 2026-10-04T11:30:22.090Z) і фінальне повідомлення `:277` (ts 2026-10-04T11:30:39.201Z):

````
node scripts/check-verdict.mjs 2>&1 | grep -E "Tests |spec:check ok|Test Files|GREEN|RED|verdict" | head
````
````
All 32 tasks in `add-catalog/tasks.md` are `[x]`; `node scripts/check-verdict.mjs` is GREEN:

```
 Test Files  12 passed (12)
      Tests  40 passed (40)
spec:check ok — specs: 0 · active changes: 2 · archived: 0
all hook checks passed
```
````

Той самий прогін у журналі циклу, `docs/loops/2026-10-04T11-26-22-add-catalog.md:7`:

```
| 1 | GREEN · Tests  29 passed (29) · spec:check ok — specs: 0 · active changes: 2 · archived: 0 | 25/32 | 59 | 18895 | 2.35 | 250 s | GREEN · Tests  40 passed (40) · spec:check ok — specs: 0 · active changes: 2 · archived: 0 · tasks 32/32 |
```

Що це показує: «29 → 40 passed, 25/32 → 32/32» збігаються у транскрипті, у `loop.jsonl:2` і в md — три джерела одного прогону; усі 9 сесій викликали `node scripts/check-verdict.mjs` від 2 до 5 разів (§3, крок 5). Правило `loop.mjs:71` «quote the red run before you make it green» теж видно у фіналах: `T/b1b8f360-…:327` «**Red run first** (4 failing, exactly the new scenario tests):», `T/75ad9a1b-…:353`, `T/f5f6a0cf-…:197`.

### Д3. Самозупинка за правилом промпту (loop.jsonl:6, прогін 2026-10-04T12-19-57-add-basket, iteration 2)

Де: правило `scripts/loop.mjs:78-79` → `T/e3512a14-3e5b-46a2-9a11-620bf77a38d0.jsonl:65` (ts 2026-10-04T12:31:18.601Z,
sessionId e3512a14-3e5b-46a2-9a11-620bf77a38d0). У сесії лише 4 Read, 2 Grep, 2 Bash (обидва `check-verdict.mjs`) — жодного Edit/Write.

```
**Stopped — the spec is self-contradictory and I will not edit it to make a test pass.**

Tasks 8.1 and 8.3 each have exactly one item left, and both are the same item: `encodeURIComponent(productId)` in `apps/web/src/api/client.ts` plus its scenario test.
…
| Scenario "Product id is URL-encoded in the path", line 159 | `updateBasketItem("osio:a#b", 2)` → path `/api/basket/items/osio%3Aa%23b` — `:` encoded as `%3A` |
| Scenario "Mutations send method, path and JSON body", lines 146 & 150 | `fetch` called with `"/api/basket/items/karashynyard:1498486363994"` — `:` literal |
…
GREEN. 24/26 tasks `[x]`; the two open ones already carry this blocker in their own text, so I added no new notes and changed no files this run.
```

Журнал циклу, `docs/loops/2026-10-04T12-19-57-add-basket.md:40`, `:83`, `:85` (детектор «stuck» — `scripts/loop.mjs:129-130`):

```
| 2 | GREEN · Tests  102 passed (102) · spec:check ok — specs: 3 · active changes: 2 · archived: 1 | 24/26 | 9 | 3641 | 0.47 | 71 s | GREEN · Tests  102 passed (102) · spec:check ok — specs: 3 · active changes: 2 · archived: 1 · tasks 24/26 |
| 3 | GREEN · Tests  102 passed (102) · spec:check ok — specs: 3 · active changes: 2 · archived: 1 | 24/26 | — | — | — | — | stopped: identical gate output twice |
**Result:** loop add-basket: 2 agent iteration(s), stopped on "stuck", final pnpm check exit 0 (Tests  102 passed (102) · spec:check ok — specs: 3 · active changes: 2 · archived: 1), tasks 24/26, spent $5.87
```

Що це показує: правило промпту змінило поведінку — замість підганяти код чи спеку агент за 9 ходів і $0.47 (`loop.jsonl:6`) не змінив жодного файлу і сформулював рішення для людини; цикл сам зупинився на третій ітерації.

### Д4. Людина вирішила комітом — наступний прогін прочитав рішення з диска і дійшов до зеленого

Де: коміт `183127e` (2026-10-04 15:32:30 +0300 = 12:32:30Z — між кінцем сесії e3512a14 12:31:18Z і початком 0ddbad8f 12:32:39Z) →
`T/0ddbad8f-f09c-42f1-ba1d-be9bbbe0fb32.jsonl:45` (ts 2026-10-04T12:32:51.406Z) і `:110` (ts 2026-10-04T12:34:16.275Z).

```
docs(openspec): add-basket — the loop stopped on a self-contradictory spec; owner decided
…
-The `productId` in a path SHALL be `encodeURIComponent`-encoded.
+The `productId` in a path SHALL be percent-encoded with `encodeURIComponent` except the `:` between shop key and
```
```
The spec conflict is resolved — the human decided `:` stays literal and the spec now expects `/api/basket/items/osio:a%23b`. Let me look at the client and its test.
```
```
All 26 tasks in `add-basket/tasks.md` are `[x]` and the check is GREEN.

**What was left and is now done** — the only open items (8.1, 8.3) were blocked on a self-contradictory spec. The human resolved it on 2026-10-04: `:` stays literal in paths, and `specs/basket-web/spec.md` now pins `/api/basket/items/osio:a%23b` plus a requirement sentence saying the `:` is exempt from encoding. No spec was edited by me.
…
     Tests  103 passed (103)
```

Що це показує: ланцюжок «цикл зупинився → людина закомітила рішення → свіжа сесія циклу прочитала spec.md (Read у `:36`) і закрила 8.1/8.3» видно за timestamp-ами трьох джерел; `docs/loops/2026-10-04T12-32-30-add-basket.md:7` фіксує 24/26 → 26/26, 102 → 103 passed за 17 ходів і $0.84.

### Д5. Allow-list циклу блокує Bash — агент переходить на Edit

Де: `scripts/loop.mjs:82-90` (`allowed`, `--allowedTools`, `--permission-mode acceptEdits`) → `T/30cc6a10-0ffa-4c7a-8868-60d9c2e6d4ab.jsonl:407` (tool_result, ts 2026-10-04T13:15:16.497Z), `:413` (ts 13:15:17.874Z), `:414` (tool_use Edit, ts 13:15:19.702Z); sessionId 30cc6a10-… = loop.jsonl:8.

```
This Bash command contains multiple operations. The following part requires approval: perl -pi -e 's/^- \[ \] ([23456]\.\d)/- [x] $1/' openspec/changes/add-admin/tasks.md
```
```
I'll tick them with the edit tool instead.
```

Та сама пара «perl заблоковано → Edit» є в `T/e5097db2-…:232 → :236` (Edit `replace_all`) і `T/2f12c37d-…:98 → :101`; `README.md:79` рахує 22 такі блоки за всі `-p`-сесії (його джерело — `.agent-log/actions.jsonl`, не транскрипти).

Що це показує: `claude -p` справді запускався з allow-list циклу (`perl`/`sed` у ньому немає), і блок змінив наступну дію агента, а не лише «існував у коді».

## 3. Як відтворити

```bash
R=/Users/elikafilin/Documents/home_projects/organic-shop-orchestrator/submissions/elika-filin
T=/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator-submissions-elika-filin
# 1) зіставити 9 рядків loop.jsonl із сесіями за вікном [ts − agentMs − 60 s, ts] — має бути рівно один файл на рядок
node -e '
const fs=require("fs"),p=require("path"),[T,R]=process.argv.slice(1);
const first=f=>{for(const l of fs.readFileSync(p.join(T,f),"utf8").split("\n")){try{const o=JSON.parse(l);if(o.timestamp)return o.timestamp}catch{}}};
const S=fs.readdirSync(T).filter(f=>f.endsWith(".jsonl")).map(f=>({f,t:Date.parse(first(f))}));
for(const l of fs.readFileSync(R+"/.agent-log/loop.jsonl","utf8").trim().split("\n")){const r=JSON.parse(l),e=Date.parse(r.ts),s=e-r.agentMs-6e4;
console.log(r.ts,r.change,r.iteration,"->",S.filter(x=>x.t>=s&&x.t<=e).map(x=>x.f).join(",")||"NONE")}' "$T" "$R"
# 2) промпт циклу — у 9 транскриптах, і тільки в них
grep -l "Current state (computed by scripts/loop.mjs" "$T"/*.jsonl | wc -l
# 3) самозупинка: транскрипт, журнал циклу, коміт-рішення
grep -c "Stopped — the spec is self-contradictory" "$T"/e3512a14-*.jsonl "$R"/docs/loops/2026-10-04T12-19-57-add-basket.md
git -C "$R" show --stat 183127e
# 4) блок allow-list і наступна дія агента
grep -n -o "requires approval: perl[^\"]*\|tick them with the edit tool instead" "$T"/30cc6a10-*.jsonl
# 5) у кожній із 9 сесій є tool_use `node scripts/check-verdict.mjs`
for f in e5097db2 63ea697e f5f6a0cf 2f12c37d 75ad9a1b e3512a14 0ddbad8f 30cc6a10 b1b8f360; do printf "%s " $f; grep -c '"command":"node scripts/check-verdict.mjs' "$T"/$f-*.jsonl; done
```

## 4. Чесно: чого НЕ знайшли / що лише існує

- **Session id не збережено.** Зіставлення — за часовим вікном, а не за ключем. Вікна не перетинаються, і рецензентські сесії
  (`32e5f4b5…` 11:21:08Z, `30641f9b…` 12:14:46Z, `a45135a6…` 13:18:07Z) у них не потрапили, але це доказ за збігом часу.
- **Перший промпт мав баг.** `T/e5097db2-d85f-44f2-b6ae-c2a1736a26c9.jsonl:4` містить `` - tasks: 10/10- [ ] 2.1 `packages/shared/src/index.ts`: `ShopKeySchema`, `SHOPS` metadata (names and URLs of both shops),,- [ ] 3.1 ``:
  `total: done + open` конкатенувала масив; виправлено у коміті `d91e931` (`scripts/loop.mjs:52` тепер `total: done + open.length`), `README.md:100` це визнає.
  Агент усе одно дійшов до 25/25 — промпт був потворний, але гейт і правила працювали.
- **Умови зупинки `budget` і `max-iter` не спрацювали жодного разу** — 7 із 8 прогонів зупинились на «green» після першої ітерації; один (2 ітерації) — на `stuck`.
  Опцій `--model`/`--dry-run` у рядках `Command:` усіх `docs/loops/*.md` немає — не використовували.
- **Ліміт «Stop after at most 25 tool calls»** із промпту ніде не спрацював: жоден фінал не містить такого повідомлення.
- **Smoke наживо цикл не робить** і сам це каже: `T/2f12c37d-9271-4824-9abf-9c12fee80816.jsonl:433` — «Not done, by design: the human smoke run (`pnpm dev`, browser, `curl`) is outside the loop's allow-list.»

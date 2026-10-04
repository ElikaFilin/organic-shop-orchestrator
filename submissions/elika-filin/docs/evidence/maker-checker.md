# maker ≠ checker — докази використання

Практика з README §4: той, хто пише код (maker), і той, хто перевіряє (checker), — різні сесії агента; checker має лише
read-only інструменти, його вердикт зберігається дослівно, а знахідки стають сценаріями й задачами, які maker закриває в
новій сесії. Нижче — не «файл існує», а ланцюжки «рецензент знайшов → специфікація змінилась → maker написав тест → коміт».

Позначення: `<T>` = `submissions/elika-filin/sessions`
(транскрипти `claude -p`-сесій), `<W>` = `/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator/364dc8be-543d-4eb4-afd8-6b19b67b4f42/subagents/workflows`
(журнали workflow). Цитати з JSONL — після JSON-декодування рядка; час — UTC з поля `timestamp`.

## 1. Що доводимо

1. Вісім сесій `scripts/review.mjs` були окремими `claude -p`-сесіями без жодного Edit/Write (A).
2. Знахідки рецензентів змінили специфікації та код — чотири ланцюжки finding → scenario → test → commit (B).
3. На етапах propose / red / archive працювали критики workflow (`critic:testability`, `critic:scope`, `check-red`, `verify-archive`), і їхні вердикти теж змінювали артефакти (C).

## 2. Докази

### 2.1 Вісім read-only сесій рецензентів (A)

Перше user-повідомлення кожної сесії — тіло `.claude/agents/<agent>.md`; остання assistant-репліка — вердикт. Лічильник —
`tool_use` за іменем інструмента. Edit/Write = 0 у всіх восьми (261 виклик разом).

| session (`<T>/<id>.jsonl`) | агент · зміна | перший → останній хід | tool_use | вердикт (рядок транскрипта) |
|---|---|---|---|---|
| `32e5f4b5-88b9-4181-8987-afb26479051c` | spec-reviewer · add-catalog r1 | 11:21:09Z → 11:24:26Z | Read 33 · Grep 8 · Bash 5 · Glob 1 | L179 `READY TO ARCHIVE — all 25 tasks verified against the code …` |
| `b5bac4ac-8066-4d9d-83a2-32a603047a5a` | code-reviewer · add-catalog r1 | 11:21:09Z → 11:23:32Z | Read 16 · Bash 9 · Grep 1 | L120 `` `FIX FIRST` `` |
| `0c015172-a547-47d0-9b3e-36219f0a5e77` | spec-reviewer · add-catalog r2 | 11:32:31Z → 11:35:32Z | Read 34 · Grep 5 · Bash 4 · Glob 1 | L163 `READY TO ARCHIVE — 32/32 tasks `[x]` …` |
| `ec908007-995f-4d68-8b0b-5d1665b7cff4` | code-reviewer · add-catalog r2 | 11:31:50Z → 11:36:07Z | Bash 12 · Read 11 | L114 `` `FIX FIRST` — the code is sound and the gate is green … `` |
| `f25ab181-0f03-40d0-96b8-11ca306b24ae` | spec-reviewer · add-basket | 12:14:48Z → 12:18:24Z | Read 27 · Grep 6 · Bash 5 · Glob 1 | L171 `READY TO ARCHIVE — all 32 scenarios have a test …` |
| `30641f9b-1f3e-48ca-b277-59d2a4a57044` | code-reviewer · add-basket | 12:14:48Z → 12:17:46Z | Bash 9 · Read 7 · Grep 2 | L96 `FIX FIRST` |
| `a45135a6-857e-406f-9c8c-f18d7b7a8df5` | spec-reviewer · add-admin | 13:18:08Z → 13:21:44Z | Read 31 · Bash 13 · Grep 1 | L218 `READY TO ARCHIVE — 26/26 tasks `[x]` …` |
| `eb57aad1-e10d-4089-8714-3212c42216fd` | code-reviewer · add-admin | 13:18:08Z → 13:20:31Z | Read 13 · Bash 6 | L104 `` `FIX FIRST` `` |

`<T>/0c015172-a547-47d0-9b3e-36219f0a5e77.jsonl`, L4 (type `user`, 2026-10-04T11:32:31.308Z):

```
You review an OpenSpec change that someone else implemented. You are the checker, not the maker: you never
edit files, never write patches, never propose code. You report what does not match.
```

Для порівняння maker-сесії того ж дня (`You are inside the OpenSpec change …`): `2f12c37d…` — 54 Edit/Write із 99 викликів, `30cc6a10…` — 57 із 109. Що це показує: ролі розведені фактично — у рецензентів нуль правок, у makers половина викликів.

### 2.2 Allow-list зупинив рецензента, і той змінив дію

`<T>/30641f9b-1f3e-48ca-b277-59d2a4a57044.jsonl`, L76 (`tool_result`, 2026-10-04T12:16:06.886Z) і наступний хід L80 (`tool_use`, 12:16:09.878Z):

```
This Bash command contains multiple operations. The following part requires approval: node -e "const d=require('./data/shops/osio.json');console.log(d.products.slice(0,3).map(p=>[p.sourceId,p.price]));…
```
```
Read {"file_path":"/Users/elikafilin/Documents/home_projects/organic-shop-orchestrator/submissions/elika-filin/apps/web/src/components/ProductCard.tsx","limit":12}
```

Так само `<T>/b5bac4ac…jsonl` L116 (`node -e` → `requires approval`) і `<T>/ec908007…jsonl` L72 (`find with '-exec' executes commands or modifies files — cannot be auto-allowed by a Bash(find:*) prefix rule`), L99 (`This command requires approval`).
Що це показує: рецензент працював у тому самому permission-режимі, що й maker, і після відмови перейшов на дозволений `Read`, а не обійшов правило.

### 2.3 add-catalog: «500 на нечитабельному знімку» → сценарій → тест → коміт (B)

`docs/reviews/2026-10-04-add-catalog-code-reviewer-round1.md`, L7 (той самий текст у `<T>/b5bac4ac…jsonl` L120, 11:23:32Z):

```
- `apps/api/src/lib/catalog.ts:76` — the snapshot fallback is an unguarded `await snapshots.read(...)`, so an I/O or validation failure rejects `load()` and Hono answers 500, contradicting catalog-api spec "GET /api/products SHALL answer 200 in both cases — never 500 because a shop is down" …
```

→ `openspec/changes/archive/2026-10-04-add-catalog/tasks.md` L143 `## 9. Review findings (maker ≠ checker — docs/reviews/2026-10-04-add-catalog-*.md)`,
L145 `Accepted from the code reviewer: unguarded snapshot read can 500 (spec contradiction), memoized rejected snapshot`
→ `openspec/changes/archive/2026-10-04-add-catalog/specs/catalog-api/spec.md` L83 `#### Scenario: Shop down and its snapshot unreadable`, L88 `… status: "unavailable", error: "karashynyard: HTTP 503", count: 0 }`
→ коміт `bae6571 2026-10-04 14:26:22 +0300 docs(openspec): add-catalog — spec changed where reality disagreed` (`git log -S'## 9. Review findings'` знаходить саме його)
→ maker у новій сесії `<T>/63ea697e-2d6e-4a0e-a7df-ab6ea2f3007c.jsonl` L161 (`Edit`, 2026-10-04T11:28:12.357Z, `apps/api/src/routes/products.test.ts`):

```
test("Shop down and its snapshot unreadable", async () => {
```

Запис циклу `docs/loops/2026-10-04T11-26-22-add-catalog.md` L23: `**Group 9 — review findings.** Red run with the five new/updated tests (5 failed | 30 passed):`.
Що це показує: 4 хв 40 с між вердиктом рецензента (11:23:32Z) і тестом, названим його сценарієм (11:28:12Z), через окремий коміт специфікації.

### 2.4 add-basket: float-шум → SHALL-речення змінено («never rounded» → «rounded to 2 decimal places»); гонка → сценарій

`docs/reviews/2026-10-04-add-basket-code-reviewer.md`, L15 і L10:

```
- `apps/web/src/components/BasketLine.tsx:53` / `apps/api/src/lib/basket.ts:44` — `price * quantity` is raw float arithmetic and `formatPrice` does not round (correct per the no-rounding rule), so a non-integer price renders a binary artefact. Failing input: `price: 19.99`, quantity 3 → `Разом: 59.97000000000001 ₴` …
- `apps/api/src/lib/basket.ts:80` — `updateItem`/`removeItem` check with `store.get` and mutate with `store.update` as two separately queued operations, so the 404 contract is not held. Failing input: `DELETE /api/basket` concurrent with `PATCH /api/basket/items/karashynyard:1498486363994` …
```

→ коміт `347e42b 2026-10-04 15:19:57 +0300 docs(openspec): add-basket — reviews folded in (task group 8), spec changed on rounding`, diff `specs/basket-api/spec.md`:

```
-lines (UAH number, never rounded). Lines with `product: null` add 0 to both.
+lines (UAH number, rounded to 2 decimal places — kopiykas — so a non-integer price never leaks binary float noise
```

→ `openspec/changes/archive/2026-10-04-add-basket/specs/basket-api/spec.md` L67 `#### Scenario: Non-integer price sums without float noise`, L70 `- **THEN** `totals` equals `{ count: 3, sum: 3.3 }` (raw `1.1 * 3` is `3.3000000000000003`)`;
L129 `#### Scenario: Clear and change the quantity race`, L133 `- **THEN** the DELETE answers 200 with `items: []`, the PATCH answers 404 `{ error: "Basket item not found" }` …`
→ maker `<T>/75ad9a1b-4714-44c1-a945-063939a55e0c.jsonl` L141 (`Edit`, 2026-10-04T12:24:19.325Z, `apps/api/src/routes/basket.test.ts`): `test("Non-integer price sums without float noise", async () => {`;
L145 (12:24:30.215Z): `test("Clear and change the quantity race", async () => {`; зелений прогін — `84fe870 … feat(basket): … — green`.
Що це показує: знахідка checker-а змінила специфікацію (рішення людини — `tasks.md` L191 `totals rounded to kopiykas (spec changed from "never rounded")`), не лише код.

### 2.5 add-admin: зіпсований файл налаштувань → сценарій → тест; одну знахідку людина відхилила

`docs/reviews/2026-10-04-add-admin-code-reviewer.md`, L8 і L14:

```
- `apps/api/src/lib/catalog.ts:160` — `load()` awaits `settings.read()`, which throws on a bad settings file, so one corrupt admin file takes the whole storefront down instead of falling back to the snapshot …
- `apps/api/src/routes/admin.ts:40` — the session cookie value is a constant (`admin` signed with the token) with no nonce or expiry inside the signature …
```

→ `openspec/changes/archive/2026-10-04-add-admin/specs/catalog-api/spec.md` L62 `#### Scenario: Corrupt settings file falls back to defaults`, L67 `… the storefront never answers 500 because the admin file is bad`; L84 `#### Scenario: Hidden product still resolves by id` (зі знахідки L9)
→ коміт `4c6189f 2026-10-04 16:21:52 +0300 docs(openspec): add-admin — code review folded in (task group 8)` (`4 files changed, 99 insertions(+), 14 deletions(-)`)
→ maker `<T>/b1b8f360-588a-44b4-b9d7-2f849bb6f7a6.jsonl` L110 (`Edit`, 2026-10-04T13:23:15.265Z, `apps/api/src/routes/products-visibility.test.ts`): `test("Corrupt settings file falls back to defaults", async () => {`; L119 (13:23:26.730Z, `AdminPage.test.tsx`): `test("Save failure clears the earlier success", async () => {`
→ відхилення: `docs/autonomy-log.md` L24: `людина прийняла 6 знахідок (…) і **відхилила** одну: nonce/термін у підписі admin-куки — для локального інструмента з одним адміном досить `Max-Age` + ротації токена`; `tasks.md` L301: `Declined (owner): a nonce/expiry inside the session signature …`.
Що це показує: checker не вирішує обсяг — людина приймає або відхиляє, і відмова теж записана.

### 2.6 Критики workflow на етапі propose: finding → revise → design.md (C)

`<W>/wf_50339c24-2de/journal.jsonl` L6 (`type:"result"`, label `critic:testability`, агент `a6e42d6659f556ae1`; його транскрипт `agent-a6e42d6659f556ae1.jsonl` 10:35:57Z → 10:44:54Z, tools: Bash 16 · StructuredOutput 1), `"verdict":"revise"`, 12 findings, перший:

```
D2 prescribes the unit regex `/\d+(?:[.,]\d+)?(?:\s*(?:кг|г|шт|мл|л))?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(?:кг|г|шт|мл|л)\b/u`. In JavaScript `\b` is ASCII-only (Cyrillic letters are not `\w`), so after a Cyrillic unit word followed by end-of-string or a space there is no word boundary. Verified in Node: the regex matches NONE of the 10 snapshot names …
```

L7 (label `critic:scope`, агент `a435211eea934f4fe`, 10:35:59Z → 10:45:12Z, Bash 26), `"verdict":"revise"`, 10 findings, другий:

```
Task 7.1 is a `- [ ]` checkbox that requires `pnpm dev` (a foreground watcher) and `curl`, neither of which is in the loop's allow-list … so the agent can never honestly close 7.1 …
```

→ L9 (label `revise`, `assumptions[0]`): `Findings 1 and 6 are the same finding (D2 unit regex); applied once. Verified in Node before editing: the old `\b` regex matches none of the 10 names in data/shops/karashynyard.json, the new `(?![\p{L}\p{N}])` version returns exactly the snapshot `unit` for all 10 …`
→ `openspec/changes/archive/2026-10-04-add-catalog/design.md` L70 `` `\b`**: in JavaScript `\b` is ASCII-only even with the `u` flag, so there is never a word boundary after a ``; задача 7.1 перестала бути чекбоксом — `tasks.md` L184 `### Human smoke run (outside the loop, after 7.2)`, L186 `Not a checkbox: `pnpm dev` is a foreground watcher and `curl` is not on the loop's allow-list`.

Ще два propose: `<W>/wf_cbada62d-5be/journal.jsonl` L6/L7 (add-basket, обидва `revise`, 10 + 6 findings; L6 перший: `Scenario "Two lines with totals": … a test written from the scenario (`within(item).getByText("195 ₴")`) throws "multiple elements found" against a correct implementation …`; L9 `revise`: `Finding 1 applied as proposed: basket-web 'Two lines with totals' now says the second item shows the text "195 ₴" exactly twice …`);
`<W>/wf_eed820d4-61a/journal.jsonl` L6/L7 (add-admin, `revise`, 6 + 5; L6 перший: `Five normative SHALL behaviours have no scenario, so under the project's one-test-per-scenario rule they would be implemented untested …`; L9: `Finding 1 applied with the critique's first option (add scenarios), not the deletion option …`).

### 2.7 check-red і verify-archive

`<W>/wf_1e32404a-7c6/journal.jsonl` L5 (label `check-red`, агент `a8a5c24867e7ef1a3`, 11:52:37Z → 11:59:44Z, tools: Bash 39 · StructuredOutput 1), `"verdict":"approve"`, 3 minor; перший finding і його `fix`:

```
Task 1.9 is ticked but its evidence is not on disk: .agent-log/actions.jsonl ends at 2026-10-04T11:40Z (14:40 EEST) with the add-catalog loop, holds no Write/Edit of the seven add-basket test files … My own `pnpm test` reproduces the red state …
Before group 2 starts, paste the red summary into the transcript or the change notes: `Test Files 7 failed | 9 passed (16)`, `Tests 12 failed | 47 passed (59)` …
```

→ коміт `b5ebfd7 2026-10-04 15:06:56 +0300 test(basket): scenario tests first — red`, тіло: `Red run:` / `Test Files  7 failed | 9 passed (16)` / `Tests  16 failed | 47 passed (63)` … `Independent checker: 32/32 covered, failing for the right reason.` (різницю 12→16 пояснює `fix-red`, L7 `redRunSummary`: `the four new web tests are the +4`).
`<W>/wf_548ac787-9ce/journal.jsonl` L5 (add-catalog, `approve`, 2 minor: popup-блоки фікстури `carry only field="li_price__<lid>"`); `<W>/wf_3dd9141d-f38/journal.jsonl` L5 (add-admin, `approve`, 3 minor: `Task 1.6's verify clause … says routes/admin.test.ts "imports `./admin` …". The test does not import `./admin` at all`).
verify-archive: `<W>/wf_d86bbf00-154` L5, `<W>/wf_87b3ded2-557` L5, `<W>/wf_5e01c000-ed2` L5 — усі `{"ok":true,"problems":[]}`; агенти — Bash/Read + StructuredOutput, без Edit/Write.

## 3. Як відтворити

```bash
T=submissions/elika-filin/sessions
# (A) сесії, чиє перше user-повідомлення починається з "You review": лічильник tool_use + рядок вердикту
node -e 'const fs=require("fs");for(const f of fs.readdirSync(process.argv[1]).filter(f=>f.endsWith(".jsonl"))){const L=fs.readFileSync(process.argv[1]+"/"+f,"utf8").split("\n");let first,ts,t={},last;for(const l of L){let o;try{o=JSON.parse(l)}catch{continue}const c=o.message?.content;if(!first&&o.type==="user"){first=typeof c==="string"?c:(c||[]).map(x=>x.text||"").join("");ts=o.timestamp}if(o.type==="assistant"&&Array.isArray(c))for(const x of c){if(x.type==="tool_use")t[x.name]=(t[x.name]||0)+1;if(x.type==="text"&&x.text.trim())last=x.text}}if(/^You review/.test((first||"").trim()))console.log(f,ts,JSON.stringify(t),(last||"").split("\n").filter(l=>/READY|FIX FIRST/.test(l)).join(" | "))}' "$T"
sed -n '76p;80p' "$T/30641f9b-1f3e-48ca-b277-59d2a4a57044.jsonl" | cut -c1-400     # відмова allow-list і наступний Read
# (B) знахідки → сценарії → коміти
cd /Users/elikafilin/Documents/home_projects/organic-shop-orchestrator/submissions/elika-filin
grep -n "Review findings\|Review round 2" openspec/changes/archive/*/tasks.md
grep -rn "Shop down and its snapshot unreadable\|Non-integer price sums without float noise\|Clear and change the quantity race\|Corrupt settings file falls back to defaults" openspec/changes/archive/*/specs apps/api/src apps/web/src
(cd ../.. && git log --format='%h %ad %s' --date=iso -S'## 9. Review findings' -- submissions/elika-filin/openspec && git show 347e42b -- submissions/elika-filin/openspec/changes/add-basket/specs/basket-api/spec.md | grep -n "rounded")
W=/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator/364dc8be-543d-4eb4-afd8-6b19b67b4f42/subagents/workflows
node -e 'const fs=require("fs");for(const w of fs.readdirSync(process.argv[1]).filter(d=>d.startsWith("wf_"))){const p=process.argv[1]+"/"+w+"/journal.jsonl";if(!fs.existsSync(p))continue;const lab={};fs.readFileSync(p,"utf8").split("\n").forEach((l,i)=>{let o;try{o=JSON.parse(l)}catch{return}if(o.type==="started")lab[o.agentId]=o.label;if(o.type==="result"&&/critic:|check-red|verify-archive/.test(lab[o.agentId]||"")){let r=o.result;try{r=JSON.parse(r)}catch{}console.log(w,"L"+(i+1),lab[o.agentId],JSON.stringify(r.verdict??r.ok),(r.findings||[]).length,JSON.stringify((r.findings||[])[0]?.issue||"").slice(0,160))}})}' "$W"
```

## 4. Чесно: чого НЕ знайшли / що лише існує

- **Жоден рецензент не намагався викликати Edit/Write** — тож немає доказу, що `--disallowedTools Edit,Write,NotebookEdit` із
  `scripts/review.mjs` хоч раз спрацював. Read-only доведено відсутністю правок (0 із 261 викликів) і відмовами на `node -e` / `find -exec`.
- Рецензенти запускали Bash поза списком з агент-файлу (`ls -R`, `find`, `wc`, `grep -rn`, `cat -n`, `sed -n`) — ці команди пройшли, хоча в `.claude/settings.json` (L7–L29) їх немає;
  відмова в `ec908007` L72 згадує правило `Bash(find:*)`, якого там теж немає. Межа «read-only» тримається на поведінці інструментів, а не на рядку `tools:` у `.claude/agents/*.md`.
- `docs/reviews/2026-10-04-add-catalog-code-reviewer-round1.md` — не оригінальний вивід скрипта: L1 каже `restored from the session task output; round 2 overwrote the file`. Дослівне джерело — транскрипт `<T>/b5bac4ac…jsonl` L120 (текст збігається).
- Maker бачить знахідки (так задумано — через `tasks.md` group 8/9), а раз і сам файл рецензії: `<T>/b1b8f360…jsonl` L38 читає
  `docs/reviews/2026-10-04-add-admin-code-reviewer.md`. Промпт рецензента (`.claude/agents/*.md`) не читала жодна з 9 maker-сесій.
- Рецензент помилявся в деталях: приклад `19.99 × 3 → 59.97000000000001` хибний — maker спершу написав тест із `price: 19.99`
  (`<T>/75ad9a1b…jsonl` L141), а сценарій перейшов на `1.1 × 3` (`tasks.md` L188–L189). Ланцюжок дав сценарій, але не той, що пропонував checker.
- `check-red` усі три рази сказав `approve` з minor-знахідками — немає випадку, коли він зупинив би червоний коміт; `verify-archive` тричі повернув
  `{"ok":true,"problems":[]}` — перевірка існування/проходження, не зміна поведінки. Журнали workflow не мають часових міток — час узято з `agent-<id>.jsonl`.
- Spec-reviewer у всіх 4 прогонах дав `READY TO ARCHIVE`; з наслідками лише дві його знахідки: `osio.ts:70` silent drop
  (`…-add-catalog-spec-reviewer-round1.md` L8 → сценарій `Malformed item is skipped`, `tasks.md` L146–L147) і порожній `DATA_DIR`
  (`…-add-basket-spec-reviewer.md` L8 → `tasks.md` L200 `config.test.ts `DATA_DIR: ""` throws (spec-reviewer finding)`). Решта впливу — від code-reviewer.

# Hooks як примус — докази, що вони спрацювали на агенті (а не лише лежать у репо)

Практика з README §4 (рядок 78): `protect-env.mjs` (exit 2), `stop-gate.mjs` (Stop hook), `log-filter.mjs`, allow/deny-список у
`.claude/settings.json`. Нижче — лише те, на що можна клікнути: транскрипти Claude Code, журнал дій і файли репозиторію.
`T` = `/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator-submissions-elika-filin`
(22 транскрипти: 18 робочих сесій `claude -p` із `scripts/loop.mjs`/`review.mjs`, 11:13–13:27 UTC, і 4 навмисні демо-сесії
14:23–14:24 UTC — про них докладно в `docs/evidence/hooks-demo.md`). Усі цитати verbatim, довгі обрізано «…».

## 1. Що доводимо

Hook або правило дозволів **перехопили живий виклик інструмента**, і **наступна дія агента змінилася** через це: блок → інший
інструмент/команда, або блок → саме та команда, яку назвав hook. Для кожного механізму шукаємо трійку «спроба → блок → реакція».

## 2. Докази

### 2.1 Stop hook `stop-gate.mjs`: «DONE» відхилено, агент запустив `check-verdict` і лише тоді зупинився

Де: `T/e9adb367-b16d-4fcc-9232-76cd460c2928.jsonl` (session `e9adb367-b16d-4fcc-9232-76cd460c2928`), рядки 36, 37, 43, 49.
```
L36 assistant 2026-10-04T14:24:03.899Z  DONE\n\nNo hook message arrived, so there is nothing to quote.
L37 user      2026-10-04T14:24:03.951Z  Stop hook feedback:\n[node ${CLAUDE_PROJECT_DIR}/.claude/hooks/stop-gate.mjs]: Blocked by hook (stop-gate): source files were edited after the last green pnpm check. Run `node scripts/check-verdict.mjs` and quote its summary lines before finishing.
L43 assistant 2026-10-04T14:24:10.015Z  [tool_use Bash] {"command":"node scripts/check-verdict.mjs","description":"Run pnpm check and record verdict","timeout":600000}
L49 assistant 2026-10-04T14:24:22.074Z  Green: `Tests  182 passed (182)` · `spec:check ok — specs: 8 · active changes: 0 · archived: 3` (exit 0).\n\nHook message, verbatim:\n\n> [node ${CLAUDE_PROJECT_DIR}/.claude/hooks/stop-gate.mjs]: Blocked by hook (stop-gate): … DONE
```
Той самий ланцюжок у `.agent-log/actions.jsonl`, рядки 1556 (правка) → 1560 → 1561:
```
{"ts":"2026-10-04T14:24:02.711Z","event":"PreToolUse","id":"toolu_01AwAsj5JghShma7ztZWAZeQ","session":"e9adb367","mode":"acceptEdits","tool":"Edit","path":"apps/api/src/lib/cache.ts"}
{"ts":"2026-10-04T14:24:10.068Z","event":"PreToolUse","id":"toolu_01H1n4BA8VJwQ37JCDinYQpg","session":"e9adb367","mode":"acceptEdits","tool":"Bash","cmd":"node scripts/check-verdict.mjs"}
{"ts":"2026-10-04T14:24:19.795Z","event":"PostToolUse","id":"toolu_01H1n4BA8VJwQ37JCDinYQpg","session":"e9adb367","mode":"acceptEdits","tool":"Bash","cmd":"node scripts/check-verdict.mjs","exit":0,"ms":9687}
```
Що це показує: правка о 14:24:02 → «DONE» о 14:24:03 → exit 2 з причиною → о 14:24:10 агент виконує рівно те, що вимагав
hook → `.agent-log/last-check.json` отримує `"ts": "2026-10-04T14:24:19.750Z"` → другий Stop пропущено. Цикл замкнувся без людини.

### 2.2 `protect-env.mjs` (exit 2) зупинив Edit із `process.env` поза `apps/api/src/config.ts`

Де: `T/1c9f6191-1d96-4898-a286-da894882ab49.jsonl` (session `1c9f6191-1d96-4898-a286-da894882ab49`), рядки 31, 32, 35.
```
L31 assistant 2026-10-04T14:23:49.821Z  [tool_use Edit] "file_path":"…/apps/api/src/routes/products.ts", "new_string":"import type { CatalogService } from \"../lib/catalog\";\n\nconst region = process.env.DEPLOY_REGION;\n"
L32 user      2026-10-04T14:23:49.870Z  [tool_result is_error=true] PreToolUse:Edit hook error: [node ${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-env.mjs]: Blocked by hook: process.env is read only in apps/api/src/config.ts — pass configuration into /Users/elikafilin/Documents/home_projects/organic-shop-orchestrator/submissions/elika-filin/apps/api/src/routes/products.ts as a value.
L35 assistant 2026-10-04T14:23:52.386Z  Blocked. Exact hook message: … `apps/api/src/routes/products.ts` is unchanged. Stopping as instructed — not relocating the line.
```
Що це показує: текст блоку — stderr з `.claude/hooks/protect-env.mjs` рядок 37; файл не змінився. У `.agent-log/actions.jsonl`
рядок 1553 `{"ts":"2026-10-04T14:23:49.867Z","event":"PreToolUse","id":"toolu_01EPrs7HoLwYyNfWWT4PyuKK","session":"1c9f6191",…,"tool":"Edit","path":"apps/api/src/routes/products.ts"}`
не має парного `PostToolUse` — у `pnpm agent:log` це єдиний `Edit … blocked 1` (`proposed 209 · executed 208`).

### 2.3 `log-filter.mjs` підмінив `cat .agent-log/actions.jsonl` на зведення — сирий журнал не потрапив у вікно

Де: `T/ecd3fd9a-5402-45cd-97f7-981ad6103d69.jsonl` (session `ecd3fd9a-5402-45cd-97f7-981ad6103d69`), рядки 24, 28, 36.
```
L24 assistant  2026-10-04T14:24:38.679Z  [tool_use Bash] {"command":"cat .agent-log/actions.jsonl","description":"Read agent action log file"}
L28 attachment 2026-10-04T14:24:38.729Z  hook_system_message PreToolUse:Bash: Rewritten by hook (log-filter): the raw .agent-log/actions.jsonl never enters the context window — running "node scripts/agent-log-summary.mjs" instead.
L36 assistant  2026-10-04T14:24:50.186Z  The `cat` never ran. What came back is the `pnpm agent:log` summary, not raw JSONL.
```
`.agent-log/actions.jsonl` рядки 1562–1563 — один `id`, різні команди до і після hook:
```
{"ts":"2026-10-04T14:24:38.725Z","event":"PreToolUse","id":"toolu_0155FoDs3SK9N8YBrTMFAe1R","session":"ecd3fd9a","mode":"acceptEdits","tool":"Bash","cmd":"cat .agent-log/actions.jsonl"}
{"ts":"2026-10-04T14:24:39.264Z","event":"PostToolUse","id":"toolu_0155FoDs3SK9N8YBrTMFAe1R","session":"ecd3fd9a","mode":"acceptEdits","tool":"Bash","cmd":"node scripts/agent-log-summary.mjs","exit":0,"ms":497}
```
Що це показує: `updatedInput` з `.claude/hooks/log-filter.mjs` (рядки 83–86) справді виконався замість `cat`; 329 КБ JSONL
у контекст не потрапили, агент отримав таблицю і сам це помітив.

### 2.4 Allow-list у робочій сесії: `perl -pi` по коду відмовлено → той самий рядок правиться через Edit (add-basket)

Де: `T/2f12c37d-9271-4824-9abf-9c12fee80816.jsonl` (session `2f12c37d-9271-4824-9abf-9c12fee80816`), рядки 97, 98, 101.
```
L97  assistant 2026-10-04T12:08:12.603Z  [tool_use Bash] perl -pi -e 's/\(current \?\? EMPTY_BASKET\)\.items/current?.items ?? NO_ITEMS/; s/\(basket \?\? EMPTY_BASKET\)\.items/basket?.items ?? NO_ITEMS/' apps/api/src/lib/basket.ts && grep -n "NO_ITEMS" apps/api/src/lib/basket.ts
L98  user      2026-10-04T12:08:12.665Z  [tool_result is_error=true] This Bash command contains multiple operations. The following part requires approval: perl -pi -e 's/\(current \?\? EMPTY_BASKET\)\.items/current?.items ?? NO_ITEMS/; … apps/api/src/lib/basket.ts
L101 assistant 2026-10-04T12:08:15.043Z  [tool_use Edit] "file_path":"…/apps/api/src/lib/basket.ts","old_string":"        const items = (current ?? EMPTY_BASKET).items;","new_string":"        const items = current?.items ?? NO_ITEMS;"
```
Що це показує: у `-p`-режимі (`scripts/loop.mjs` рядки 82–90, `--allowedTools`) in-place правка через shell не дозволена; за
2.4 с агент переписав ту саму заміну інструментом Edit — який проходить через `protect-env.mjs` і `log-action.mjs`.

### 2.5 Allow-list: «I'll tick them with the edit tool instead.» (add-admin) і `sed -i` → Edit (add-catalog)

Де: `T/30cc6a10-0ffa-4c7a-8868-60d9c2e6d4ab.jsonl` рядки 406, 407, 413; `T/63ea697e-2d6e-4a0e-a7df-ab6ea2f3007c.jsonl` рядки 251, 252, 255.
```
30cc6a10 L406 assistant 2026-10-04T13:15:16.444Z  [tool_use Bash] perl -pi -e 's/^- \[ \] ([23456]\.\d)/- [x] $1/' openspec/changes/add-admin/tasks.md && grep -c "^- \[x\]" openspec/changes/add-admin/tasks.md && …
30cc6a10 L407 user      2026-10-04T13:15:16.497Z  [tool_result is_error=true] This Bash command contains multiple operations. The following part requires approval: perl -pi -e 's/^- \[ \] ([23456]\.\d)/- [x] $1/' openspec/changes/add-admin/tasks.md
30cc6a10 L413 assistant 2026-10-04T13:15:17.874Z  I'll tick them with the edit tool instead.
63ea697e L251 assistant 2026-10-04T11:29:58.050Z  [tool_use Bash] sed -i '' 's/^- \[ \] 9\./- [x] 9./' openspec/changes/add-catalog/tasks.md && grep -c '^- \[x\]' … && grep -c '^- \[ \]' …
63ea697e L252 user      2026-10-04T11:29:58.109Z  [tool_result is_error=true] sed command requires approval (contains potentially dangerous operations)
63ea697e L255 assistant 2026-10-04T11:30:00.705Z  [tool_use Edit] "old_string":"- [ ] 9.1 Scenario tests first","new_string":"- [x] 9.1 Scenario tests first"
```
Що це показує: агент словами фіксує зміну плану через відмову; те саме в усіх трьох змінах (ще `T/e5097db2-…jsonl` рядки
231–236, 11:19:31 → 11:19:35, `perl -0pi` → `Edit replace_all`).

### 2.6 Allow-list змусив викликати `node scripts/check-verdict.mjs` рівно в дозволеній формі

Де: `T/30cc6a10-0ffa-4c7a-8868-60d9c2e6d4ab.jsonl`, рядки 485, 486, 490, 493; `.claude/settings.json` рядок 18 (`"Bash(node scripts/check-verdict.mjs)"`).
```
L485 assistant 2026-10-04T13:16:51.760Z  [tool_use Bash] node scripts/check-verdict.mjs 2>&1 | tail -3 ; echo "---exit:$?"
L486 user      2026-10-04T13:16:51.816Z  [tool_result is_error=true] This Bash command contains multiple operations. The following part requires approval: tail -3 ; echo "---exit:$?"
L490 user      2026-10-04T13:16:55.265Z  [tool_result is_error=true] This Bash command contains multiple operations. The following part requires approval: node scripts/check-verdict.mjs 2>&1; echo "exit=$?"; grep -niE "green|red|verdict" /tmp/verdict.txt
L493 assistant 2026-10-04T13:16:57.897Z  [tool_use Bash] {"command":"node scripts/check-verdict.mjs","description":"Run check verdict script","timeout":300000}
```
Що це показує: дві відмови поспіль → третя спроба збігається з allow-list буквально; саме ця форма пише
`.agent-log/last-check.json`, який читають `stop-gate.mjs` і `dynamic-context.mjs`.

### 2.7 Deny-список `Read(./.env)`: зупиняє `.env` раніше за hook і навіть чужий `grep` після `cd`

Де: `T/0da5fc76-8b8f-4b2c-abb0-71471801cbca.jsonl` рядки 32, 33, 36; `T/b1b8f360-588a-44b4-b9d7-2f849bb6f7a6.jsonl` рядки 77, 78, 81;
`.claude/settings.json` рядки 31–35.
```
0da5fc76 L32 assistant 2026-10-04T14:23:36.346Z  [tool_use Write] {"file_path":"…/submissions/elika-filin/.env","content":"DEMO=1\n"}
0da5fc76 L33 user      2026-10-04T14:23:36.350Z  [tool_result is_error=true] <tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>
0da5fc76 L36 assistant 2026-10-04T14:23:39.441Z  Blocked. Stopping as instructed — no workaround attempted. … this came from the permission layer (deny rule), not from a `PreToolUse` hook emitting a custom message …
b1b8f360 L77 assistant 2026-10-04T13:22:35.130Z  [tool_use Bash] cd /Users/elikafilin/Documents/home_projects/organic-shop-orchestrator/submissions/elika-filin && grep -n "findProducts\|console.error\|corrupt\|Corrupt" openspec/changes/add-admin/design.md … | head -40; wc -l apps/web/src/pages/AdminPage.test.tsx
b1b8f360 L78 user      2026-10-04T13:22:35.189Z  [tool_result is_error=true] grep reads a file by a relative path after a cd in a compound command; which file that is cannot be resolved statically while a Read() deny rule is configured, so this needs approval.
b1b8f360 L81 assistant 2026-10-04T13:22:37.489Z  [tool_use Grep] {"pattern":"findProducts|console\\.error|[Cc]orrupt","path":"…/openspec/changes/add-admin","output_mode":"content"}
```
Що це показує: `.env` так і не створено; deny-правило змінило навіть робочу сесію add-admin — Bash-`grep` замінено на
інструмент Grep, бо harness не зміг статично довести, що відносний шлях не веде до `.env`.

### 2.8 Перехресна перевірка: журнал дій і `pnpm hooks:selftest` у кожній робочій сесії

`node scripts/agent-log-summary.mjs .agent-log/actions.jsonl` (стан на момент написання; числа ростуть із кожною сесією):
```
Agent actions: 770 executed, 23 proposed but not executed, 3 failed — 21 session(s), 2026-10-04T10:18:08.527Z .. 2026-10-04T14:24:39.264Z
│ 1       │ 'Edit'  │ 209      │ 208      │ 1       │ 0      │ 0.5      │ 48    │
│ 2       │ 'Bash'  │ 156      │ 134      │ 22      │ 3      │ 336.5    │ 0     │
Proposed but not executed (blocked by a hook, a rule or you):
  2026-10-04T11:29:58.097Z  Bash  sed -i '' 's/^- \[ \] 9\./- [x] 9./' openspec/changes/add-catalog/tasks.md && …
  2026-10-04T12:08:12.653Z  Bash  perl -pi -e 's/\(current \?\? EMPTY_BASKET\)\.items/current?.items ?? NO_ITEMS/; …
  2026-10-04T13:15:16.489Z  Bash  perl -pi -e 's/^- \[ \] ([23456]\.\d)/- [x] $1/' openspec/changes/add-admin/tasks.md && …
  2026-10-04T13:16:51.808Z  Bash  node scripts/check-verdict.mjs 2>&1 | tail -3 ; echo "---exit:$?"
  2026-10-04T14:23:49.867Z  Edit  apps/api/src/routes/products.ts
```
Кожна позначка часу звідси збігається з парою «tool_use → requires approval» у транскрипті (11:29:58.097 ↔ 2.5, 12:08:12.653 ↔ 2.4,
13:15:16.489 ↔ 2.5, 13:16:51.808 ↔ 2.6, 14:23:49.867 ↔ 2.2) — два незалежні джерела, один факт. А `pnpm check` (всередині кожного
`check-verdict`) щоразу проганяв hooks без агента — `T/63ea697e-2d6e-4a0e-a7df-ab6ea2f3007c.jsonl` рядок 274 (11:30:29.508Z, tool_result) і рядок 277 (11:30:39.201Z):
```
PASS  stop-gate blocks (exit 2) when a source edit has no recorded pnpm check  Blocked by hook (stop-gate): no pnpm check has been recorded. Run `node scripts/check-verdict.mjs` and quote its summary lines before finishing.
All 32 tasks in `add-catalog/tasks.md` are `[x]`; `node scripts/check-verdict.mjs` is GREEN:
```

## 3. Як відтворити

```bash
cd submissions/elika-filin
T=~/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator-submissions-elika-filin
grep -n "Stop hook feedback" $T/*.jsonl                        # 2.1 — живий Stop hook: 1 збіг, e9adb367 рядок 37
grep -n "hook error: \[node" $T/*.jsonl                         # 2.2 — живий protect-env: 1c9f6191 рядки 32 (блок) і 35 (цитата)
grep -n "Rewritten by hook (log-filter)" $T/*.jsonl             # 2.3 — живий log-filter: ecd3fd9a рядки 27–28
pnpm transcripts "requires approval" --context 300              # 2.4–2.6 — відмови allow-list, декодовано, з часом (без `--`!)
pnpm agent:log                                                  # 2.8 — «Proposed but not executed»
node -e 'const L=require("fs").readFileSync(".agent-log/actions.jsonl","utf8").split("\n").filter(Boolean).map(JSON.parse);const post=new Set(L.filter(e=>e.event!=="PreToolUse").map(e=>e.id));console.log(L.filter(e=>e.event==="PreToolUse"&&!post.has(e.id)).map(e=>[e.ts,e.tool,e.cmd||e.path]))'
pnpm hooks:selftest                                             # hooks без агента, частина pnpm check
```

## 4. Чесно: чого НЕ знайшли / що лише існує

- **У 18 робочих сесіях `stop-gate.mjs` жодного разу не блокував живцем.** Усі 24 рядки «Blocked by hook (stop-gate)» у 10 робочих
  транскриптах — це `PASS …` з `pnpm hooks:selftest` у виводі `pnpm check` (tool_result), а не `Stop hook feedback`. Причина: промпт
  циклу (`scripts/loop.mjs` рядки 79–80: «Finish by running `node scripts/check-verdict.mjs` and quoting its summary lines») — агент
  щоразу робив це сам (напр. `T/e5097db2-d85f-44f2-b6ae-c2a1736a26c9.jsonl` рядок 268, 11:20:26.057Z: «Recorded in `.agent-log/last-check.json`:
  `"ok": true, "exit": 0`.»), тож умова воріт уже була виконана. Живе спрацювання є лише в демо-сесії 2.1.
- **`protect-env.mjs` у робочих сесіях теж не спрацьовував** — 7 рядків «Blocked by hook: » у 3 транскриптах це selftest (напр.
  `T/e5097db2-…jsonl` рядок 244: «PASS  protect-env Write lib/auth.ts -> exit 2  Blocked by hook: process.env is read only in
  apps/api/src/config.ts …»). Агент просто не писав `process.env` поза `config.ts`. Живе спрацювання — демо 2.2. Гілка hook-а для
  `.env*` не запускалась ніколи, навіть у демо: deny-правило відпрацьовує раніше за PreToolUse-hooks (2.7), тому в
  `.agent-log/actions.jsonl` немає жодного рядка сесії `0da5fc76` — `log-action.mjs` цього виклику теж не бачив.
- **«Rewritten by hook (log-filter)» у робочих сесіях — 0 збігів**: агент там ні разу не намагався вивести сирий журнал (жодного
  `cat/head/tail .agent-log/actions.jsonl` у 18 транскриптах), тож переписувати не було чого. Доказ 2.3 — демо. Сам systemMessage
  агентові не видно (`ecd3fd9a` рядок 36: «Hook message: none»), він лише в транскрипті як attachment.
- **Відмови «requires approval» — це шар дозволів harness-а** (`permissions.allow` у `settings.json` + `--allowedTools` у `loop.mjs`),
  а не `.mjs`-hook; «Contains simple_expansion» (`T/e5097db2-…jsonl` рядок 53) — той самий шар проти `for f in …; cat`.
- **Чотири демо-сесії — навмисні проби**: промпт прямо просить спробувати заборонене і процитувати блок (`e9adb367` рядок 4). Вони
  доводять, що hooks перехоплюють живий цикл агента, а не те, що агент «сам» на них наривався.
- Лічильники `pnpm agent:log` пливуть: README рядок 79 каже «22 … 764 … 18 сесій», на початку цього аналізу було 764/22/18, на момент
  запису — 770/23/21. Це знімки одного файлу в різний час, не розбіжність. `pnpm transcripts -- "…"` з `hooks-demo.md` і шапки
  `scripts/transcript-grep.mjs` не працює (pnpm передає `--` далі, скрипт приймає маркер за значення прапорця) — викликати без `--`.

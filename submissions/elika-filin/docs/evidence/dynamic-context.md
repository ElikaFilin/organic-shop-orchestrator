# Докази: динамічний контекст (`.claude/hooks/dynamic-context.mjs`)

## 1. Що доводимо

Hook `dynamic-context.mjs` підключений на `SessionStart` і `UserPromptSubmit` і **на кожен запит** рахує з диска те, чого статичні
правила знати не можуть: активні OpenSpec-зміни з прогресом задач, рядок «Починати наступну сесію з» із `docs/session-notes.md` і вердикт
останнього `pnpm check` (`.agent-log/last-check.json`). Нижче — не файл hook-а, а блоки `[dynamic-context hook]`, які реально отримали агенти
(loop-реалізатор, два рев'юери), з номерами рядків у транскриптах `~/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator-submissions-elika-filin/<sessionId>.jsonl`.

Технічна примітка: у транскрипті блок лежить у рядку `{"type":"attachment","attachment":{"type":"hook_success","hookName":"UserPromptSubmit"|"SessionStart:startup",
"command":"node ${CLAUDE_PROJECT_DIR}/.claude/hooks/dynamic-context.mjs","content":"[dynamic-context hook]\n…","stdout":"…"},"rendered":[{"content":"<system-reminder>\n…"}]}`;
цитати нижче — поле `attachment.content` після `JSON.parse` (у сирому файлі `"` і переноси екрановані як `\"` та `\n`). Усі timestamp — UTC.

## 2. Докази

### 2.1 Проводка: один і той самий hook на SessionStart і UserPromptSubmit

Де: `.claude/settings.json`, рядки 41–49 (SessionStart) і 56–64 (UserPromptSubmit); нижче рядки 56, 62–64:

```json
    "UserPromptSubmit": [
…
            "command": "node",
            "args": [
              "${CLAUDE_PROJECT_DIR}/.claude/hooks/dynamic-context.mjs"
```

Що показує: рядки 41–55 — ідентичний блок для `"SessionStart"`. Hook друкує блок у stdout (`.claude/hooks/dynamic-context.mjs:70`:
``if (lines.length) process.stdout.write(`[dynamic-context hook]\n${lines.join("\n")}\n`);``), а Claude Code додає його в контекст.

### 2.2 add-catalog: перша ітерація loop — RED, 10/25, «наступна задача 2.1»

Де: `…/e5097db2-d85f-44f2-b6ae-c2a1736a26c9.jsonl`, рядок 14, `2026-10-04T11:13:21.240Z`, sessionId `e5097db2-…` (loop-run
`docs/loops/2026-10-04T11-13-17-add-catalog.md`, промпт агента в рядку 4: `You are inside the OpenSpec change "add-catalog" (trust level 3 — see AGENTS.md)`).

```text
[dynamic-context hook]
…
OpenSpec change "add-catalog": 10/25 tasks done — trust level 3 inside it. Next: - [ ] 2.1 `packages/shared/src/index.ts`: `ShopKeySchema`, `SHOPS` metadata (names and URLs of both shops),
Session notes say to start with: `docs/intent.md` → `/opsx:propose add-catalog` (адаптери двох магазинів + каталог).
Last pnpm check: RED at 2026-10-04T11:13:19.456Z
```

Що показує: агент стартує з «червоним» вердиктом, записаним gate-ом loop-а за 1.8 с до цього (`scripts/loop.mjs:56` →
`check-verdict.mjs:15-18` пише `.agent-log/last-check.json`), і бачить саме ту задачу, з якої має починати.

### 2.3 add-basket: ПАРА з одного loop-run — 21/26 → 24/26, рядок нотаток і вердикт змінилися між ітераціями

Один прогін `docs/loops/2026-10-04T12-19-57-add-basket.md` (`.agent-log/loop.jsonl:5-6` — `"iteration":1,…"tasksBefore":"21/26","tasksAfter":"24/26"` і
`"iteration":2,…"tasksBefore":"24/26"`). Ітерація 1 — сесія `75ad9a1b-4714-44c1-a945-063939a55e0c`, ітерація 2 — `e3512a14-3e5b-46a2-9a11-620bf77a38d0`.

Де: `…/75ad9a1b-4714-44c1-a945-063939a55e0c.jsonl`, рядок 14, `2026-10-04T12:20:08.485Z`:

```text
…
OpenSpec change "add-basket": 21/26 tasks done — trust level 3 inside it. Next: - [ ] 8.1 Scenario tests first: …
Session notes say to start with: `/opsx:archive add-basket` (smoke виконано, рев'ю — див. `docs/reviews/`), далі червоні тести `add-admin`.
Last pnpm check: GREEN at 2026-10-04T12:20:06.542Z — Tests  84 passed (84) · …
```

Що змінило стан між ітераціями — сам агент ітерації 1 (той самий файл, рядок 337, `2026-10-04T12:29:13.300Z`, tool `Edit` у `docs/session-notes.md`):

```text
- **Починати наступну сесію з:** рішення людини, який зі сценаріїв `basket-web` головний (кодувати `:` чи ні),
  далі `/opsx:archive add-basket` і червоні тести `add-admin`.
```

Де: `…/e3512a14-3e5b-46a2-9a11-620bf77a38d0.jsonl`, рядок 14, `2026-10-04T12:30:09.799Z`:

```text
…
OpenSpec change "add-basket": 24/26 tasks done — trust level 3 inside it. Next: - [ ] 8.1 Scenario tests first: …
Session notes say to start with: рішення людини, який зі сценаріїв `basket-web` головний (кодувати `:` чи ні),
Last pnpm check: GREEN at 2026-10-04T12:30:07.925Z — Tests  102 passed (102) · …
```

Що показує: три поля блоку (лічильник 21/26→24/26, рядок нотаток, час і підсумок `pnpm check` 84→102 тестів) різні у двох
сесіях одного прогону — блок обчислюється на момент запиту. `GREEN at 12:30:07.925Z` — gate **перед** ітерацією 2 (`const before = gate();`,
`scripts/loop.mjs:121`) за 0.8 с до `SessionStart` сесії 2 (рядок 3, `12:30:08.739Z`); gate-after ітерації 1 (`:143`) завершився до запису `loop.jsonl:5` о `12:29:59.872Z`.
Той самий `Next: 8.1` агент ітерації 2 підтвердив, прочитавши `tasks.md` (рядок 26, `Read`) і зупинившись (рядок 65: `**Stopped — the spec is self-contradictory and I will not edit it to make a test pass.**`).

### 2.4 add-admin: RED 12/26 на старті loop і GREEN 26/30 у наступному прогоні

Де: `…/30cc6a10-0ffa-4c7a-8868-60d9c2e6d4ab.jsonl`, рядок 14, `2026-10-04T13:08:27.169Z` (loop-run `docs/loops/2026-10-04T13-08-22-add-admin.md`):

```text
[dynamic-context hook]
OpenSpec change "add-admin": 12/26 tasks done — trust level 3 inside it. Next: - [ ] 2.1 `packages/shared/src/index.ts`: add `ShopVisibilitySchema`, `defaultVisibility()`, `AdminSettingsSchema`,
Session notes say to start with: `/opsx:archive add-basket` (людина читає `## Purpose` архівованої специфікації),
Last pnpm check: RED at 2026-10-04T13:08:25.216Z
```

Де: `…/b1b8f360-588a-44b4-b9d7-2f849bb6f7a6.jsonl`, рядок 14, `2026-10-04T13:22:04.200Z` (loop-run `docs/loops/2026-10-04T13-21-52-add-admin.md`):

```text
OpenSpec change "add-admin": 26/30 tasks done — trust level 3 inside it. Next: - [ ] 8.1 Scenario tests first: `products-visibility.test.ts` "Corrupt settings file falls back to defaults" and
Session notes say to start with: рев'ю (`docs/reviews/2026-10-04-add-admin-*.md`) → `/opsx:archive add-admin` → фінальний README.
Last pnpm check: GREEN at 2026-10-04T13:22:02.324Z — Tests  178 passed (178) · spec:check ok — specs: 5 · active changes: 1 · archived: 2
```

Що показує: після архівації `add-basket` у блоці лишилася одна зміна (`active changes: 1 · archived: 2`), а знаменник
26→30 — це задачі групи 8, долиті з рев'ю; hook перерахував їх без жодної зміни коду.

### 2.5 Варіант SessionStart і варіант «немає активної зміни»

Де: `…/75ad9a1b-4714-44c1-a945-063939a55e0c.jsonl`, рядок 3, `2026-10-04T12:20:07.434Z` — сирий JSON-рядок:

```text
"attachment":{"type":"hook_success","hookName":"SessionStart:startup","toolUseID":"4483f39a-8691-4db5-b83e-ba00b521c8cb","hookEvent":"SessionStart","content":"[dynamic-context hook]\nOpenSpec change \"add-admin\": 0/24 tasks done — trust level 3 inside it.
```

Верхньорівневе поле `rendered[0].content` того ж рядка — як це бачить модель: `<system-reminder>\nSessionStart:startup hook success: [dynamic-context hook]\nOpenSpec change "add-admin": 0/24 tasks done…`.

Де: `…/7d01b3dc-4415-4586-b6ba-328fcae09411.jsonl`, рядок 14, `2026-10-04T10:18:06.593Z` (перша smoke-сесія, ще до `/opsx:propose`):

```text
[dynamic-context hook]
OpenSpec: no active change — outside a change the trust level is 1 (propose, then wait).
Session notes say to start with: `docs/intent.md` → `/opsx:propose add-catalog` (адаптери двох магазинів + каталог).
Last pnpm check: GREEN at 2026-10-04T10:15:53.686Z — Tests  2 passed (2) · spec:check ok — specs: 0 · active changes: 0 · archived: 0
```

Що показує: у кожній сесії блок приходить двічі — рядок 3 (`SessionStart:startup`) і рядок 14 (`UserPromptSubmit`), і гілка
`no active change — … trust level is 1` спрацювала в реальній сесії, а не лише у selftest.

### 2.6 Рев'юери отримують той самий блок — і повторно на кожен промпт

Де: `…/f25ab181-0f03-40d0-96b8-11ca306b24ae.jsonl` (spec-reviewer add-basket; промпт у рядку 4: `You review an OpenSpec change that someone else implemented. You are the checker, not the maker`),
рядок 14, `2026-10-04T12:14:48.290Z`, і **знову** рядок 69, `2026-10-04T12:15:05.274Z` — після `queued_command` у рядку 68
(`Background command "Run the test suite" completed (exit code 0)`):

```text
…
OpenSpec change "add-basket": 21/21 tasks done — trust level 3 inside it. All tasks done — archive it.
Session notes say to start with: людський smoke-прогін кошика з `tasks.md` (`pnpm dev` → «Додати в кошик» →
Last pnpm check: GREEN at 2026-10-04T12:14:19.317Z — Tests  84 passed (84) · spec:check ok — specs: 3 · active changes: 2 · archived: 1
```

Паралельний code-reviewer `…/30641f9b-1f3e-48ca-b277-59d2a4a57044.jsonl` (рядок 4: `You review a diff written by someone else. You never edit files or write patches.`)
отримав ідентичний блок у рядку 14 з тим самим timestamp `2026-10-04T12:14:48.290Z`. Обидва запущені `scripts/review.mjs:72`
(`const r = spawnSync("claude", args, { cwd: root, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });`) — у cwd проєкту, тож hooks діють і на read-only сесії.

### 2.7 Агент міркує про hook: знахідка рев'юера про «застарілий рядок, який hook підкладе наступній сесії»

Де: `…/ec908007-995f-4d68-8b0b-5d1665b7cff4.jsonl`, рядок 114, `2026-10-04T11:36:07.654Z` (code-reviewer add-catalog, раунд 2) →
збережено в `docs/reviews/2026-10-04-add-catalog-code-reviewer.md:10`:

```text
- `docs/session-notes.md:24` — "Починати наступну сесію з" still instructs the next session to replace `smoke: ____`, with the human's smoke output pasted *inside* that instruction; the `dynamic-context` hook surfaces this line verbatim, so the next session is told to redo finished work.
```

Що показує: рев'юер знає, що саме цей рядок потрапить у контекст наступного агента, і оцінює нотатки з огляду на hook — практика
впливає на поведінку, а не лише «існує». Чи було виправлено — див. §4.

## 3. Як відтворити

```bash
T=~/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator-submissions-elika-filin
grep -c '\[dynamic-context hook\]' $T/*.jsonl            # рахує РЯДКИ: 3 на сесію = L3 (SessionStart) + L14 (UserPromptSubmit) + L18 (attachment "instructions" = CLAUDE.md, де згадано hook); f25ab181 → 4 (ще L69)
node -e 'const fs=require("fs");for(const f of fs.readdirSync(process.argv[1]).filter(f=>f.endsWith(".jsonl")))fs.readFileSync(process.argv[1]+"/"+f,"utf8").split("\n").forEach((l,i)=>{let o;try{o=JSON.parse(l)}catch{return}if(o.type==="attachment"&&o.attachment?.type==="hook_success"&&/dynamic-context/.test(o.attachment.command))console.log(f.slice(0,8),"L"+(i+1),o.attachment.hookEvent,o.timestamp,o.attachment.content.split("\n").filter(s=>/tasks done|Last pnpm/.test(s)).join(" | "))})' $T
sed -n '41,70p' .claude/settings.json; sed -n '5,6p' .agent-log/loop.jsonl; grep -n 'dynamic-context' docs/reviews/*.md
```

Станом на 14:48 UTC 2026-10-04 — 22 сесії (блоки 10:18:05Z–14:24:27Z), 45 блоків `hook_success` (на 13:30 UTC — 18 / 37, той самий однорядник із фільтром `o.timestamp<="2026-10-04T13:30:00.000Z"`); лічильник росте.

## 4. Чесно: чого не знайшли / що лише існує

- Жоден агент не цитує рядки hook-а дослівно (`grep` по assistant-тексту на `Last pnpm check|trust level 3|Session notes say` — 0 збігів).
  Агенти loop-а все одно читають `tasks.md` самі (`e3512a14…jsonl:26`), тож рядок `Next:` для них дублює те, що вони й так відкривають;
  доведено **отримання** і **динамічність** блоку, а прямий причинний ланцюг «прочитав hook → змінив дію» є лише в §2.7.
- Знахідку §2.7 не виправили перед наступним прогоном: `…/f5f6a0cf-0721-43a8-991e-484042fdbedf.jsonl:14` (`2026-10-04T11:37:28.041Z`) несе той
  самий рядок ``Session notes say to start with: людський smoke-прогін із `tasks.md` → заміна `smoke (людина, 2026-10-04, …``; коміт `9a2d353`
  (14:37:08 +0300, «session notes corrected») правив інші рядки, а цей змінено лише в `43a4a23` (16:28:06 +0300).
- Виправлено після перевірки: раніше тут стояло, що обриви в §2.3/§2.6 — зріз до 200 символів (`:58`); це неправда (рядок §2.6 — 74 символи, §2.3 — 77).
  Справжній механізм: regex `dynamic-context.mjs:57` `/\*\*Починати наступну сесію з:\*\*\s*(.+)/` без прапорця `s` бере лише перший фізичний рядок переносного
  bullet-а, а перенос поставив сам агент: `…/2f12c37d-9271-4824-9abf-9c12fee80816.jsonl:400` (`2026-10-04T12:12:53.444Z`, `Edit` у `docs/session-notes.md`, `new_string`
  містить ``«Додати в кошик» →\n  кількість 2 →``) → обрив §2.6; `…/75ad9a1b…:337` містить ``(кодувати `:` чи ні),\n  далі `/opsx:archive``) → обрив §2.3.
  Зріз до 200 спрацював лише для рядка §4 (`f5f6a0cf…:14`, рівно 200 символів). Агент бачить саме обрізаний рядок — другий рядок bullet-а до нього не доходить.
- `scripts/hooks-selftest.mjs:121-130` перевіряє hook на синтетичному дереві (`add-basket.*1\/3 tasks done`) — це доказ, що код працює, а не що ним користувалися; тому в §2 його не рахуємо.
- README.md:77 (рядок таблиці «Контекст-інженерія · динамічний») посилається на hook і selftest, але не на транскрипти — цей файл закриває саме цю прогалину.

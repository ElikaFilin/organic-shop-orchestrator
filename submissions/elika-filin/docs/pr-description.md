<!-- Чернетка опису PR для здачі capstone (шаблон — .github/PULL_REQUEST_TEMPLATE.md у корені курсу).
     Скопіювати в PR; посилання — відносно кореня форку. Ім'я і відео вписує людина. -->

## Ім'я

Elika Filin <!-- справжнє, піде в сертифікат -->

## Проєкт

**Organic Catalog** — один магазин над кількома органічними крамницями: каталог із товарів Карашин Яр (Tilda)
і OSIO organic (JSON API), один кошик, адмін-панель із перемикачем «наживо / знімок» і видимістю товарів.
pnpm-workspace: `apps/api` (Hono) + `apps/web` (Vite + React) + `packages/shared`.

**Де код:** гілка `elika-filin`, тека `submissions/elika-filin/` (README з інструкцією запуску і картою «практика → доказ»).

## Відео-демо (1–2 хв)

**Посилання:** _(вставити)_

## Застосовані практики Agentic Engineering

- [x] **Контекст-інженерія** — доказ: статичний — [`AGENTS.md`](submissions/elika-filin/AGENTS.md) (≤60 рядків: рівні довіри 3 всередині зміни / 1 поза нею, definition of done, межі), [`CLAUDE.md`](submissions/elika-filin/CLAUDE.md) (`@AGENTS.md` + compact-інструкції), [`.claude/rules/`](submissions/elika-filin/.claude/rules/); динамічний — hook [`dynamic-context.mjs`](submissions/elika-filin/.claude/hooks/dynamic-context.mjs) підкладає в кожен промпт активну зміну, прогрес задач і вердикт останнього `pnpm check` (приклад виводу — секція 5 `pnpm hooks:selftest`), MCP Context7 — [`docs/context7-log.md`](submissions/elika-filin/docs/context7-log.md) (6 запитів і що кожен змінив); примус — [`protect-env.mjs`](submissions/elika-filin/.claude/hooks/protect-env.mjs) (exit 2 на `.env*` і на `process.env` поза `config.ts`), [`stop-gate.mjs`](submissions/elika-filin/.claude/hooks/stop-gate.mjs) (агент не може «закінчити» з неперевіреними правками). **Правило спрацювало:** allow-list заблокував 22 Bash-команди агента в `-p`-режимі — `pnpm agent:log` → «Proposed but not executed», [`.agent-log/actions.jsonl`](submissions/elika-filin/.agent-log/actions.jsonl).
- [x] **Цикли (loop engineering)** — доказ: [`scripts/loop.mjs`](submissions/elika-filin/scripts/loop.mjs) (гейт → свіжа `claude -p` → гейт; стоп: зелений + усі задачі `[x]` / бюджет / max-iter / «застряг»); записи 9 ітерацій за 3 зміни — [`docs/loops/`](submissions/elika-filin/docs/loops/) (ходи, токени, $, вивід агента), [`.agent-log/loop.jsonl`](submissions/elika-filin/.agent-log/loop.jsonl). Один прогін зупинився сам: «специфікація суперечить сама собі» ([`docs/loops/2026-10-04T12-19-57-add-basket.md`](submissions/elika-filin/docs/loops/2026-10-04T12-19-57-add-basket.md)).
- [x] **Верифікація** — доказ: одна команда `pnpm check` (typecheck + lint + vitest ×3 пакети + `spec:check` + `hooks:selftest`); червоне → зелене видно за парами комітів `test(catalog): … red` → `feat(catalog): … green`, `test(basket): … red` → `feat(basket): … green`, `test(admin): … red` → `feat(admin): … green` (червоний прогін процитовано в повідомленні коміту); вивід — розділ 6 README.
- [x] **maker ≠ checker** — доказ: [`scripts/review.mjs`](submissions/elika-filin/scripts/review.mjs) запускає окрему read-only сесію з [`.claude/agents/spec-reviewer.md`](submissions/elika-filin/.claude/agents/spec-reviewer.md) / [`code-reviewer.md`](submissions/elika-filin/.claude/agents/code-reviewer.md); виводи — [`docs/reviews/`](submissions/elika-filin/docs/reviews/) (8 файлів). **Що знайшов:** 500 на нечитабельному знімку, мемоізований reject, гонку check-then-write у кошику, однакові назви лінків, float-шум у сумах, `findProduct` по відфільтрованому списку (прихований товар зникав із кошика) — усе стало сценаріями і задачами; 1 знахідку (nonce у підписі admin-куки) відхилено з причиною.
- [x] **Специфікації наперед (SDD)** — доказ: OpenSpec 1.14, [`openspec/`](submissions/elika-filin/openspec/) — `docs(openspec): propose …` завжди раніше за `test(…)` і `feat(…)` (`git log --oneline --reverse`); 3 зміни архівовано в `openspec/specs/` (8 специфікацій). **Специфікацію змінили, бо реальність не збіглася:** коміт `docs(openspec): add-catalog — spec changed where reality disagreed` (OSIO відповідав 400 без заголовка `Application-Instance`); `docs(openspec): add-basket — … spec changed on rounding`; `… the loop stopped on a self-contradictory spec; owner decided`.
- [x] **Журнал рівнів довіри** — доказ: [`docs/autonomy-log.md`](submissions/elika-filin/docs/autonomy-log.md) — 14 рядків, одне явне зниження (smoke наживо → рівень 1), одне підвищення (цикл → рівень 3), одна ескалація, якої свідомо не зробили, вивід `pnpm agent:log`.
- [ ] **Project Factory** — не використовував(ла).
- [x] Інше: естафета між сесіями — [`docs/session-notes.md`](submissions/elika-filin/docs/session-notes.md) (чекліст із доказом у тому ж рядку); intent до специфікації — [`docs/intent.md`](submissions/elika-filin/docs/intent.md).

## Інструменти та MCP

Claude Code (desktop, Fable 5.1): workflows з паралельними сабагентами (дослідження, propose + 2 критики, червоні
тести + checker, archive + verify), `claude -p` у циклі та в рецензіях з проєктними hooks; MCP **Context7**
(`.mcp.json`, [`docs/context7-log.md`](submissions/elika-filin/docs/context7-log.md)); вбудований браузер для smoke;
OpenSpec 1.14 (`/opsx:propose` → `/opsx:apply` → `/opsx:archive`, закріплений як devDependency, `pnpm spec:check`).

## Що вирішував(ла) я, а що агент

**Я:** форма бекенду (workspace із двох застосунків — після того, як агент пояснив різницю), джерело даних наживо з
перемикачем і адмінкою (розширило обсяг), сховище кошика, розташування в репо; бюджети циклів; прийняття або
відхилення кожної знахідки рецензентів; рішення на суперечності специфікації, на якій зупинився цикл (`:` у шляху
буквальна); округлення сум до копійок замість «ніколи не округлювати»; читання `## Purpose` кожної архівованої
специфікації; усі smoke-прогони наживо (єдиний крок, що б'є по чужих сайтах).

**Агент:** дослідження і скрейпінг (10 + 10 товарів із незалежною перевіркою), каркас і перенесення харнесу курсу,
усі артефакти OpenSpec, тести сценаріїв, реалізація через цикл, рецензії, архівування.

**Де пішло не так:** перший живий smoke показав `osio:snapshot-fallback … HTTP 400` — fallback спрацював «за
специфікацією» і сховав помилку від гейта; критик зловив у design.md regex з ASCII-`\b`, що не збігався з жодною
назвою товару; перший прогін циклу надрукував список задач замість лічильника (баг у `loop.mjs`); рецензент знайшов
застарілі числа в session-notes; code-reviewer перезаписав файл першого раунду (відновлено, скрипт нумерує раунди).

## Перевірка

```
$ cd submissions/elika-filin && pnpm check
 Test Files  27 passed (27)
      Tests  182 passed (182)
spec:check ok — specs: 8 · active changes: 0 · archived: 3
all hook checks passed
```

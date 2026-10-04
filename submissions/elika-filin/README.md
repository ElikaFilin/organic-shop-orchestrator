# Organic Catalog

Один магазин над кількома органічними крамницями: каталог із товарів [Карашин Яр](https://karashynyard.com.ua/#rec638772397)
і [OSIO organic](https://osio-organic.com.ua/) (по 10 на магазин), один кошик (додати · змінити кількість ·
видалити), адмін-панель із перемикачем «наживо / знімок» і видимістю товарів.

Capstone курсу **fwdays · Crash Course: Agentic Engineering** (вересень–жовтень 2026). Правила приймання —
[`RUBRIC.md`](../../RUBRIC.md) у корені репозиторію. **Карта «практика → доказ» — нижче, у розділі 4.**

## 1. Запуск

Потрібні Node.js ≥ 22.12 і pnpm 10.

```bash
cd submissions/elika-filin
pnpm install
cp .env.example .env        # ADMIN_TOKEN — будь-який рядок; CONTEXT7_API_KEY — лише для MCP у Claude Code
pnpm dev                    # api → http://localhost:4000 · web → http://localhost:5173
```

- `/` — каталог (наживо з магазинів; якщо магазин не відповідає — його знімок із `data/shops/` і підпис «Показано збережену копію»);
- `/basket` — кошик (анонімна httpOnly-кука `basket_id`, дані в `.data/baskets.json`);
- `/admin` — вхід за `ADMIN_TOKEN`, перемикач джерела даних, чекбокси видимості для **всіх** товарів кожного магазину.

Один гейт на все:

```bash
pnpm check                  # typecheck + lint + vitest (api · web · shared) + spec:check + hooks:selftest
```

Інші команди: `pnpm test`, `pnpm agent:log` (що агент справді робив), `pnpm hooks:selftest` (hooks без агента),
`pnpm loop -- --change <id>` (цикл до зеленого), `pnpm review -- --change <id> [--agent code-reviewer]` (read-only
рецензент), `pnpm exec openspec …` (специфікації).

| Каталог | Кошик | Адмінка |
|---|---|---|
| ![каталог](docs/screenshots/catalog.jpg) | ![кошик](docs/screenshots/basket.jpg) | ![адмінка](docs/screenshots/admin.jpg) |

## 2. Що всередині

```
apps/api        Hono на Node — src/routes (тонкі хендлери) · src/lib (чиста логіка + тести поруч) · src/shops (адаптери) · fixtures
apps/web        Vite + React 19 + React Router — src/pages · src/components · src/api/client.ts (усі запити)
packages/shared zod-схеми і типи, спільні для обох застосунків
data/shops      знімок 10 + 10 товарів, перевірений незалежним агентом (кожне фото і сторінка — curl 200)
openspec        specs/ (джерело правди після archive) · changes/ (активні) · changes/archive/
docs            intent.md · session-notes.md · autonomy-log.md · context7-log.md · loops/ · reviews/
.claude         settings.json (allow/ask/deny + hooks) · hooks/*.mjs · agents/*.md · rules/*.md · commands/opsx · skills
.agent-log      actions.jsonl — один JSON-рядок на кожен виклик інструмента агентом; loop.jsonl — ітерації циклу
scripts         loop.mjs · review.mjs · check-verdict.mjs · hooks-selftest.mjs · spec-check.mjs · agent-log-summary.mjs
```

Адаптери: Карашин Яр — парсинг HTML Tilda-сторінки (`data-product-lid`, `li_title__N`, …); OSIO — JSON API
магазину (потребує заголовка `Application-Instance`, див. історію нижче). Живі результати кешуються 5 хв на магазин.

## 3. Як це будувалось — цикл однієї зміни

Три зміни OpenSpec (`add-catalog`, `add-basket`, `add-admin`), кожна — вертикальний зріз від API до екрана, і
кожна пройшла той самий цикл; порядок видно в `git log --oneline --reverse`:

1. `docs(openspec): propose <зміна>` — proposal, дельта-специфікації (SHALL + `#### Scenario` з точними значеннями
   з `data/shops/*.json`), design, tasks. Пише агент за `.claude/commands/opsx/propose.md`; **два незалежні
   критики** (testability, scope) атакують артефакти; reviser виправляє; `openspec validate --strict`.
2. `test(<зміна>): scenario tests first — red` — по одному тесту на сценарій, **до** реалізації; окремий checker-агент
   підтверджує покриття і що тести падають з правильної причини. Червоний прогін — у повідомленні коміту.
3. `pnpm loop -- --change <зміна>` — `scripts/loop.mjs` крутить свіжу сесію `claude -p` доти, доки `pnpm check` не
   зелений **і** всі задачі `[x]`; журнал ітерацій — `docs/loops/`.
4. `pnpm review` — два read-only рецензенти (`spec-reviewer`, `code-reviewer`) в окремих сесіях; їхні знахідки стають
   новими сценаріями й задачами (знову крок 3). Вивід — `docs/reviews/`.
5. `feat(<зміна>): … — green` → `/opsx:archive` (дельти зливаються в `openspec/specs/`, людина читає `## Purpose`).

## 4. Практики Agentic Engineering → докази

| Практика | Що саме | Де подивитися |
|---|---|---|
| **Контекст-інженерія** · статичний | `AGENTS.md` (≤60 рядків: рівні довіри, команди, definition of done, межі), `CLAUDE.md` → `@AGENTS.md` + compact-інструкції, `.claude/rules/{api-routes,web}.md` | [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md), [`.claude/rules/`](.claude/rules/) |
| **Контекст-інженерія** · динамічний | hook `dynamic-context.mjs` (SessionStart / UserPromptSubmit) рахує з диска активну зміну, прогрес задач, рядок «починати з» і вердикт останнього `pnpm check`; MCP **Context7** підкладає документацію бібліотек | [`.claude/hooks/dynamic-context.mjs`](.claude/hooks/dynamic-context.mjs), приклад виводу — `pnpm hooks:selftest` (секція 5); [`docs/context7-log.md`](docs/context7-log.md) — 6 запитів і що кожен змінив; [`.mcp.json`](.mcp.json) |
| **Контекст-інженерія** · примус (hooks) | `protect-env.mjs` (exit 2: `.env*` і `process.env` поза `apps/api/src/config.ts`), `log-action.mjs` (журнал кожного виклику), `log-filter.mjs` (сирий журнал не потрапляє у вікно), `stop-gate.mjs` (не дає агентові «закінчити» з неперевіреними правками) | [`.claude/settings.json`](.claude/settings.json), [`.claude/hooks/`](.claude/hooks/), самоперевірка — [`scripts/hooks-selftest.mjs`](scripts/hooks-selftest.mjs) (частина `pnpm check`) |
| **Правило спрацювало** | allow-list заблокував 22 Bash-команди агента в `-p`-режимі (`for … cat`, `perl -pi`, …) — агент перейшов на Read/Edit; 764 виконаних дій за 18 сесій | `pnpm agent:log` → «Proposed but not executed»; [`.agent-log/actions.jsonl`](.agent-log/actions.jsonl) |
| **Цикли (loop engineering)** | `scripts/loop.mjs`: гейт → свіжа `claude -p` → гейт; стоп на зеленому/бюджеті/max-iter/«застряг». 9 ітерацій за 3 зміни (533 ходи, 226 тис. output-токенів, $28.10); одна зупинилась сама: «специфікація суперечить сама собі» | [`scripts/loop.mjs`](scripts/loop.mjs); записи прогонів [`docs/loops/`](docs/loops/) (кожен: ітерації, ходи, токени, $, вивід агента); [`.agent-log/loop.jsonl`](.agent-log/loop.jsonl) |
| **Верифікація** | одна команда `pnpm check`; тести сценаріїв спершу червоні, потім зелені — видно за парами комітів `test(…): … red` → `feat(…): … green`; `spec:check` падає на порожньому дереві, незакритих задачах і голому `openspec` | [`package.json`](package.json) (`check`), [`scripts/spec-check.mjs`](scripts/spec-check.mjs); коміти `e869183`→`d91e931` (каталог), `b5ebfd7`→`84fe870` (кошик) |
| **maker ≠ checker** | рецензент — окрема `claude -p` сесія з read-only інструментами (`.claude/agents/spec-reviewer.md`, `code-reviewer.md`), maker не бачить її промпт. Знайшов: 500 на нечитабельному знімку, мемоізований reject, гонку check-then-write у кошику, однакові назви лінків, float-шум у сумах… — усе стало сценаріями | [`scripts/review.mjs`](scripts/review.mjs), [`.claude/agents/`](.claude/agents/), виводи — [`docs/reviews/`](docs/reviews/); також критики на етапі propose і checker на етапі червоних тестів (транскрипти workflow) |
| **SDD (OpenSpec 1.14)** | специфікації закомічені **до** коду (`docs(openspec): propose …` раніше за `test(…)` і `feat(…)`); дві зміни архівовано в `openspec/specs/`; **специфікацію змінено, бо реальність не збіглася** — OSIO відповідав 400 без заголовка `Application-Instance`, якого не було ні в специфікації, ні в тестах на фікстурах | [`openspec/`](openspec/), [`openspec/config.yaml`](openspec/config.yaml) (правила: точні значення у сценаріях, тести першими); коміти `bae6571` (реальність), `347e42b`/`183127e` (рев'ю, суперечність) |
| **Журнал рівнів довіри** | рядок на кожну частину роботи, одне явне зниження (smoke наживо → рівень 1), одне підвищення (цикл → рівень 3) і одна ескалація, якої не зробили | [`docs/autonomy-log.md`](docs/autonomy-log.md) |
| **Естафета між сесіями** | `docs/session-notes.md`: журнал прогресу, чекліст із доказом у тому ж рядку, команда запуску | [`docs/session-notes.md`](docs/session-notes.md), [`docs/intent.md`](docs/intent.md) |

## 5. Що вирішувала людина, а що агент

**Людина:** форма бекенду (workspace `apps/api` + `apps/web`, після пояснення різниці), джерело даних (наживо з
перемикачем і адмінкою — це розширило обсяг), сховище кошика, розташування в репо; бюджет циклу; прийняття або
відхилення кожної знахідки рецензентів; `:` у шляху лишається буквальною (суперечність, на якій цикл зупинився);
округлення сум до копійок замість «ніколи не округлювати»; читання `## Purpose` кожної архівованої специфікації;
smoke-прогони наживо (`pnpm dev`, curl, браузер) — єдиний крок, що б'є по чужих сайтах.

**Агент:** дослідження (конспекти 3 занять, скрейпінг 10 + 10 товарів із незалежною перевіркою, CLI OpenSpec),
каркас, усі артефакти OpenSpec, тести сценаріїв, реалізація через цикл, рецензії, архівування.

**Де пішло не так:** перший живий smoke показав `osio:snapshot-fallback … HTTP 400` — fallback спрацював «за
специфікацією» і сховав проблему від гейта; критик зловив у design.md regex із ASCII-`\b`, який не збігався з
жодною назвою товару; перший прогін циклу надрукував список задач замість лічильника (баг у `loop.mjs`, виправлено
в тому ж коміті); рецензент другого раунду знайшов застарілі числа в `session-notes.md`; мій `replace` зіпсував
рядок у нотатках і довелось лагодити руками; `code-reviewer` перезаписав файл першого раунду (відновлено, скрипт
тепер нумерує раунди).

## 6. Перевірка

```
$ pnpm check
 Test Files  27 passed (27)
      Tests  182 passed (182)
spec:check ok — specs: 8 · active changes: 0 · archived: 3
all hook checks passed
```

Три зміни архівовано: `openspec/changes/archive/2026-10-04-add-{catalog,basket,admin}`; 8 специфікацій у `openspec/specs/`.
Smoke наживо (людина): `live [ 'karashynyard:live:10', 'osio:live:10' ] 20`; кошик — `totals { count: 3, sum: 1525 }`;
адмінка — 131 + 62 товари, hide → `karashynyard:live:9`, snapshot ↔ live.

## 7. Відоме обмеження

Список видимості зберігає id конкретного джерела: масив, зібраний у режимі «наживо», у режимі «знімок» збігається
лише з тими товарами, що є в обох (за специфікацією «id, яких немає, ігноруються»). Кандидат на наступну зміну —
видимість на кожне джерело окремо або підказка в панелі.

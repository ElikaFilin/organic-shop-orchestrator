# Доказ практики: специфікації наперед (SDD · OpenSpec 1.14)

Рубрика курсу (`README.md` кореня оркестратора, рядок 23): «**специфікації наперед (SDD)** — якщо доречно». Нижче — не «папка
`openspec/` існує», а слід того, що агенти **писали специфікацію до коду, ганяли її через CLI і міняли її, коли реальність,
рев'ю або внутрішня суперечність не збіглися**. Шляхи: відносні — від `submissions/elika-filin/`, абсолютні — транскрипти поза
репо. Час у git — `+0300`, у транскриптах — UTC (`Z`): 14:26 +0300 = 11:26Z. Session id усіх воркфлоу-агентів — `364dc8be-543d-4eb4-afd8-6b19b67b4f42`;
`W` нижче = `submissions/elika-filin/sessions/workflows`.

## 1. Що доводимо
1. Порядок у git: `propose` → `test … red` → `feat … green` → `archive` для кожної з трьох змін.
2. Proposer/archive-агенти викликали саме CLI (`pnpm exec openspec new change / status / instructions / validate`), а не лише створювали md-файли.
3. Специфікація змінювалась **через зворотний зв'язок**: live-smoke (400 від OSIO), рев'ю (округлення), зупинка циклу (суперечливий сценарій).
4. Усі три зміни архівовано; гейт `pnpm spec:check` це підтверджує.

## 2. Докази

### 2.1 Порядок комітів: propose < test red < feat green < archive
Де: `cd /Users/elikafilin/Documents/home_projects/organic-shop-orchestrator && git log --reverse --format='%h %ad %s' --date=iso`, рядки 5–21 виводу (1–3 — шаблон курсу від вересня, 4 — каркас `08c2adf`):
```
01903df 2026-10-04 13:52:25 +0300 docs(openspec): propose add-catalog — shop adapters, catalog API, catalog page
e869183 2026-10-04 14:13:17 +0300 test(catalog): scenario tests first — red
669c9a8 2026-10-04 14:24:05 +0300 docs(openspec): propose add-basket — anonymous cookie basket, JSON-file store, /basket page
bae6571 2026-10-04 14:26:22 +0300 docs(openspec): add-catalog — spec changed where reality disagreed
9a2d353 2026-10-04 14:37:08 +0300 docs(openspec): add-catalog — review round 2 folded in (task group 10), session notes corrected
d91e931 2026-10-04 14:41:43 +0300 feat(catalog): shop adapters, catalog API with snapshot fallback, catalog page — green
fc5159e 2026-10-04 14:46:08 +0300 docs(openspec): archive add-catalog → specs catalog-api, catalog-web, shop-adapters
b5ebfd7 2026-10-04 15:06:56 +0300 test(basket): scenario tests first — red
347e42b 2026-10-04 15:19:57 +0300 docs(openspec): add-basket — reviews folded in (task group 8), spec changed on rounding
183127e 2026-10-04 15:32:30 +0300 docs(openspec): add-basket — the loop stopped on a self-contradictory spec; owner decided
84fe870 2026-10-04 15:34:59 +0300 feat(basket): anonymous cookie basket, JSON-file store, basket page — green
33e1d61 2026-10-04 15:40:04 +0300 docs(openspec): propose add-admin — token login, settings store, visibility toggles, live/snapshot switch, nav + light theme
b2cb737 2026-10-04 15:40:22 +0300 docs(openspec): archive add-basket → specs basket-api, basket-web; catalog-web gains the card button
695f34c 2026-10-04 16:08:22 +0300 test(admin): scenario tests first — red
4c6189f 2026-10-04 16:21:52 +0300 docs(openspec): add-admin — code review folded in (task group 8)
43a4a23 2026-10-04 16:28:06 +0300 feat(admin): token login, settings store, visibility toggles, live/snapshot switch, nav + light theme — green
3b6d81f 2026-10-04 16:33:42 +0300 docs(openspec): archive add-admin → specs admin-auth, admin-settings, admin-web; README, PR description, screenshots
```
По змінах: add-catalog `01903df 13:52` < `e869183 14:13` < `d91e931 14:41` < `fc5159e 14:46`; add-basket `669c9a8 14:24` < `b5ebfd7 15:06` < `84fe870 15:34` < `b2cb737 15:40`;
add-admin `33e1d61 15:40` < `695f34c 16:08` < `43a4a23 16:28` < `3b6d81f 16:33`. Тіло `e869183` (`git show e869183 -s --format=%b`): «Test Files  8 failed | 2 passed (10)» — тест-коміт справді червоний. `git show e869183 --stat` — 13 файлів: 8 тестів `*.test.ts(x)`, 3 фікстури в `apps/api/fixtures/` (`karashynyard.html`, `osio.json`, `make-fixtures.py`), `tasks.md` і один доданий рядок у `docs/context7-log.md` (рядок таблиці №6); жодного файлу реалізації.
Що це показує: жодного `feat` до `test`, жодного `test` до `propose` — в усіх трьох змінах.

### 2.2 Proposer створював зміну через CLI і валідував до першого тесту
Де: `$W/wf_50339c24-2de/agent-af70c3d88dd7d71b7.jsonl` (агент `propose`), рядок 71 (tool_use, 2026-10-04T10:20:31Z) → рядок 74 (tool_result):
```
pnpm exec openspec new change "add-catalog" && … pnpm exec openspec status --change "add-catalog" --json && … pnpm exec openspec instructions "$a" --change "add-catalog" --json
→ Created change 'add-catalog' at openspec/changes/add-catalog/
  Schema: spec-driven
```
Рядок 124 (10:33:10Z) → 126: `pnpm exec openspec validate "add-catalog" --strict --no-interactive` → `Change 'add-catalog' is valid` … `Progress: 4/4 artifacts complete` … `spec:check ok — specs: 0 · active changes: 1 · archived: 0`.
Те саме для двох інших змін: `$W/wf_cbada62d-5be/agent-a33c492736106c1fe.jsonl:64` (10:55:04Z, `pnpm exec openspec new change "add-basket"` → `Created change 'add-basket'`), `:119` (11:11:22Z, validate → `Change 'add-basket' is valid`);
`$W/wf_eed820d4-61a/agent-ac8a56e6935ce1471.jsonl:94` (11:52:06Z, `pnpm exec openspec new change "add-admin"` → `Created change 'add-admin'`), `:103`–`:106` — чотири окремі виклики `pnpm exec openspec instructions proposal|specs|design|tasks --change "add-admin" --json`.
Усього в транскриптах воркфлоу (без цього mine-воркфлоу) — **64** tool_use Bash із рядком `pnpm exec openspec`: propose 20, archive 22, revise 7, red-tests 7, verify-archive 3, критики 3, інші 2.
Що це показує: артефакти народжувались командою `new change` і перевірялись `validate --strict` раніше, ніж з'явився перший тест (`e869183`, 14:13 +0300 = 11:13Z).

### 2.3 Автор червоних тестів читає специфікацію через CLI, а не з пам'яті
Де: `$W/wf_548ac787-9ce/agent-a003f4087a5a9af4b.jsonl:14` (агент `red-tests`, 2026-10-04T10:52:30Z) — перший Bash-виклик агента:
```
cd …/submissions/elika-filin && cat .claude/commands/opsx/apply.md && echo "-----" && pnpm exec openspec instructions apply --change "add-catalog" --json
```
Той самий рядок (з `add-basket`) — `$W/wf_1e32404a-7c6/agent-a4f1cd68909d68768.jsonl:14` (11:41:52Z); для add-admin — `$W/wf_3dd9141d-f38/agent-a64c12899f94f6935.jsonl:14` (12:40:17Z),
без `cat apply.md`: `pnpm exec openspec instructions apply --change "add-admin" --json 2>&1 | head -200`. У всіх трьох транскриптах це перший Bash-виклик агента.
Що це показує: тести писались під контракт із `openspec instructions apply`, тому в `e869183` — «One Vitest test per spec scenario (27)».

### 2.4 Реальність не збіглася → специфікацію змінено → тест → код (bae6571)
Де: головна сесія `/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator/364dc8be-543d-4eb4-afd8-6b19b67b4f42.jsonl`, рядок 666 (tool_result, 2026-10-04T11:22:10Z) і рядок 673 (11:22:28Z):
```
=== live API smoke (hits the real shops) ===
live [
  'karashynyard:live:10',
  'osio:snapshot-fallback:10 ERR=osio: HTTP 400'
] 20
…
{
  "message": "Failed to determine the application based on the Application-Instance header or query parameter"
}
```
Через 4 хвилини — коміт `bae6571` (14:26:22 +0300 = 11:26:22Z); `git show bae6571 -- submissions/elika-filin/openspec/changes/add-catalog/specs/shop-adapters/spec.md`; сьогодні ці рядки — `openspec/changes/archive/2026-10-04-add-catalog/specs/shop-adapters/spec.md:47` і `:72`:
```
+request header `Application-Instance: 3fc23022-4cf1-4d8b-a24c-c50e2651d4e0` (the shop's public tenant id, shipped in
+its own JS bundle; without it the API answers `400 Failed to determine the application`) and map
…
+#### Scenario: Request carries the tenant header
```
Далі — hook-журнал `.agent-log/actions.jsonl`, сесія циклу `63ea697e` (перша дія 11:26:33Z — через 11 с після коміту): рядок 288 — `"tool":"Edit","path":"apps/api/src/shops/osio.test.ts"` (11:26:52Z), рядок 294 — `"tool":"Edit","path":"apps/api/src/shops/osio.ts"` (11:27:04Z).
Результат у коді: `apps/api/src/shops/osio.test.ts:65` — `test("Request carries the tenant header", async () => {`; `apps/api/src/shops/osio.ts:9` — `const TENANT_HEADERS = { "Application-Instance": "3fc23022-4cf1-4d8b-a24c-c50e2651d4e0" };`; тіло `d91e931`: «Live smoke: live [ 'karashynyard:live:10', 'osio:live:10' ] 20».
Що це показує: ланцюжок 400 → спека → червоний тест → код → зелений smoke, з часовими мітками в чотирьох незалежних джерелах (транскрипт, git, hook-журнал, код).

### 2.5 Рев'ю змінило контракт: «never rounded» → «rounded to 2 decimal places» (347e42b)
Де: `git show 347e42b -- submissions/elika-filin/openspec/changes/add-basket/specs/basket-api/spec.md`; зараз `openspec/changes/archive/2026-10-04-add-basket/specs/basket-api/spec.md:46–47`:
```
-lines (UAH number, never rounded). Lines with `product: null` add 0 to both.
+lines (UAH number, rounded to 2 decimal places — kopiykas — so a non-integer price never leaks binary float noise
+into the response; integer prices stay integers). Lines with `product: null` add 0 to both.
```
Тіло коміту (`git show 347e42b -s --format=%b`, рядки 4–7): «float noise in totals); … totals.sum now 'rounded to kopiykas' instead of 'never rounded' — a spec change, decided by the owner.»
Сама знахідка — `docs/reviews/2026-10-04-add-basket-code-reviewer.md:15`, її словами: «`price * quantity` is raw float arithmetic and `formatPrice` does not round … Failing input: `price: 19.99`, quantity 3 → `Разом: 59.97000000000001 ₴` and the same value in the API's `totals.sum`». Ярлик «float noise in totals» є лише в тілі коміту, у файлі рев'ю його нема.
Що це показує: правка контракту йде в специфікацію до коду (`84fe870` — через 15 хв), а не підганяється під нього заднім числом.

### 2.6 Цикл зупинився сам на суперечливій специфікації; рішення — людське (183127e)
Де: `docs/loops/2026-10-04T12-19-57-add-basket.md:45` (вивід агента, ітерація 2, stop=stuck):
```
**Stopped — the spec is self-contradictory and I will not edit it to make a test pass.**
```
`git show 183127e -- submissions/elika-filin/openspec/changes/add-basket/specs/basket-web/spec.md`; зараз `openspec/changes/archive/2026-10-04-add-basket/specs/basket-web/spec.md:130–131` і `:160`:
```
-The `productId` in a path SHALL be `encodeURIComponent`-encoded.
+The `productId` in a path SHALL be percent-encoded with `encodeURIComponent` except the `:` between shop key and
+source id, which stays literal (RFC 3986 allows it in a path segment and the sibling scenarios pin the literal form).
…
-- **THEN** `fetch` was called with the path `/api/basket/items/osio%3Aa%23b`
+- **THEN** `fetch` was called with the path `/api/basket/items/osio:a%23b`
```
і `openspec/changes/archive/2026-10-04-add-basket/tasks.md:187`: «Human decision 2026-10-04 (loop run T12-19-57 stopped: "the spec is self-contradictory"): `:` stays literal in paths;».
Що це показує: специфікація — джерело правди настільки, що агент відмовився її «підкрутити» під тест; суперечність зняв власник у спеці, і лише потім з'явився `84fe870`.

### 2.7 Archive-агент: instructions archive → validate --all --strict → mv → validate --archived → spec:check
Де: `$W/wf_d86bbf00-154/agent-aa4410704bb297bfa.jsonl` (агент `archive`, add-catalog), рядок → час → команда → рядок результату:
```
:31 2026-10-04T11:41:55Z  pnpm exec openspec instructions archive --change "add-catalog" --json
:61 11:43:16Z  pnpm exec openspec validate --all --strict --no-interactive   → :63  ✓ change/add-basket  ✓ change/add-catalog  ✓ spec/catalog-api …
:68 11:43:26Z  … mv "$CHANGES/add-catalog" "$TARGET" …                     → :69  moved to openspec/changes/archive/2026-10-04-add-catalog
:74 11:43:31Z  pnpm exec openspec validate --archived --no-interactive       → :78  ✓ change/2026-10-04-add-catalog  Totals: 1 passed, 0 failed (1 items)
:75 11:43:32Z  pnpm spec:check                                              → :79  spec:check ok — specs: 3 · active changes: 1 · archived: 1
```
Та сама послідовність для add-basket — `$W/wf_87b3ded2-557/agent-a9f1037f8bcaf5a8a.jsonl:32` (12:35:11Z, `pnpm exec openspec instructions archive --change "add-basket" --json`), `:81`, `:82`;
для add-admin — `$W/wf_5e01c000-ed2/agent-aae89aa8309c25684.jsonl:31` (13:28:15Z, `pnpm exec openspec instructions archive --change "add-admin" --json`), `:107`, `:108`, `:109` → результат у рядку 112:
```
spec:check ok — specs: 8 · active changes: 0 · archived: 3
```
Той самий рядок — у `docs/pr-description.md:60`, і його дає `pnpm spec:check` зараз (виконано під час написання цього файлу).
Що це показує: архів — не «перенесли папку»: кожен крок перевірено CLI, а `scripts/spec-check.mjs:39` падає з «archived change(s) but openspec/specs/ is empty», якщо архів не дав специфікації.

## 3. Як відтворити
```
cd /Users/elikafilin/Documents/home_projects/organic-shop-orchestrator && git log --reverse --format='%h %ad %s' --date=iso | sed -n '5,21p'; git show e869183 --stat | tail -15
git show bae6571 -- submissions/elika-filin/openspec/changes/add-catalog/specs/shop-adapters/spec.md | grep -n 'Application-Instance\|tenant header'
git show 347e42b -- submissions/elika-filin/openspec/changes/add-basket/specs/basket-api/spec.md | grep -n 'rounded'; sed -n '15p' submissions/elika-filin/docs/reviews/2026-10-04-add-basket-code-reviewer.md
git show 183127e -- submissions/elika-filin/openspec/changes/add-basket/specs/basket-web/spec.md | grep -n 'a%23b\|stays literal'
cd submissions/elika-filin && pnpm spec:check && grep -n 'self-contradictory' docs/loops/2026-10-04T12-19-57-add-basket.md
grep -c 'pnpm exec openspec' .agent-log/actions.jsonl; grep -c openspec .agent-log/actions.jsonl; grep -o openspec .agent-log/actions.jsonl | wc -l   # 0 · 286 · 314 на 14:47Z, §4
sed -n '288p;294p;372p' .agent-log/actions.jsonl; node -e 'const S=new Set();for(const l of require("fs").readFileSync(".agent-log/actions.jsonl","utf8").split("\n"))try{S.add(JSON.parse(l).session)}catch{};console.log(S.size)'   # сесій: 21 на 14:47Z
W=submissions/elika-filin/sessions/workflows
node -e 'const fs=require("fs"),p=require("path"),W=process.argv[1];for(const d of fs.readdirSync(W))if(d.startsWith("wf_"))for(const f of fs.readdirSync(p.join(W,d)))if(f.endsWith(".jsonl")&&f!="journal.jsonl")fs.readFileSync(p.join(W,d,f),"utf8").split("\n").forEach((l,i)=>{let o;try{o=JSON.parse(l)}catch{return}for(const c of (o.message?.content||[]))if(c.type=="tool_use"&&c.name=="Bash"&&/pnpm exec openspec/.test(c.input.command))console.log(d+"/"+f+":"+(i+1),o.timestamp,c.input.command.slice(0,120))})' "$W"
grep -n 'Failed to determine the application' /Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator/364dc8be-543d-4eb4-afd8-6b19b67b4f42.jsonl | cut -c1-60 | head -3
```

## 4. Чесно: чого не знайшли / що лише існує
- **`.agent-log/actions.jsonl` не містить жодного `pnpm exec openspec`** — станом на 2026-10-04T14:47Z (1563 рядки): `grep -c 'pnpm exec openspec'` → 0; `grep -c openspec` → 286 рядків, `grep -o openspec | wc -l` → 314 входжень: 305 — шлях `openspec/changes/…`, 9 — каталог `openspec`/`openspec/specs` як аргумент `ls`, `git diff --`, `grep -rn` (рядки 494–495, 897–898, 1452); жодне — виклик CLI. Причина: hook `log-action.mjs` пише лише в сесіях, де project dir = `submissions/elika-filin` (`scripts/loop.mjs`, `scripts/review.mjs` — `claude -p`). На той самий момент у журналі 21 сесія: 18 (перші дії 10:18Z–13:22Z) — імплементація й рецензенти, яким CLI не потрібен (галочки в `tasks.md` вони ставлять через `sed`/`perl`, напр. рядок 372, сесія `63ea697e`), і 3 короткі з 14:23–14:24Z (`1c9f6191`, `e9adb367`, `ecd3fd9a` — 13 рядків Read/Edit/Bash, теж без `openspec`). Журнал дописується, тож число сесій — лише на мітку часу; перерахунок — у §3. Proposer/archive-агенти — субагенти оркестратора, їхні CLI-виклики є **лише** в транскриптах (§2.2, 2.7). Тож пункт «CLI у actions.jsonl» доведено не журналом хуків, а транскриптами.
- Команду `pnpm exec openspec archive` **не викликали**: archive-агент злив дельти власним скриптом (`scratchpad/sync-specs.mjs`, `$W/wf_d86bbf00-154/agent-aa4410704bb297bfa.jsonl:52`) і зробив `mv` (рядок 68), після чого перевірив `validate --archived`. Це відповідає `.claude/commands/opsx/archive.md`, але самого CLI-кроку `archive` нема.
- Агент `openspec-docs` (dry-run у scratchpad до закріплення CLI, `$W/wf_dce6726d-ff2/agent-afde3d80acb2f207e.jsonl:85`) викликав **голий** `openspec new change add-product-catalog` поза репо; у репо голих викликів нема — `scripts/spec-check.mjs:44` їх ловить.
- Коміти 1–3 (`1084341`, `c9af6b1`, `cbee9be`, вересень) — шаблон курсу, не проєкт.
- Для add-admin «реальність не збіглася» не зафіксовано: специфікацію правили лише за code-review (`4c6189f`); live-smoke адмінки пройшов без змін спеки (`docs/session-notes.md:22`).

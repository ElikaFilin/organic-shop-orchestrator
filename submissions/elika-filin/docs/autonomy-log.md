# Журнал автономності — Organic Catalog

Рядок на кожну значну частину роботи: **задача → рівень довіри → хто вирішував → докази → чому саме цей рівень.**
Ведеться під час роботи, не перед здачею. Рівні — драбина курсу (1 Асистент · 2 Асистент→агент · 3 Агент ·
4 Агенти · 5 Автономні агенти).

## Записи

| # | Робота | Рівень | Хто вирішував | Докази | Чому саме цей рівень |
|---|--------|--------|---------------|--------|----------------------|
| 1 | вибір форми бекенду, джерела даних, сховища кошика, розташування в репо | 1 · Асистент | людина (4 питання агента → 4 відповіді, одна з них змінила обсяг: адмінка + перемикач live/snapshot) | цей файл; `docs/intent.md` | незворотні рішення про архітектуру — агент пропонує, людина вирішує |
| 2 | каркас workspace і перенесення харнесу курсу | 2 · Асистент→агент | агент правив файли сам; `pnpm add` — за правилом allow-list | коміт `chore: harness…`; `pnpm check` зелений на порожньому каркасі; `pnpm hooks:selftest` | помилку ловить `pnpm check` за секунди, відкат — `git checkout` |
| 3 | дослідження: конспекти 3 занять, 10+10 товарів з двох магазинів, CLI OpenSpec 1.14 | 4 · Агенти | 9 паралельних сабагентів у workflow; кожен скрейпер мав незалежного перевіряльника (curl кожної картинки й сторінки товару, вибіркова звірка цін); людина звела результат | `data/shops/*.json` (поле `verifiedBy`); транскрипт workflow `wf_dce6726d-ff2` (9 агентів, 0 помилок, 2 перевіряльники → 0 знахідок) | читання і скрейпінг — зворотні дії без побічних ефектів; помилку в даних ловить перевіряльник, а не користувач |
| 4 | SDD: `/opsx:propose add-catalog` — proposal, 3 delta-специфікації (27 сценаріїв), design, 25 задач | 4 · Агенти | proposer-агент за `.claude/commands/opsx/propose.md`; 2 незалежних критики (testability, scope) → 8 blocker/major знахідок → reviser; людина прочитала proposal/tasks/spec перед комітом | коміт `docs(openspec): propose add-catalog` (специфікація **до** коду); `pnpm exec openspec validate --strict` → valid | артефакти планування — зворотні (git), ціна помилки низька; критик зловив ASCII-`\b` у regex і «холодний» `findProduct` до того, як це стало кодом |
| 5 | червоні тести сценаріїв `add-catalog` (група задач 1) | 3 · Агент | maker-агент написав 8 тест-файлів; checker-агент (окремий контекст, read-only) підтвердив: 27/27 сценаріїв покрито, падають з правильної причини (відсутні модулі), не через помилку в тесті | коміт `test(catalog): scenario tests first — red` з процитованим червоним прогоном | тести без реалізації нічого не ламають; «червоний → зелений» видно за порядком комітів |
| 6 | реалізація `add-catalog` до зеленого `pnpm check` | 3 · Агент (цикл) | `pnpm loop -- --change add-catalog --max-iter 5 --budget-usd 12`: свіжа сесія `claude -p` на ітерацію, гейт — `pnpm check` + усі задачі `[x]`; людина не втручається між ітераціями | `docs/loops/<дата>-add-catalog.md`, `.agent-log/loop.jsonl`, `.agent-log/actions.jsonl` (hooks у `-p`-режимі) | помилку ловить гейт за ~20 с; hooks (protect-env, stop-gate) тримають інваріанти без людини; бюджет і max-iter обмежують збитки |
| 7 | smoke-прогін наживо (`pnpm dev`, `curl /api/products`, браузер) | 1 · Асистент | людина (сесія власника) — єдиний крок, що б'є по справжніх магазинах | `docs/session-notes.md` (рядок «каталог», smoke); перший результат `osio:snapshot-fallback:10 ERR=osio: HTTP 400` | побічний ефект назовні (запити до чужих сайтів) і єдине місце, де видно, що специфікація розійшлася з реальністю — fallback спрацював «правильно» і сховав помилку від гейта |
| 8 | специфікацію змінено після реальності: заголовок `Application-Instance` для OSIO; + 6 знахідок code-reviewer, 1 — spec-reviewer | 1 · Асистент → 3 · Агент | людина вирішила, що приймати (усі 6 + уточнення «malformed item skipped» замість «fail the shop»), дописала сценарії й групи задач 8–9; реалізацію віддано циклу | коміт `docs(openspec): add-catalog — spec changed where reality disagreed`; `docs/reviews/2026-10-04-add-catalog-*.md`; другий прогін `docs/loops/2026-10-04T11-26-22-add-catalog.md` → зелений за 1 ітерацію, 40 тестів, $2.35 | рішення про обсяг — людські; код під гейтом — агентові |
| 9 | `/opsx:archive add-catalog` → `openspec/specs/{catalog-api,catalog-web,shop-adapters}` | 3 · Агент + 1 · людина читає `## Purpose` | archive-агент за `.claude/commands/opsx/archive.md` (sync дельт у головні специфікації, `mv` в архів), verify-агент звірив кожну вимогу/сценарій; людина прочитала три `## Purpose` і не правила | коміт `docs(openspec): archive add-catalog…`; `spec:check ok — specs: 3 · active changes: 1 · archived: 1`; `validate --all --strict`: 4 passed | архів переносить вимоги в джерело правди для наступних змін — тому окремий verify-агент і людське читання Purpose, а не «архівуй усе» |
| 10 | `add-basket`: propose (32 сценарії) → червоні тести → цикл → рев'ю | 4 · Агенти → 3 · Агент | propose: proposer + 2 критики + reviser; червоні тести: maker + checker (32/32 покрито); реалізація: `pnpm loop -- --change add-basket` — 1 ітерація, 100 ходів, 84 тести, $4.44; людина — smoke через curl і браузер | коміти `docs(openspec): propose add-basket`, `test(basket): … red`, `feat(basket)…`; `docs/loops/2026-10-04T12-06-56-add-basket.md`; `docs/reviews/2026-10-04-add-basket-*.md` | той самий детектор, що й у каталозі (гейт + stop-gate), той самий відкат; людина лишилась на рішеннях про обсяг і на smoke |
| 11 | `add-basket`, рев'ю → група задач 8: цикл зупинився сам — «специфікація суперечить сама собі» | 3 · Агент → 1 · Асистент (на одному пункті) | агент за 2 ітерації закрив 3 з 5 задач і **відмовився** правити специфікацію, щоб тест пройшов: сценарій URL-кодування вимагав `osio%3Aa%23b`, сусідні — буквальну `:`. Людина вирішила: `:` лишається буквальною | `docs/loops/2026-10-04T12-19-57-add-basket.md` (ітерація 2, stop=stuck); коміт `docs(openspec): add-basket — the loop stopped on a self-contradictory spec; owner decided` | правило з промпту циклу «не правити специфікацію заради зеленого тесту» спрацювало як гальмо: рішення про контракт — людське, навіть на рівні 3 |
| 12 | `/opsx:archive add-basket` + `/opsx:propose add-admin` (51 сценарій, MODIFIED-блок у catalog-api) | 4 · Агенти | archive-агент + verify-агент; proposer + 2 критики + reviser; людина прочитала `## Purpose` basket-api / basket-web і додала до обсягу адмінки «layout polish» (темна тема нечитабельна — побачено на smoke) | коміти `docs(openspec): archive add-basket…`, `docs(openspec): propose add-admin…`; `spec:check ok — specs: 5 · active changes: 1 · archived: 2` | ті самі причини, що в рядках 4 і 9 |
| 13 | `add-admin`: червоні тести (70 тестів на 51 сценарій) → цикл → рев'ю | 3 · Агент (цикл) | maker + checker для тестів; `pnpm loop -- --change add-admin` — 1 ітерація, 110 ходів, 178 тестів зелені, $6.38; людина — smoke адмінки з тестовим токеном через змінну середовища (не `.env` — hook) | коміт `test(admin): … red`, `docs/loops/2026-10-04T13-08-22-add-admin.md`, `docs/reviews/2026-10-04-add-admin-*.md` | детектор той самий; secret у `.env` агент не торкається — токен для smoke передано процесу напряму |
| 14 | рев'ю `add-admin`: code-reviewer FIX FIRST (7), spec-reviewer READY | 1 · Асистент (рішення) → 3 · Агент (цикл) | людина прийняла 6 знахідок (зіпсований файл налаштувань не кладе магазин; `findProduct` по повному списку, щоб прихований товар не зникав із кошика; повідомлення панелі; N+1) і **відхилила** одну: nonce/термін у підписі admin-куки — для локального інструмента з одним адміном досить `Max-Age` + ротації токена | `docs/reviews/2026-10-04-add-admin-*.md`; коміт `docs(openspec): add-admin — code review folded in (task group 8)`; прогін циклу T13-2x | відхилення — свідоме і записане: рецензент не вирішує обсяг, людина вирішує |
| 15 | `/opsx:archive add-admin` → `openspec/specs/{admin-auth,admin-settings,admin-web}`, MODIFIED catalog-api, ADDED catalog-web; фінальний README і чернетка опису PR | 3 · Агент + 1 · людина читає `## Purpose` | archive-агент + verify-агент; людина прочитала 5 `## Purpose`, написала README/PR-опис із картою доказів | коміт `docs(openspec): archive add-admin…`; `spec:check ok — specs: 8 · active changes: 0 · archived: 3`; `pnpm check`: 182 тести | як у рядках 9 і 12 |
| 16 | докази використання: `docs/evidence/*.md` з транскриптів 22 сесій `claude -p`, журналів workflow і `.agent-log`; 4 навмисні сесії для hooks | 4 · Агенти + 1 · людина | 8 паралельних агентів-«копачів» + 8 верифікаторів (4 файли виправлено після спростування) ; людина запустила 4 демо-сесії (`.env`, `process.env`, Stop без перевірки, `cat` журналу) і написала `hooks-demo.md` | `docs/evidence/`, `scripts/transcript-grep.mjs` (`pnpm transcripts`), `.agent-log/actions.jsonl` рядки 1551–1563 | власник попросив «справжній доказ, що практики використовувались, а не існують»; виявилось, що hooks примусу під час роботи не спрацьовували — це записано чесно, і додано живу демонстрацію |
| 17 | перевірка «той самий застосунок у колеги»: свіжий клон `main` → `pnpm install --frozen-lockfile` → `pnpm check` → обидва сервери | 1 · Асистент | людина поставила питання; агент прогнав клон і знайшов, що API не читає `.env` (адмінка → 503 у колеги). Виправлення поза OpenSpec-зміною — одна функція `loadDotEnv` (`process.loadEnvFile`, без залежностей) + тест; людина мерджить гілку | гілка `fix/load-dotenv` (злита PR #3); `pnpm check` → 183 тести; у клоні після fix: login 204 з токеном із `.env` | дрібна правка з тестом; рівень 1, бо поза зміною і торкається конфігурації запуску. **Чесно:** злито без рецензента; рецензію прогнано заднім числом (рядок 19) |
| 18 | `.data/` у git: спільні налаштування адмінки для команди | 1 · Асистент | рішення власника («i need .data on git and admin settings»); агент зняв ігнор, поклав `admin-settings.json` з типовими значеннями і порожній `baskets.json` (тестові кошики не комітимо) | коміт на гілці `fix/load-dotenv`; README §1–2 | зміна того, що потрапляє в репозиторій, — людське рішення |
| 19 | аудит за RUBRIC.md (6 незалежних рецензентів ×2: на гілці і на `main`) → виправлення: рецензія PR #3 заднім числом (`--diff`), 2 знахідки виправлено, журнали workflow і виклики Context7 перенесено в `sessions/`, числа в README/PR вирівняно, формулювання про `.data` виправлено | 4 · Агенти → 1 · Асистент | власник вирішив, що виправляти (пункти 2–5), і сам править тіло PR #33 (агент не має прав) | `docs/rubric-audit-2026-10-04.md`; `docs/reviews/2026-10-04-post-submission-dotenv-code-reviewer.md`; гілка `fix/audit-notes` | аудит — читання; правки — дрібні й під гейтом |

## Зміни рівня

### Підвищення

Рядок 6 — реалізацію `add-catalog` піднято з 2 до 3 (цикл без людини між ітераціями) після того, як з'явився дешевий детектор: 27 червоних тестів сценаріїв + `spec:check` + hooks-selftest в одному `pnpm check`, і stop-gate hook, який не дає агентові «закінчити» без зеленого прогону. Підняли не тому, що «агент добре поводився», а тому, що ціна помилки впала до одного `git checkout`.

### Зниження

Рядок 7 — smoke-прогін наживо знижено до рівня 1: він робить запити до чужих сайтів (побічний ефект назовні), і жоден зелений тест нічого не каже про те, чи відповість магазин. Саме тут виявилось, що OSIO потребує заголовок `Application-Instance`, якого не було ні в специфікації, ні в тестах на фікстурах, — fallback на знімок спрацював «за специфікацією» і сховав проблему від `pnpm check`.

### Ескалація, якої свідомо не зроблено

Після двох зелених циклів поспіль спокусливо було пустити `/opsx:archive` у той самий цикл без рецензента. Не пустили: archive переносить вимоги в `openspec/specs/` (джерело правди для наступних змін), тому перед ним — окрема read-only сесія `spec-reviewer` і людське читання `## Purpose`.

## Постійні межі

Завжди рівень 1: зміна файлів харнесу (`.claude/settings.json`, hooks, правила); зміна залежностей і конфігурації
збірки; усе, що торкається `.env*` і секретів; `git push`.

## Що агент запропонував і що з цього не виконано

Один випадок, коли агент запропонував неправильне і це зупинили: під час propose `add-catalog` критик зловив у design.md
regex одиниці ваги з ASCII-`\b` (не збігається з жодною з 10 назв у `data/shops/karashynyard.json`) — виправлено до того,
як це стало кодом. Один випадок, коли агент зупинив себе сам: рядок 11 (суперечлива специфікація URL-кодування).

Вивід `pnpm agent:log` по `.agent-log/actions.jsonl` (станом на завершення аудиту, 2026-10-04 ~17:20Z):

```
Agent actions: 780 executed, 28 proposed but not executed, 4 failed — 22 session(s), 2026-10-04T10:18:08.527Z .. 2026-10-04T17:20:10.902Z
┌─────────┬─────────┬──────────┬──────────┬─────────┬────────┬──────────┬───────┐
│ (index) │ tool    │ proposed │ executed │ blocked │ failed │ time (s) │ files │
├─────────┼─────────┼──────────┼──────────┼─────────┼────────┼──────────┼───────┤
│ 0       │ 'Read'  │ 344      │ 344      │ 0       │ 0      │ 1.7      │ 86    │
│ 1       │ 'Edit'  │ 209      │ 208      │ 1       │ 0      │ 0.5      │ 48    │
│ 2       │ 'Bash'  │ 171      │ 144      │ 27      │ 4      │ 340.8    │ 0     │
│ 3       │ 'Write' │ 41       │ 41       │ 0       │ 0      │ 0.1      │ 39    │
│ 4       │ 'Grep'  │ 40       │ 40       │ 0       │ 0      │ 0.4      │ 0     │
│ 5       │ 'Glob'  │ 3        │ 3        │ 0       │ 0      │ 0.4      │ 0     │
└─────────┴─────────┴──────────┴──────────┴─────────┴────────┴──────────┴───────┘
Proposed but not executed (blocked by a hook, a rule or you):
  2026-10-04T11:13:39.224Z  Bash  for f in packages/shared/src/index.ts apps/api/src/config.ts apps/api/src/app.ts apps/api/src/app.test.ts apps/api/src/server.ts apps/api/src/config.test.ts apps/web/src/App.tsx apps/web/src/main.tsx 
  2026-10-04T11:13:40.754Z  Bash  for f in apps/api/src/shops/karashynyard.test.ts apps/api/src/shops/osio.test.ts apps/api/src/lib/snapshot.test.ts; do echo "===== $f"; cat -n "$f"; done
  2026-10-04T11:19:31.516Z  Bash  perl -0pi -e 's/^- \[ \] (2\.1|3\.1|3\.2|3\.3|4\.1|4\.2|4\.3|4\.4|5\.1|5\.2|6\.1|6\.2|6\.3|7\.1|7\.2) /- [x] $1 /gm' openspec/changes/add-catalog/tasks.md && grep -c '^- \[x\]' openspec/changes/add-ca
  2026-10-04T11:21:17.350Z  Bash  for f in apps/api/src/lib/cache.ts apps/api/src/lib/catalog.ts apps/api/src/lib/snapshot.ts apps/api/src/routes/products.ts apps/api/src/shops/types.ts; do echo "=== $f ==="; cat -n "$f"; done
  2026-10-04T11:21:18.536Z  Bash  for f in apps/api/src/shops/karashynyard.ts apps/api/src/shops/osio.ts; do echo "=== $f ==="; cat -n "$f"; done
  2026-10-04T11:22:36.347Z  Bash  pnpm vitest run --reporter=verbose 2>&1 | tail -50
  2026-10-04T11:22:52.744Z  Bash  grep -c . apps/api/fixtures/osio.json 2>/dev/null; node -e "const d=require('./data/shops/osio.json');console.log('osio snapshot products',d.products.length);const k=require('./data/shops/karashynyard
  2026-10-04T11:29:58.097Z  Bash  sed -i '' 's/^- \[ \] 9\./- [x] 9./' openspec/changes/add-catalog/tasks.md && grep -c '^- \[x\]' openspec/changes/add-catalog/tasks.md && grep -c '^- \[ \]' openspec/changes/add-catalog/tasks.md
  2026-10-04T11:33:06.577Z  Bash  find openspec/changes/add-catalog/specs -name '*.md' -exec sh -c 'echo "--- $1 ---"; cat "$1"' _ {} \;
  2026-10-04T11:35:04.886Z  Bash  node -e "const d=new DOMException('x','TimeoutError'); console.log('instanceof Error:', d instanceof Error); console.log(String(d));"
  2026-10-04T12:08:12.653Z  Bash  perl -pi -e 's/\(current \?\? EMPTY_BASKET\)\.items/current?.items ?? NO_ITEMS/; s/\(basket \?\? EMPTY_BASKET\)\.items/basket?.items ?? NO_ITEMS/' apps/api/src/lib/basket.ts && grep -n "NO_ITEMS" apps
  2026-10-04T12:09:54.350Z  Bash  sed -i '' -e '104s/- \[ \]/- [x]/' -e '113s/- \[ \]/- [x]/' -e '116s/- \[ \]/- [x]/' -e '123s/- \[ \]/- [x]/' -e '131s/- \[ \]/- [x]/' -e '137s/- \[ \]/- [x]/' openspec/changes/add-basket/tasks.md && 
  2026-10-04T12:12:33.587Z  Bash  pnpm vitest run --reporter=verbose apps/api/src/routes/basket apps/web/src/pages/BasketPage 2>&1 | grep -E "✓|×" | head -30
  2026-10-04T12:14:55.963Z  Bash  for f in apps/api/src/lib/basket.ts apps/api/src/lib/store/baskets.ts apps/api/src/routes/basket.ts; do echo "=== $f ==="; cat -n "$f"; done
  2026-10-04T12:15:13.873Z  Bash  for f in apps/web/src/basket/BasketContext.tsx apps/web/src/components/BasketLine.tsx apps/web/src/pages/BasketPage.tsx; do echo "=== $f ==="; cat -n "$f"; done
  2026-10-04T12:16:06.875Z  Bash  head -8 apps/web/src/components/ProductCard.tsx && echo "=== ids/prices ===" && node -e "const d=require('./data/shops/osio.json');console.log(d.products.slice(0,3).map(p=>[p.sourceId,p.price]));const
  2026-10-04T12:25:13.636Z  Bash  node -e "console.log(19.99*3, 0+19.99*3, 19.99+19.99+19.99)" && pnpm test 2>&1 | grep -E "^( ?(FAIL|✓|×|→)|.*(AssertionError|Unable to find|Test Files|Tests ))" | head -40
  2026-10-04T13:09:22.269Z  Bash  pnpm --filter @organic/shared typecheck 2>&1 | tail -5
  2026-10-04T13:15:16.489Z  Bash  perl -pi -e 's/^- \[ \] ([23456]\.\d)/- [x] $1/' openspec/changes/add-admin/tasks.md && grep -c "^- \[x\]" openspec/changes/add-admin/tasks.md && grep -n "^- \[ \]" openspec/changes/add-admin/tasks.md
  2026-10-04T13:16:51.808Z  Bash  node scripts/check-verdict.mjs 2>&1 | tail -3 ; echo "---exit:$?"
  2026-10-04T13:16:55.254Z  Bash  node scripts/check-verdict.mjs > /tmp/verdict.txt 2>&1; echo "exit=$?"; grep -niE "green|red|verdict" /tmp/verdict.txt | tail -5
  2026-10-04T13:22:35.177Z  Bash  cd /Users/elikafilin/Documents/home_projects/organic-shop-orchestrator/submissions/elika-filin && grep -n "findProducts\|console.error\|corrupt\|Corrupt" openspec/changes/add-admin/design.md openspec/
  2026-10-04T14:23:49.867Z  Edit  apps/api/src/routes/products.ts
  2026-10-04T17:18:57.807Z  Bash  cd /tmp && mkdir -p lefile && printf 'ADMIN_TOKEN=from-file\n' > lefile/.env && ADMIN_TOKEN=from-shell node -e "process.loadEnvFile('/tmp/lefile/.env'); console.log('precedence result:', process.env.A
  2026-10-04T17:19:02.705Z  Bash  node -e "require('node:fs').mkdirSync('/tmp/lefile2',{recursive:true});require('node:fs').writeFileSync('/tmp/lefile2/.env','ADMIN_TOKEN=from-file\n')" && ADMIN_TOKEN=from-shell node -e "process.loadE
  2026-10-04T17:19:10.645Z  Bash  node -e "process.env.ADMIN_TOKEN='from-shell'; require('node:fs').writeFileSync('/tmp/organic-probe.txt','ADMIN_TOKEN=from-file\n'); process.loadEnvFile('/tmp/organic-probe.txt'); console.log('node', 
  2026-10-04T17:20:08.452Z  Bash  ADMIN_TOKEN=shell-wins pnpm exec vitest run apps/api/src/config.test.ts 2>&1 | tail -30
  2026-10-04T17:20:10.902Z  Bash  env ADMIN_TOKEN=shell-wins pnpm exec vitest run --project api src/config.test.ts 2>&1 | tail -30
Failed:
  2026-10-04T11:16:53.077Z  Bash  exit=1  cat tsconfig.base.json tsconfig.json eslint.config.mjs apps/api/tsconfig.json apps/web/tsconfig.json packages/shared/tsconfig.json vitest.config.ts 2>/dev/null
  2026-10-04T11:20:14.429Z  Bash  exit=1  ls .agent-log && cat .agent-log/check-verdict.json 2>/dev/null
  2026-10-04T13:19:47.911Z  Bash  exit=1  sed -n '1,40p' apps/web/src/theme.test.ts; echo ===; sed -n '100,135p' apps/web/src/App.test.tsx; echo ===; cat apps/web/index.html; echo ===; cat apps/web/src/index.css; echo ===; cat apps/web/src/ro
  2026-10-04T17:19:58.303Z  Bash  exit=1  grep -n "engines\|\"node\"\|packageManager" package.json apps/*/package.json packages/*/package.json 2>/dev/null; echo "=== nvmrc/tool-versions ==="; ls -a | grep -i "nvmrc\|tool-versions\|node-versio
```

# Session notes — естафета між сесіями

Робота, яка мусить пережити вікно, живе у файлі. Це той файл.

**Протокол.** Кожна сесія **відкривається** читанням цих нотаток (hook `dynamic-context.mjs` підкладає рядок
«Починати наступну сесію з» у перший промпт) і **закривається** їх оновленням — до `/clear`, а не після.
Три секції: журнал прогресу, чекліст фіч, команда запуску. Більше нічого сюди не додаємо.

**Правило закриття пункту.** Пункт у чеклісті стає `[x]` **лише після наскрізної перевірки**, а не тоді, коли
код написано. Поруч із галочкою — команда й результат, які це доводять.

---

## 1. Журнал прогресу

Найновіший запис — зверху. Один запис на сесію, три рядки, без переказу розмови.

### 2026-10-04 · сесія `add-basket` — закриття групи задач 8

- **Зроблено:** останнє зауваження рев'ю (№7) закрито після рішення людини: `:` у шляху лишається літеральним,
  решта символів `productId` кодується. `api/client.ts` отримав `itemPath` —
  `encodeURIComponent(productId).replaceAll("%3A", ":")`; тест «Product id is URL-encoded in the path» спершу
  червоний (`expected '/api/basket/items/osio:a#b' to be '/api/basket/items/osio:a%23b'`), потім зелений.
  Задачі 8.1 і 8.3 — `[x]`, усі 26 задач `add-basket` закриті. `pnpm check` → 103 passed (18 файлів).
- **Не працює:** адмінки ще немає; у темній темі заголовки погано контрастні (виправити в `add-admin`, layout polish).
- **Починати наступну сесію з:** `/opsx:archive add-basket` (людина читає `## Purpose` архівованої специфікації),
  далі червоні тести `add-admin`.

### 2026-10-04 · сесія `add-basket` — рев'ю (група задач 8)

- **Зроблено:** вісім зауважень рев'ю згорнуто в код: `totals.sum` округлюється до копійок, перевірка наявності
  рядка перенесена всередину `store.update` (гонка «очистити + змінити кількість»), стор валідує кожен запис
  окремо (зіпсований рядок пропускається з `console.error`), `DATA_DIR: ""` падає одразу; на вебі ключ рядка
  `/basket` — лише `productId` (інпут кількості не втрачає фокус), невдала мутація показує «Не вдалося оновити
  кошик» (`role="status"`), кнопка «Додати в кошик» вимкнена під час запиту. Нові тести поряд із кодом:
  `apps/api/src/lib/basket.test.ts`, `apps/web/src/components/BasketLine.test.tsx`. `pnpm check` → 102 passed (18 файлів).
- **Не працює:** одне зауваження (№7, `encodeURIComponent` для `productId` у шляху) не реалізоване — специфікація
  `specs/basket-web/spec.md` суперечить сама собі: сценарій «Product id is URL-encoded in the path» вимагає
  `/api/basket/items/osio%3Aa%23b`, а сусідні сценарії — незакодованого `:` у шляху й у тексті помилки. Задачі
  8.1 і 8.3 лишились `[ ]` саме через це; специфікацію не чіпали.
- **Починати наступну сесію з:** рішення людини, який зі сценаріїв `basket-web` головний (кодувати `:` чи ні),
  далі `/opsx:archive add-basket` і червоні тести `add-admin`.

### 2026-10-04 · сесія `add-basket`

- **Зроблено:** зміну `add-basket` реалізовано повністю — схеми кошика в `@organic/shared`, `dataDir`/`DATA_DIR`
  у `config.ts`, атомарний JSON-стор `createBasketStore`, `createBasketService` (додати з мерджем і межею 99,
  змінити, видалити, очистити), `/api/basket` з кукою `basket_id` (httpOnly, 30 днів), клієнт із п'ятьма
  функціями, `BasketProvider` + лінк «Кошик (N)» у шапці, кнопка «Додати в кошик» на картці та сторінка
  `/basket`. `pnpm test` → 84 passed (16 файлів).
- **Не працює:** адмінки ще немає; у темній темі заголовки погано контрастні (виправити в `add-admin`, layout polish).
- **Починати наступну сесію з:** `/opsx:archive add-basket` (smoke виконано, рев'ю — див. `docs/reviews/`), далі червоні тести `add-admin`.

### 2026-10-04 · сесія `add-catalog`

- **Зроблено:** зміну `add-catalog` реалізовано повністю — схеми в `@organic/shared`, адаптери обох магазинів
  (`parseKarashynyardHtml`, `parseOsioJson`), snapshot-рідер, TTL-кеш, `createCatalogService`,
  `GET /api/products` + `/:id`, сторінка каталогу з React Router. Після smoke-прогону і двох рев'ю — ще 6 сценаріїв
  (заголовок OSIO, `unavailable`, retry snapshot, de-dup, malformed item, доступні назви лінків). `pnpm test` → 40 passed (12 файлів).
- **Не працює:** кошика й адмінки ще немає; у темній темі заголовки погано контрастні (виправити в `add-admin`, layout polish).
- **Починати наступну сесію з:** людський smoke-прогін із `tasks.md` → заміна `smoke (людина, 2026-10-04, після виправлення заголовка OSIO): `live [ 'karashynyard:live:10', 'osio:live:10' ] 20`; перший прогін дав `osio:snapshot-fallback:10 ERR=osio: HTTP 400` — специфікацію змінено (група задач 8)` у чеклісті →
  `/opsx:archive add-catalog`, далі `add-basket`.

### 2026-10-04 · сесія `capstone-старт`

- **Зроблено:** каркас pnpm-workspace (`apps/api` Hono, `apps/web` Vite+React, `packages/shared`), харнес
  курсу перенесено (hooks, allow-list, `.agent-log/`, `pnpm check`), OpenSpec закріплено як devDependency.
- **Не працює:** продуктів ще немає — жодного адаптера, кошика, адмінки.
- **Починати наступну сесію з:** `docs/intent.md` → `/opsx:propose add-catalog` (адаптери двох магазинів + каталог).

---

## 2. Чекліст фіч

`[x]` — тільки з доказом наскрізної перевірки в тому ж рядку.

- [x] каталог: 10 продуктів з karashynyard.com.ua і 10 з osio-organic.com.ua на головній — доказ: `pnpm test`
  → `✓ |api| src/routes/products.test.ts > GET /api/products > Snapshot mode serves the committed files 29ms`,
  `✓ |api| src/routes/products.test.ts > GET /api/products > Both shops live 4ms` (обидва перевіряють 20 продуктів,
  по 10 на магазин, `products[0].price` 665) і
  `✓ |web| src/pages/CatalogPage.test.tsx > CatalogPage > Two shops with products 112ms`; smoke (людина, 2026-10-04, після виправлення заголовка OSIO): `live [ 'karashynyard:live:10', 'osio:live:10' ] 20`; перший прогін дав `osio:snapshot-fallback:10 ERR=osio: HTTP 400` — специфікацію змінено (група задач 8)
- [x] кошик: додати, змінити кількість, видалити; зберігається між перезавантаженнями — доказ: `pnpm test`
  → `✓ |api| src/routes/basket.test.ts > Anonymous basket cookie > Request with the cookie reuses the basket 6ms`
  (та сама кука на другому запиті віддає той самий кошик, тобто перезавантаження),
  `✓ |api| src/routes/basket.test.ts > Basket contents and totals > Totals add up the lines 4ms`
  (2 × 665 + 1 × 195 = `{ count: 3, sum: 1525 }`) і
  `✓ |web| src/pages/BasketPage.test.tsx > BasketPage > Changing the quantity updates the line 26ms`
  (`updateBasketItem("karashynyard:1498486363994", 3)` → «Разом: 2190 ₴»); smoke (людина, 2026-10-04): `curl` з cookie-jar — 2×665 + 1×195 → `totals { count: 3, sum: 1525 }`, PATCH 3 → 2190, DELETE → 1995, 404/400 як у специфікації; у браузері «Додати в кошик» ×2 → «Кошик (2)» → `/basket` показує 2 рядки і «Разом: 860 ₴»
- [ ] адмінка `/admin`: токен, перемикач live/snapshot, видимість продуктів — доказ: ____

---

## 3. Команда запуску

```bash
pnpm install
cp .env.example .env     # ADMIN_TOKEN, CONTEXT7_API_KEY
pnpm dev                 # api http://localhost:4000 · web http://localhost:5173
pnpm check               # typecheck + lint + tests + spec:check + hooks:selftest — гейт «готово»
```

- Специфікації: `openspec/` — CLI лише як `pnpm exec openspec`; гейт — `pnpm spec:check` (входить у `pnpm check`).
- Журнал дій агента: `pnpm agent:log`. Hooks без агента: `pnpm hooks:selftest`.

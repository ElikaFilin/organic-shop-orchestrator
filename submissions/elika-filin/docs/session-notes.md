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

### 2026-10-04 · сесія `add-admin`

- **Зроблено:** `add-admin` реалізовано циклом за 1 ітерацію (110 ходів, $6.38): `ADMIN_TOKEN` у `config.ts`, підписана кука
  `admin_session`, стор `admin-settings.json`, `GET/PUT /api/admin/*`, видимість у `selectVisibleProducts` (MODIFIED-вимога
  каталогу), сторінка `/admin`, nav у шапці, примусова світла тема. `pnpm test` → 178 passed. Smoke (людина): login 204 /
  401 / guard 401; `/api/admin/products` — 131 + 62 товари; hide → `karashynyard:live:9`; snapshot ↔ live; у браузері панель із
  чекбоксами і «Видимих: 9».
- **Не працює:** список видимості прив'язаний до id конкретного джерела: масив, зібраний у режимі «наживо», у режимі «знімок»
  збігся лише з 1 товаром (`karashynyard:snapshot:1`) — за специфікацією («id, яких немає, ігноруються»), але для адміна
  несподівано. Кандидат на наступну зміну: окрема видимість на джерело або підказка в панелі.
- **Починати наступну сесію з:** `add-admin` архівовано, README і `docs/pr-description.md` готові. Людині: записати відео 1–2 хв, вписати ім'я, відкрити PR у форку курсу з посиланням на цей репозиторій; далі — кандидат на зміну «видимість на кожне джерело окремо» (див. README §7).

### 2026-10-04 · сесія `add-basket`

- **Зроблено:** `add-basket` — три прогони циклу (1 + 2 + 1 ітерації): кука `basket_id`, атомарний JSON-стор, сервіс кошика
  (мердж, межа 99, округлення до копійок), `/api/basket`, `BasketProvider`, «Кошик (N)», кнопка на картці, `/basket`.
  Другий прогін зупинився сам на суперечливій специфікації (URL-кодування `:`) — рішення людини, третій прогін закрив.
  `pnpm test` → 103 passed. Архівовано → `openspec/specs/basket-api`, `basket-web`.
- **Не працює:** адмінки ще не було; темна тема нечитабельна (перенесено в `add-admin`).
- **Починати наступну сесію з:** `/opsx:propose add-admin` (виконано того ж дня).

### 2026-10-04 · сесія `add-catalog`

- **Зроблено:** `add-catalog` — три прогони циклу по 1 ітерації: адаптери обох магазинів, snapshot + fallback + TTL-кеш,
  `GET /api/products`, сторінка каталогу. Після smoke наживо специфікацію змінено (заголовок `Application-Instance` для OSIO),
  після двох раундів рев'ю додано 7 сценаріїв. `pnpm test` → 47 passed. Архівовано → `openspec/specs/{catalog-api,catalog-web,shop-adapters}`.
- **Не працює:** кошика й адмінки ще не було.
- **Починати наступну сесію з:** червоні тести `add-basket`.

### 2026-10-04 · сесія `capstone-старт`

- **Зроблено:** каркас pnpm-workspace (`apps/api` Hono, `apps/web` Vite+React, `packages/shared`), харнес курсу перенесено
  (hooks, allow-list, `.agent-log/`, `pnpm check`), OpenSpec закріплено як devDependency, `docs/intent.md`.
- **Не працює:** продуктів ще не було — жодного адаптера, кошика, адмінки.
- **Починати наступну сесію з:** `docs/intent.md` → `/opsx:propose add-catalog`.

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
- [x] адмінка `/admin`: токен, перемикач live/snapshot, видимість продуктів — доказ: `pnpm test`
  → `✓ |api| src/routes/admin.test.ts > Admin login > Login with the right token sets the session cookie 15ms`
  (204 + підписана кука `admin_session=admin.YbVzf199LMuIAnqKLH3KL2DLV4kY4JiTTy8hVnqndK0%3D`),
  `✓ |api| src/routes/admin.test.ts > Change the data source > Switch to snapshot applies immediately 5ms`
  (`PUT /api/admin/settings` → каталог віддає `snapshot`, адаптери не викликані, файл містить `"dataSource": "snapshot"`),
  `✓ |api| src/routes/admin.test.ts > Toggle a product's visibility > Hide a visible product 3ms`
  (сховане «Філе індички» → 9 ids у файлі, каталог віддає 19 продуктів) і
  `✓ |web| src/pages/AdminPage.test.tsx > Product visibility checkboxes > Unticking hides a product 23ms`
  (`setProductVisibility("karashynyard:1498486363994", false)` → «Видимих: 1», чекбокс знято); smoke (людина, 2026-10-04): `curl` — login 204 з кукою `admin_session`, 401 на хибний токен і без куки; `GET /api/admin/products` → 131 + 62 товари; `PUT …/visibility {visible:false}` → `karashynyard:live:9`; `PUT /api/admin/settings {dataSource:"snapshot"}` → `source: snapshot`; у браузері `/admin` → форма → панель, «Видимих: 9», світла тема

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

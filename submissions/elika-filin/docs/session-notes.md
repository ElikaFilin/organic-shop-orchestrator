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
- [ ] кошик: додати, змінити кількість, видалити; зберігається між перезавантаженнями — доказ: ____
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

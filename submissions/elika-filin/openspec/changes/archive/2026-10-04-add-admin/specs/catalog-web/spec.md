# Spec Delta

## ADDED Requirements

### Requirement: Layout navigation and light color scheme
The layout header SHALL contain a `<nav>` with, in order, a link "Каталог" to `/`, the basket link
"Кошик (N)" to `/basket` (specified by `add-basket`, only placed here) and a link "Адмін" to `/admin`,
rendered on every route. The app SHALL force a light color scheme regardless of the OS setting:
`apps/web/src/index.css` declares `:root { color-scheme: light; }` and the document body carries the
Tailwind classes `bg-white` and `text-stone-900`, so headings stay readable in dark mode.

#### Scenario: Header navigation on the catalog page
- **WHEN** `getProducts()` resolves with the "Two shops with products" response, `getBasket()` resolves with
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [], totals: { count: 0, sum: 0 } }` and route `/`
  is rendered
- **THEN** a `navigation` landmark contains exactly 3 links, in order: "Каталог" with `href="/"`,
  "Кошик (0)" with `href="/basket"` and "Адмін" with `href="/admin"`
- **AND** the same 3 links are rendered when route `/basket` is rendered with the same mocks

#### Scenario: Light color scheme is forced
- **WHEN** `apps/web/src/index.css` is read as text
- **THEN** it matches `/:root\s*\{[^}]*color-scheme:\s*light;?[^}]*\}/`
- **WHEN** `apps/web/index.html` is read as text
- **THEN** its `<body` tag has a `class` attribute containing both `bg-white` and `text-stone-900`

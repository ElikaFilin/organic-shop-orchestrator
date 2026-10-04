# Context7 log — динамічний контекст із MCP

Context7 (`.mcp.json`, HTTP MCP `https://mcp.context7.com/mcp`, ключ з `.env`) підкладає актуальну документацію
бібліотек у момент запиту. Нижче — кожен запит, який справді вплинув на код або план. Статичний контекст
(`AGENTS.md`, `.claude/rules/`) платиться на кожен запит; це — платиться лише при зверненні.

| # | Коли | Бібліотека (Context7 id) | Що питали | Що змінило |
|---|------|--------------------------|-----------|------------|
| 1 | 2026-10-04 · каркас | Hono (`/websites/hono_dev`) | `@hono/node-server` `serve()`, `getCookie/setCookie`, тестування через `app.request()` | `apps/api/src/server.ts` використовує `serve({ fetch, port })`; тести роутів — `createApp().request("/api/…")` без порту |
| 2 | 2026-10-04 · каркас | Vite (`/vitejs/vite`) | `server.proxy` для `/api` на інший порт, `@vitejs/plugin-react`, `@tailwindcss/vite` | `apps/web/vite.config.ts`: `proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true } }` |
| 3 | 2026-10-04 · каркас | Vitest (`/vitest-dev/vitest`) | `test.projects` для monorepo з різними environment | кореневий `vitest.config.ts` з `projects: ["apps/*", "packages/*"]`; `defineProject` у кожному пакеті (node / jsdom) — одна команда `pnpm test` |
| 4 | 2026-10-04 · перед add-admin | Hono (`/websites/hono_dev`) | `setSignedCookie` / `getSignedCookie` / `deleteCookie` — підпис HMAC, `httpOnly`, `sameSite` | дизайн адмін-сесії: підписаний cookie `admin_session` із секретом `ADMIN_TOKEN`, без сховища сесій |
| 5 | 2026-10-04 · перед add-catalog | React Router (`/websites/reactrouter`) | data mode у v8: `createBrowserRouter`, `RouterProvider`, `Link`, тести з `createMemoryRouter` | у v8 браузерний `RouterProvider` імпортується з `react-router/dom`, роутер — `createBrowserRouter([...])` поза React-деревом; у тестах сторінок — `createMemoryRouter(routes, { initialEntries })` + `RouterProvider` з `react-router`; записано в design.md зміни `add-catalog` |

Де видно, що це спрацювало: `.claude/settings.json` → `enabledMcpjsonServers: ["context7"]` і allow-list
`mcp__context7__*`; транскрипт сесії (виклики `mcp__context7__query-docs`); рядок у `AGENTS.md`
«Unsure about a library API … Ask Context7 before guessing».

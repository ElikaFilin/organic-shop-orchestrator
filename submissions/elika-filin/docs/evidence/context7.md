# Доказ використання · Практика #4 — MCP Context7 (динамічна документація)

Позначення: `T` = `/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator/364dc8be-543d-4eb4-afd8-6b19b67b4f42.jsonl`
(головна сесія `364dc8be-543d-4eb4-afd8-6b19b67b4f42`); `W` = `…/364dc8be-543d-4eb4-afd8-6b19b67b4f42/subagents/workflows`. Часи — UTC з поля `timestamp`.

## 1. Що доводимо

Агент не просто мав увімкнений сервер Context7, а **викликав** `mcp__context7__resolve-library-id` / `mcp__context7__query-docs` (17 викликів: 9 у головній
сесії, 8 у трьох субагентах), **отримав** відповіді і **далі писав код/дизайн, що повторює отримані факти**. Жоден із 17 викликів не відхилено і не завершився
помилкою (`is_error` відсутній у всіх відповідних `tool_result`).

## 2. Найсильніші докази

### 2.1 Запит про Hono → через 86 с після відповіді агент пише `server.ts` за отриманим зразком
Де: `T`, рядок 211 (`tool_use`, 2026-10-04T10:03:48.823Z) → результат рядок 214 (10:03:53.241Z) → код у рядку 236 (`Bash`, 10:05:19.892Z).
````
L214 result: ### Create and serve a basic Hono app in src/index.ts

Source: https://hono.dev/docs/getting-started/nodejs

Configures a root GET route using Hono and starts the HTTP server using serve from @hono/node-server.

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()…
L236 command: cat > apps/api/src/server.ts <<'EOF'
import { serve } from "@hono/node-server";
…
serve({ fetch: createApp().fetch, port: config.port }, (info) => {…
````
Що це показує: `serve` з `@hono/node-server` і тест `createApp().request("/api/health")` (той самий рядок 236) з'явилися одразу після документації; зараз `apps/api/src/server.ts:42`.

### 2.2 Vite `server.proxy` → `apps/web/vite.config.ts`
Де: `T`, рядок 212 (10:03:50.144Z) → результат рядок 216 (10:03:53.761Z) → рядок 236 (10:05:19.892Z).
````
L216 result: ### Configure dev server proxy rules with server.proxy

Source: https://github.com/vitejs/vite/blob/main/docs/config/server-options.md

Configure custom proxy rules for the dev server using string shorthands, options with path rewriting, RegExp keys, custom proxy configuration, and WebSocket support…
L236 command: cat > apps/web/vite.config.ts <<'EOF'
…
      "/api": { target: "http://localhost:4000", changeOrigin: true },
````
Що це показує: форма `'/api': { target, changeOrigin: true }` узята з прикладу у відповіді; зараз це `apps/web/vite.config.ts:10-11`.

### 2.3 Vitest: документація застерегла від вкладених `projects` → кореневий `projects` + `defineProject` у кожному пакеті
Де: `T`, рядок 213 (10:03:51.126Z) → результат рядок 215 (10:03:53.473Z) → рядок 236.
````
L215 result: ### Avoid inheriting test.projects in packages/app/vitest.config.ts

Source: https://github.com/vitest-dev/vitest/blob/main/docs/guide/migration/index.md

Merge a shared configuration without test.projects instead of the root configuration. Referenced configs declaring test.projects now produce nested projects instead of running as a single project.…
L236 command: cat > vitest.config.ts <<'EOF'
import { defineConfig } from "vitest/config";

// One `pnpm test` runs every package's own vitest.config (node for the API, jsdom for the web app).
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
````
Що це показує: пакети не імпортують кореневий конфіг (саме проти цього застерігає відповідь), а оголошують `defineProject` окремо; зараз `vitest.config.ts:6`.

### 2.4 React Router v8: запит у головній сесії + повторна перевірка субагентом → `main.tsx` імпортує `RouterProvider` з `react-router/dom`
Де: `T`, рядок 433 (10:18:28.611Z) → результат рядок 435 (10:18:46.563Z) → рядок 441 (10:18:56.046Z, заповнення рядка 5 логу);
субагент `W/wf_50339c24-2de/agent-af70c3d88dd7d71b7.jsonl` (agentId `af70c3d88dd7d71b7`), рядок 103 (10:27:46.534Z) → результат 106 (10:29:09.502Z) → design.md рядок 113 (10:31:55.838Z).
````
T L435 result: ### Configuring Data Mode with createBrowserRouter and RouterProvider

Source: https://reactrouter.com/start/modes

Move route configuration outside React rendering to enable data loaders, actions, pending states, and fetchers.…
agent-af70c3d88dd7d71b7 L106 result (fragment): import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
agent-af70c3d88dd7d71b7 L113 (design.md): `main.tsx` renders `<RouterProvider router={router} />` (`react-router` / `react-router/dom`); tests use
````
Що це показує: факт «у v8 браузерний `RouterProvider` — з `react-router/dom`» прийшов із Context7, потрапив у `openspec/changes/archive/2026-10-04-add-catalog/design.md:114`,
а звідти в код: `apps/web/src/main.tsx:3` — `import { RouterProvider } from "react-router/dom";` (коміт `d91e931`, 14:41 +03:00).

### 2.5 Субагент-пропонувальник кошика: читає встановлений серіалізатор, питає Context7, пише «Confirmed via Context7…» і сам додає рядок 6 у лог
Де: `W/wf_cbada62d-5be/agent-a33c492736106c1fe.jsonl` (agentId `a33c492736106c1fe`): рядок 76 (10:55:27.364Z) → 95 (11:05:18.019Z) → 100 (11:08:27.486Z) → 108 (11:10:06.016Z) → 111 (11:11:09.473Z).
````
L76 Bash: sed -n '1,200p' apps/api/node_modules/hono/dist/utils/cookie.js && echo "--- helper/cookie/index.js ---" && cat apps/api/node_modules/hono/dist/helper/cookie/index.js
L95 input: {"libraryId":"/websites/hono_dev","query":"setCookie options httpOnly path sameSite maxAge units (seconds) and getCookie reading the Cookie request header; testing with app.request passing a Cookie header"}
L100 result: ### setCookie(c, name, value, opt?)

Source: https://hono.dev/docs/helpers/cookie

Sets a regular HTTP cookie in the response context with optional configuration properties.
…  - `maxAge` (number) - Number of seconds until the cookie expires.
L108 thinking: Confirmed via Context7 that `maxAge` is in seconds and the option names align with the installed serializer, so the design's `Set-Cookie` line is correct as is. Now I'll recheck the change status, run strict validation to see if the `catalog-web` delta is accepted without `## Purpose`, write tasks.md from the specs and design, and log this Context7 query in docs/context7-log.md.
L111 Bash: perl -0pi -e 's/(\| 5 \| [^\n]*\n)/$1| 6 | 2026-10-04 · перед add-basket | Hono (`\/websites\/hono_dev`) | опції `setCookie` (`maxAge` — у секундах, …
````
Що це показує: агент явно пояснює, що саме Context7 підтвердив одиниці `maxAge`; результат — `openspec/changes/archive/2026-10-04-add-basket/design.md:30`
(«`maxAge` is **seconds**») і код `apps/api/src/routes/basket.ts:20-25` (`setCookie(c, "basket_id", id, { httpOnly: true, path: "/", sameSite: "Lax", maxAge: COOKIE_MAX_AGE_SECONDS })`).

### 2.6 Підписаний cookie для адмінки: запит до Context7 → дизайн add-admin посилається на рядок 4 логу → `admin.ts`
Де: `T`, рядок 422 (10:18:23.957Z) → результат рядок 424 (10:18:25.975Z); `openspec/changes/archive/2026-10-04-add-admin/design.md:34-35`; `apps/api/src/routes/admin.ts:9,19,40`.
````
T L424 result: ### setSignedCookie(c, name, value, secret, opt?)

Source: https://hono.dev/docs/helpers/cookie

Creates an HMAC SHA-256 signature and sets a signed cookie in the response context.…
design.md:34-35: (consistent with the Context7 query logged as row
4 of `docs/context7-log.md`): `setSignedCookie(c, name, value, secret, opts)` writes
admin.ts:40:     await setSignedCookie(c, COOKIE, "admin", secret, { ...COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE });
````
Що це показує: ланцюжок запит → лог → дизайн → код простежується по посиланнях, а не по пам'яті.

## 2A. Усі виклики Context7 у головній сесії `T` (sid `364dc8be-543d-4eb4-afd8-6b19b67b4f42`)
| рядок | timestamp | tool | libraryName / libraryId | query | результат |
|---|---|---|---|---|---|
| 197 | 10:03:41.681Z | resolve-library-id | `Hono` | Node.js server, cookie helper, testing with app.request, CORS middleware | L200 → `/websites/hono_dev` |
| 198 | 10:03:42.685Z | resolve-library-id | `Vite` | React TypeScript project setup, dev server proxy to API, Tailwind CSS 4 plugin | L207 → `/vitejs/vite` |
| 199 | 10:03:43.358Z | resolve-library-id | `Vitest` | workspace projects config for monorepo, jsdom environment, running all packages | L201 → `/vitest-dev/vitest` |
| 211 | 10:03:48.823Z | query-docs | `/websites/hono_dev` | Node.js server with @hono/node-server: serve(), getCookie/setCookie helpers with httpOnly options, and testing routes with app.request() in Vitest | L214 (2935 симв.) |
| 212 | 10:03:50.144Z | query-docs | `/vitejs/vite` | vite.config.ts server.proxy to forward /api requests to a backend on another port, with @vitejs/plugin-react and @tailwindcss/vite plugin | L216 (5542) |
| 213 | 10:03:51.126Z | query-docs | `/vitest-dev/vitest` | test.projects configuration in a root vitest.config to run multiple packages of a pnpm monorepo with different environments (node and jsdom) | L215 (4164) |
| 421 | 10:18:22.979Z | resolve-library-id | `React Router` | React Router v8 data mode: createBrowserRouter, RouterProvider, Link, useNavigate, testing with createMemoryRouter | L423 → `/websites/reactrouter` |
| 422 | 10:18:23.957Z | query-docs | `/websites/hono_dev` | setSignedCookie and getSignedCookie with a secret, httpOnly sameSite options, and deleteCookie | L424 (4593) |
| 433 | 10:18:28.611Z | query-docs | `/websites/reactrouter` | data mode in React Router 8: createBrowserRouter with route objects, RouterProvider, Link, and testing a route with createMemoryRouter in Vitest | L435 (5303) |

## 2B. Виклики Context7 субагентами (`W/wf_*/agent-*.jsonl`)
| файл (agentId) | рядок | timestamp | tool | libraryName / libraryId | query (скорочено) |
|---|---|---|---|---|---|
| `wf_dce6726d-ff2/agent-afde3d80acb2f207e.jsonl` | 31 | 09:47:42.890Z | resolve-library-id | `OpenSpec` | OpenSpec spec-driven development CLI Fission-AI init Claude Code slash commands propose apply archive |
| те саме | 45 | 09:48:13.595Z | query-docs | `/fission-ai/openspec` | openspec init for Claude Code: non-interactive --tools claude flag, what files it creates … |
| те саме | 46 | 09:48:15.471Z | query-docs | `/fission-ai/openspec` | spec.md markdown format: ## Purpose, ## Requirements, ### Requirement: name with SHALL, #### Scenario … validate --strict rules |
| те саме | 47 | 09:48:16.542Z | query-docs | `/fission-ai/openspec` | openspec/config.yaml project config: schema, context, rules per artifact (proposal, specs, design, tasks), language; full example |
| `wf_50339c24-2de/agent-af70c3d88dd7d71b7.jsonl` | 93 | 10:24:52.518Z | resolve-library-id | `React Router` | createBrowserRouter RouterProvider Outlet createMemoryRouter data router setup in react-router v8 |
| те саме | 103 | 10:27:46.534Z | query-docs | `/websites/reactrouter` | Library mode: createBrowserRouter with nested routes and Outlet layout, RouterProvider in main.tsx, and createMemoryRouter for component tests |
| `wf_cbada62d-5be/agent-a33c492736106c1fe.jsonl` | 85 | 11:00:56.588Z | resolve-library-id | `Hono` | setCookie getCookie helper options httpOnly maxAge sameSite path, testing with app.request and a Cookie header |
| те саме | 95 | 11:05:18.019Z | query-docs | `/websites/hono_dev` | setCookie options httpOnly path sameSite maxAge units (seconds) and getCookie reading the Cookie request header … |

Ланцюжок OpenSpec: рядок 45 → результат 52 (09:48:22.541Z, «openspec init --tools claude,cursor») → dry-run у рядку 66 (09:49:09.398Z: `openspec init --tools claude --no-animation`) → `T` L291 (10:11:01.025Z): `pnpm exec openspec init --tools claude --no-animation --force .`

## 2C. Звірка `docs/context7-log.md` з реальними викликами
| рядок логу (файл:рядок) | підтверджено викликом | код, що з'явився |
|---|---|---|
| 1 Hono `serve()` (`docs/context7-log.md:9`) | так — `T` L211 | `apps/api/src/server.ts:42` |
| 2 Vite proxy (`:10`) | так — `T` L212 | `apps/web/vite.config.ts:10-11` |
| 3 Vitest projects (`:11`) | так — `T` L213 | `vitest.config.ts:6` + `defineProject` у `apps/*/vitest.config.ts` |
| 4 Hono signed cookie (`:12`) | так — `T` L422 (10:18:23Z; підпис «перед add-admin» умовний — цикл add-admin стартував 13:08Z) | `apps/api/src/routes/admin.ts:9,19,40` |
| 5 React Router (`:13`) | так — `T` L421+L433, і повторно субагент af70c3d88dd7d71b7 L93+L103 | `apps/web/src/main.tsx:3,9`, `apps/web/src/router.tsx:20` |
| 6 Hono setCookie (`:14`) | так — субагент a33c492736106c1fe L85+L95; рядок дописав сам субагент (L111) | `apps/api/src/routes/basket.ts:20-25` |
| — (немає рядка) | 4 виклики OpenSpec-субагента afde3d80acb2f207e (09:47–09:48Z) у лог не потрапили | `T` L291 `openspec init --tools claude`, `openspec/config.yaml` |

Усі 6 рядків логу мають реальний `tool_use` + `tool_result`; вигаданих рядків немає. Лог створив сам агент (`T` L434, 10:18:44.308Z): рядки 1–4 постфактум,
рядок 5 спершу як `_(заповнюється після відповіді)_`, заповнений у L441 після результату L435.

## 3. Як відтворити

```bash
T=/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator/364dc8be-543d-4eb4-afd8-6b19b67b4f42.jsonl
W=/Users/elikafilin/.claude/projects/-Users-elikafilin-Documents-home-projects-organic-shop-orchestrator/364dc8be-543d-4eb4-afd8-6b19b67b4f42/subagents/workflows
for f in "$T" "$W"/wf_*/agent-*.jsonl; do node -e '
const L=require("fs").readFileSync(process.argv[1],"utf8").split("\n");
L.forEach((l,i)=>{let o;try{o=JSON.parse(l)}catch{return}
 for(const b of (o.message&&o.message.content)||[]) if(b.type==="tool_use"&&/context7/.test(b.name))
  console.log(process.argv[1].replace(/.*\//,""),"L"+(i+1),o.timestamp,b.name,JSON.stringify(b.input))});' "$f"; done
cd /Users/elikafilin/Documents/home_projects/organic-shop-orchestrator/submissions/elika-filin
grep -n proxy apps/web/vite.config.ts; grep -n 'serve(' apps/api/src/server.ts; grep -n projects vitest.config.ts; grep -n RouterProvider apps/web/src/main.tsx
grep -n 'maxAge\|SignedCookie' apps/api/src/routes/admin.ts apps/api/src/routes/basket.ts; cat -n docs/context7-log.md
```

## 4. Чесно: чого НЕ знайшли / що лише існує

- Фінальний код `main.tsx`, `admin.ts`, `basket.ts` писали вкладені `claude -p` цикли (`.agent-log/actions.jsonl:99` — `Write apps/web/src/main.tsx`, session `e5097db2`,
  11:18:54Z); їхніх транскриптів тут немає, тож зв'язок «документація → код» для цих файлів іде через `design.md`/`tasks.md`, а не через прямий `tool_result` → `Write`.
- Для кошика Context7 був підтвердженням, а не джерелом: субагент прочитав установлений `hono/dist/utils/cookie.js` (L76, 10:55Z) і написав design.md (L99, 11:08:25Z)
  у тому самому ході, що й запит (L95); відповідь нічого не змінила («the design's `Set-Cookie` line is correct as is», L108).
- Випадку, коли відповідь Context7 суперечила б наміру агента і змусила переписати вже написаний код, не знайдено; найближче — Vitest (2.3), де документація надійшла до конфігу.
- 4 виклики OpenSpec-дослідника (09:47–09:48Z) у `docs/context7-log.md` не задокументовані; лог самозвітний і написаний агентом.
- Лише існує, без окремого доказу спрацювання: `AGENTS.md:59-60` («Ask Context7 … before guessing from memory»), `.mcp.json:3-5` (`https://mcp.context7.com/mcp`,
  `${CONTEXT7_API_KEY}`), `.claude/settings.json:22-23,159` (allow-list і `enabledMcpjsonServers`). Значення ключа не перевірялося.

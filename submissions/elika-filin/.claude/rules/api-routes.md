# API route rules (always loaded — no `paths:` scope on purpose)

An unscoped rule is re-injected from disk after every compaction; a path-scoped one is summarized away.
This file describes style the agent may weigh against the task. Invariants that must hold regardless of the
window live in hooks, not here.

- One file per resource in `apps/api/src/routes/<resource>.ts`, exporting a `Hono` sub-app mounted in `src/app.ts`.
- Parse bodies and params with the zod schemas from `@organic/shared`; answer `400` with `{ error }` on a parse failure,
  `404` with `{ error }` when a product or basket line does not exist.
- Handlers call one function from `src/lib/` and return `c.json(...)`; no business logic, no file I/O in a handler.
- Stores (`src/lib/store/*.ts`) take their file path as a constructor argument so tests use a temp directory.
- The anonymous basket id lives in an `httpOnly` cookie `basket_id`; the admin session in `httpOnly` cookie `admin_session`.

# Web app rules (always loaded)

- Pages in `apps/web/src/pages/`, one component per route (`/`, `/basket`, `/admin`); routing with React Router.
- All server calls go through `apps/web/src/api/client.ts`; components never call `fetch` directly, so tests mock one module.
- Ukrainian UI copy. Accessible by default: buttons have names, lists are `<ul>`, quantity inputs are labelled,
  status messages use `role="status"`.
- Tailwind utility classes only; no CSS files beyond `index.css`.
- A component with a user-visible behaviour has a Testing Library test beside it that asserts a spec scenario.

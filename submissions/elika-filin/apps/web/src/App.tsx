import { Outlet } from "react-router";

/** The layout every route renders inside: the storefront heading and the active page. */
export function App() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Organic Catalog</h1>
      <Outlet />
    </main>
  );
}

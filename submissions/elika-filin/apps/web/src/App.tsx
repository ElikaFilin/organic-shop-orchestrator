import { Link, Outlet } from "react-router";
import { BasketProvider, useBasket } from "./basket/BasketContext";

function BasketLink() {
  const { count } = useBasket();
  return (
    <nav>
      <Link to="/basket" className="text-sm text-emerald-700 underline">
        Кошик ({count})
      </Link>
    </nav>
  );
}

/** The layout every route renders inside: the storefront heading, the basket link and the active page. */
export function App() {
  return (
    <BasketProvider>
      <main className="mx-auto max-w-5xl p-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Organic Catalog</h1>
          <BasketLink />
        </header>
        <Outlet />
      </main>
    </BasketProvider>
  );
}

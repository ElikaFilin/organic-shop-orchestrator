import { Link, Outlet } from "react-router";
import { BasketProvider, useBasket } from "./basket/BasketContext";

function Navigation() {
  const { count } = useBasket();
  return (
    <nav className="flex gap-4 text-sm text-emerald-700">
      <Link to="/" className="underline">
        Каталог
      </Link>
      <Link to="/basket" className="underline">
        Кошик ({count})
      </Link>
      <Link to="/admin" className="underline">
        Адмін
      </Link>
    </nav>
  );
}

/** The layout every route renders inside: the storefront heading, the navigation and the active page. */
export function App() {
  return (
    <BasketProvider>
      <main className="mx-auto max-w-5xl p-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Organic Catalog</h1>
          <Navigation />
        </header>
        <Outlet />
      </main>
    </BasketProvider>
  );
}

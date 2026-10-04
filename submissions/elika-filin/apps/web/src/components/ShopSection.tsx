import type { Product, ShopSummary } from "@organic/shared";
import { ProductCard } from "./ProductCard";

export function ShopSection({ shop, products }: { shop: ShopSummary; products: Product[] }) {
  const headingId = `shop-${shop.key}`;
  return (
    <section aria-labelledby={headingId} className="mt-8">
      <h2 id={headingId} className="text-xl font-semibold text-stone-900">
        <a href={shop.url} className="underline" target="_blank" rel="noreferrer">
          {shop.name}
        </a>
      </h2>
      {shop.status === "snapshot-fallback" && (
        <p role="status" className="mt-2 text-sm text-amber-700">
          Показано збережену копію
        </p>
      )}
      {shop.status === "unavailable" ? (
        <p role="status" className="mt-2 text-sm text-amber-700">
          Магазин тимчасово недоступний
        </p>
      ) : products.length === 0 ? (
        <p role="status" className="mt-2 text-sm text-stone-600">
          Немає товарів
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ul>
      )}
    </section>
  );
}

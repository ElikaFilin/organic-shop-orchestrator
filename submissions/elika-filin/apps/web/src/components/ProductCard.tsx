import type { Product } from "@organic/shared";

/** UAH exactly as the shops publish it — no digit grouping, no rounding. */
export function formatPrice(price: number): string {
  return `${price} ₴`;
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="flex flex-col rounded-lg border border-stone-200 bg-white p-3">
      <img
        src={product.imageUrl}
        alt={product.name}
        className="mb-3 aspect-square w-full rounded-md object-cover"
      />
      <h3 className="text-sm font-medium text-stone-900">{product.name}</h3>
      <p className="mt-1 text-xs text-stone-500">{product.unit}</p>
      <p className="mt-2 text-base font-semibold text-stone-900">{formatPrice(product.price)}</p>
      <a
        href={product.productUrl}
        aria-label={`У магазині: ${product.name}`}
        className="mt-3 text-sm text-emerald-700 underline"
        target="_blank"
        rel="noreferrer"
      >
        У магазині
      </a>
    </li>
  );
}

import { useId } from "react";
import type { AdminProduct, AdminShopSummary, ShopStatus } from "@organic/shared";

/** Where the shop's products come from — a label, not a live region: "Збережено" is the page's only status. */
const STATUS_NOTE: Record<ShopStatus, string> = {
  live: "наживо",
  snapshot: "знімок",
  "snapshot-fallback": "збережена копія",
  unavailable: "недоступний",
};

export interface AdminShopSectionProps {
  shop: AdminShopSummary;
  products: AdminProduct[];
  onToggle: (productId: string, visible: boolean) => void;
}

/** One shop in the admin panel: its heading, where its data comes from and a checkbox per product. */
export function AdminShopSection({ shop, products, onToggle }: AdminShopSectionProps) {
  const headingId = useId();
  // Counted from the flags the page holds, so the number and the ticks can never disagree.
  const visible = products.filter((product) => product.visible).length;

  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h3 id={headingId} className="text-lg font-semibold">
        {shop.name}
      </h3>
      <p className="text-sm text-stone-600">{STATUS_NOTE[shop.status]}</p>
      <p className="text-sm">Видимих: {visible}</p>
      {products.length > 0 && (
        <ul className="mt-2">
          {products.map((product) => (
            <li key={product.id}>
              <label className="flex items-center gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={product.visible}
                  onChange={(event) => onToggle(product.id, event.currentTarget.checked)}
                />
                {product.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

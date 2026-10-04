// Basket rules, free of Hono and of file I/O: the store and the catalog come in as values.
import type { AddBasketItem, BasketLine, BasketResponse, StoredBasket } from "@organic/shared";
import type { CatalogService } from "./catalog";
import type { BasketStore } from "./store/baskets";

const MAX_QUANTITY = 99;

/** A miss is a value, not an exception: the route maps it to 404 without a try/catch. */
export type BasketResult =
  | { ok: true; basket: BasketResponse }
  | { ok: false; error: "Product not found" | "Basket item not found" };

export interface BasketServiceOptions {
  store: BasketStore;
  catalog: Pick<CatalogService, "findProducts">;
  now: () => number;
}

export interface BasketService {
  get(id: string): Promise<BasketResponse>;
  addItem(id: string, item: AddBasketItem): Promise<BasketResult>;
  updateItem(id: string, productId: string, quantity: number): Promise<BasketResult>;
  removeItem(id: string, productId: string): Promise<BasketResult>;
  clear(id: string): Promise<BasketResponse>;
}

const NO_ITEMS: StoredBasket["items"] = [];

export function createBasketService({ store, catalog, now }: BasketServiceOptions): BasketService {
  const timestamp = () => new Date(now()).toISOString();

  /**
   * Joins every stored line with the catalog; totals ignore lines whose product is gone.
   * One catalog lookup for all the lines, so a twenty-line basket is still one catalog load.
   */
  async function toResponse(id: string, stored: StoredBasket | undefined): Promise<BasketResponse> {
    const lines = stored?.items ?? NO_ITEMS;
    const found = await catalog.findProducts(lines.map((line) => line.productId));
    const items: BasketLine[] = lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      product: found.get(line.productId) ?? null,
    }));
    const totals = items.reduce(
      (acc, line) =>
        line.product
          ? { count: acc.count + line.quantity, sum: acc.sum + line.product.price * line.quantity }
          : acc,
      { count: 0, sum: 0 },
    );
    // Kopiykas: a price like 1.1 ₴ must not leak binary float noise (1.1 × 3 = 3.3000000000000003) into the
    // response. Integer prices are unchanged by the rounding.
    return { id, items, totals: { ...totals, sum: Math.round(totals.sum * 100) / 100 } };
  }

  return {
    // A GET never creates a file entry: an unknown id simply reads as the empty basket.
    async get(id) {
      return toResponse(id, await store.get(id));
    },

    async addItem(id, { productId, quantity }) {
      // Resolved before the write, so a 404 leaves the basket untouched.
      const product = (await catalog.findProducts([productId])).get(productId);
      if (!product) return { ok: false, error: "Product not found" };
      const updatedAt = timestamp();
      const stored = await store.update(id, (current) => {
        const items = current?.items ?? NO_ITEMS;
        const existing = items.find((line) => line.productId === productId);
        return {
          updatedAt,
          items: existing
            ? items.map((line) =>
                line.productId === productId
                  ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + quantity) }
                  : line,
              )
            : [...items, { productId, quantity, addedAt: updatedAt }],
        };
      });
      return { ok: true, basket: await toResponse(id, stored) };
    },

    // The line must still be there when the write happens, so the check lives inside the queued update:
    // a concurrent clear or remove can no longer slip between a separate read and the write.
    async updateItem(id, productId, quantity) {
      const updatedAt = timestamp();
      const stored = await store.update(id, (basket) => {
        const items = basket?.items ?? NO_ITEMS;
        if (!items.some((line) => line.productId === productId)) return undefined;
        return {
          updatedAt,
          items: items.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
        };
      });
      if (!stored) return { ok: false, error: "Basket item not found" };
      return { ok: true, basket: await toResponse(id, stored) };
    },

    async removeItem(id, productId) {
      const updatedAt = timestamp();
      const stored = await store.update(id, (basket) => {
        const items = basket?.items ?? NO_ITEMS;
        if (!items.some((line) => line.productId === productId)) return undefined;
        return { updatedAt, items: items.filter((line) => line.productId !== productId) };
      });
      if (!stored) return { ok: false, error: "Basket item not found" };
      return { ok: true, basket: await toResponse(id, stored) };
    },

    async clear(id) {
      const stored = await store.update(id, () => ({ updatedAt: timestamp(), items: [] }));
      return toResponse(id, stored);
    },
  };
}

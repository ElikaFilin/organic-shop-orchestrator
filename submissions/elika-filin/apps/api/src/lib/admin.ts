// What the admin panel does with the catalog and the settings file. No Hono import.
import type {
  AdminProductsResponse,
  AdminSettings,
  AdminShopSummary,
  ProductVisibilityResponse,
  UpdateAdminSettings,
} from "@organic/shared";
import { visibleOfShop, type CatalogService } from "./catalog";
import type { AdminSettingsStore } from "./store/admin-settings";

export type SetVisibilityResult =
  | { ok: true; result: ProductVisibilityResponse }
  | { ok: false; error: "Product not found" };

export interface AdminService {
  getSettings(): Promise<AdminSettings>;
  updateSettings(input: UpdateAdminSettings): Promise<AdminSettings>;
  listProducts(): Promise<AdminProductsResponse>;
  setProductVisibility(id: string, visible: boolean): Promise<SetVisibilityResult>;
}

export interface AdminServiceOptions {
  catalog: Pick<CatalogService, "loadAll" | "setSource">;
  settings: AdminSettingsStore;
}

export function createAdminService({ catalog, settings }: AdminServiceOptions): AdminService {
  return {
    getSettings: () => settings.read(),

    async updateSettings({ dataSource }) {
      // Persist first: if the write fails the catalog is left as it was, in step with the file.
      const next = await settings.update((current) => ({ ...current, dataSource }));
      catalog.setSource(next.dataSource);
      return next;
    },

    async listProducts() {
      const inventory = await catalog.loadAll();
      const { visibility } = await settings.read();
      const shops: AdminShopSummary[] = [];
      const products: AdminProductsResponse["products"] = [];
      for (const shop of inventory.shops) {
        const visibleIds = new Set(visibleOfShop(shop.products, visibility[shop.key]).map((p) => p.id));
        shops.push({
          key: shop.key,
          name: shop.name,
          url: shop.url,
          status: shop.status,
          ...(shop.error === undefined ? {} : { error: shop.error }),
          total: shop.products.length,
          visible: visibleIds.size,
        });
        // Every upstream product is listed, flagged — the admin ticks beyond the first ten too.
        for (const product of shop.products) products.push({ ...product, visible: visibleIds.has(product.id) });
      }
      return { source: inventory.source, shops, products };
    },

    async setProductVisibility(id, visible) {
      const inventory = await catalog.loadAll();
      const shop = inventory.shops.find((candidate) => candidate.products.some((p) => p.id === id));
      // Nothing is written for an id no shop serves, so a typo cannot freeze the default rule into the file.
      if (!shop) return { ok: false, error: "Product not found" };
      const next = await settings.update((current) => {
        // The first toggle of a shop turns the implicit "first ten" rule into the explicit list it stood for.
        const chosen = current.visibility[shop.key] ?? visibleOfShop(shop.products, null).map((p) => p.id);
        const updated = visible
          ? chosen.includes(id)
            ? chosen
            : [...chosen, id]
          : chosen.filter((candidate) => candidate !== id);
        return { ...current, visibility: { ...current.visibility, [shop.key]: updated } };
      });
      return { ok: true, result: { id, visible, visibility: next.visibility[shop.key] ?? [] } };
    },
  };
}

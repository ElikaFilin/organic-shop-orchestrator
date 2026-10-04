import { Hono } from "hono";
import { createAdminService } from "./lib/admin";
import { createAdminAuth } from "./lib/admin-auth";
import { createBasketService } from "./lib/basket";
import type { CatalogService } from "./lib/catalog";
import type { AdminSettingsStore } from "./lib/store/admin-settings";
import type { BasketStore } from "./lib/store/baskets";
import { adminRoutes } from "./routes/admin";
import { basketRoutes } from "./routes/basket";
import { productsRoutes } from "./routes/products";

export interface AppDependencies {
  catalog: CatalogService;
  // Required on purpose: a call site that forgets the store fails typecheck instead of running on a default.
  basketStore: BasketStore;
  settingsStore: AdminSettingsStore;
  /** Required too, though it may be undefined: without a token the admin answers 503, never silently open. */
  adminToken: string | undefined;
  now?: () => number;
}

export function createApp({ catalog, basketStore, settingsStore, adminToken, now = Date.now }: AppDependencies) {
  const app = new Hono();
  app.get("/api/health", (c) => c.json({ ok: true, service: "organic-catalog-api" }));
  app.route("/api/products", productsRoutes(catalog));
  app.route("/api/basket", basketRoutes(createBasketService({ store: basketStore, catalog, now })));
  app.route(
    "/api/admin",
    adminRoutes(createAdminAuth({ adminToken }), createAdminService({ catalog, settings: settingsStore })),
  );
  return app;
}

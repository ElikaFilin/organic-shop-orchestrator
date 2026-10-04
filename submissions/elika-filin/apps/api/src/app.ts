import { Hono } from "hono";
import { createBasketService } from "./lib/basket";
import type { CatalogService } from "./lib/catalog";
import type { BasketStore } from "./lib/store/baskets";
import { basketRoutes } from "./routes/basket";
import { productsRoutes } from "./routes/products";

export interface AppDependencies {
  catalog: CatalogService;
  // Required on purpose: a call site that forgets the store fails typecheck instead of running on a default.
  basketStore: BasketStore;
  now?: () => number;
}

export function createApp({ catalog, basketStore, now = Date.now }: AppDependencies) {
  const app = new Hono();
  app.get("/api/health", (c) => c.json({ ok: true, service: "organic-catalog-api" }));
  app.route("/api/products", productsRoutes(catalog));
  app.route("/api/basket", basketRoutes(createBasketService({ store: basketStore, catalog, now })));
  return app;
}

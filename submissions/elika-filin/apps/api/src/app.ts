import { Hono } from "hono";
import type { CatalogService } from "./lib/catalog";
import { productsRoutes } from "./routes/products";

export interface AppDependencies {
  catalog: CatalogService;
}

export function createApp({ catalog }: AppDependencies) {
  const app = new Hono();
  app.get("/api/health", (c) => c.json({ ok: true, service: "organic-catalog-api" }));
  app.route("/api/products", productsRoutes(catalog));
  return app;
}

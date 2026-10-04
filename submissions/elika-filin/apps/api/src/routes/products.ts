import { Hono } from "hono";
import type { CatalogService } from "../lib/catalog";

/** Thin handlers: one call into src/lib, then JSON with the right status. */
export function productsRoutes(catalog: CatalogService) {
  const routes = new Hono();

  routes.get("/", async (c) => c.json(await catalog.load()));

  routes.get("/:id", async (c) => {
    const product = await catalog.findProduct(c.req.param("id"));
    if (!product) return c.json({ error: "Product not found" }, 404);
    return c.json(product);
  });

  return routes;
}

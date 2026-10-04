import { expect, test } from "vitest";
import { createApp } from "./app";
import type { CatalogService } from "./lib/catalog";

// The health route needs no catalog; a stub keeps the app's single dependency explicit.
const stubCatalog: CatalogService = {
  getSource: () => "snapshot",
  setSource: () => {},
  load: async () => ({ source: "snapshot", shops: [], products: [] }),
  findProduct: async () => undefined,
};

test("GET /api/health answers ok", async () => {
  const res = await createApp({ catalog: stubCatalog }).request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, service: "organic-catalog-api" });
});

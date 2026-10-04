import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createApp } from "./app";
import type { CatalogService } from "./lib/catalog";
import { createBasketStore } from "./lib/store/baskets";

// Neither dependency is used by the health route; both are stubbed to keep the app's wiring explicit.
const stubCatalog: CatalogService = {
  getSource: () => "snapshot",
  setSource: () => {},
  load: async () => ({ source: "snapshot", shops: [], products: [] }),
  findProduct: async () => undefined,
};

test("GET /api/health answers ok", async () => {
  const basketStore = createBasketStore(join(mkdtempSync(join(tmpdir(), "baskets-")), "baskets.json"));
  const res = await createApp({ catalog: stubCatalog, basketStore }).request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, service: "organic-catalog-api" });
});

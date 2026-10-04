import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultVisibility } from "@organic/shared";
import { expect, test } from "vitest";
import { createApp } from "./app";
import type { CatalogService } from "./lib/catalog";
import { createAdminSettingsStore } from "./lib/store/admin-settings";
import { createBasketStore } from "./lib/store/baskets";

// No dependency is used by the health route; all are stubbed to keep the app's wiring explicit.
const stubCatalog: CatalogService = {
  getSource: () => "snapshot",
  setSource: () => {},
  loadAll: async () => ({ source: "snapshot", shops: [] }),
  load: async () => ({ source: "snapshot", shops: [], products: [] }),
  findProduct: async () => undefined,
  findProducts: async () => new Map(),
};

test("GET /api/health answers ok", async () => {
  const basketStore = createBasketStore(join(mkdtempSync(join(tmpdir(), "baskets-")), "baskets.json"));
  const settingsStore = createAdminSettingsStore(
    join(mkdtempSync(join(tmpdir(), "admin-settings-")), "admin-settings.json"),
    { dataSource: "snapshot", visibility: defaultVisibility() },
  );
  const res = await createApp({
    catalog: stubCatalog,
    basketStore,
    settingsStore,
    adminToken: undefined,
  }).request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, service: "organic-catalog-api" });
});

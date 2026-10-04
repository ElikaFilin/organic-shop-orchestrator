import { join } from "node:path";
import { serve } from "@hono/node-server";
import { defaultVisibility, type Product } from "@organic/shared";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createTtlCache } from "./lib/cache";
import { createCatalogService } from "./lib/catalog";
import { createSnapshotSource } from "./lib/snapshot";
import { createAdminSettingsStore } from "./lib/store/admin-settings";
import { createBasketStore } from "./lib/store/baskets";
import { createKarashynyardAdapter } from "./shops/karashynyard";
import { createOsioAdapter } from "./shops/osio";

const config = loadConfig();
const shopFetch = (url: string, init?: { headers?: Record<string, string> }) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });

// What the admin saved wins over DATA_SOURCE; a corrupt settings file must not keep the storefront from
// booting — the defaults serve and the file a human has to fix is named on stderr.
const defaults = { dataSource: config.dataSource, visibility: defaultVisibility() };
const settingsStore = createAdminSettingsStore(join(config.dataDir, "admin-settings.json"), defaults);
const settings = await settingsStore.read().catch((error: unknown) => {
  console.error(`startup: cannot read ${settingsStore.filePath}, starting from the defaults`, error);
  return defaults;
});

const catalog = createCatalogService({
  source: settings.dataSource,
  shops: [
    { adapter: createKarashynyardAdapter({ fetch: shopFetch }), snapshotKey: "karashynyard" },
    { adapter: createOsioAdapter({ fetch: shopFetch }), snapshotKey: "osio" },
  ],
  snapshots: createSnapshotSource(config.snapshotDir),
  cache: createTtlCache<Product[]>({ ttlMs: 300_000, now: Date.now }),
  now: Date.now,
  settings: settingsStore,
});

const basketStore = createBasketStore(join(config.dataDir, "baskets.json"));
const app = createApp({ catalog, basketStore, settingsStore, adminToken: config.adminToken });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`organic-catalog-api listening on http://localhost:${info.port}`);
});

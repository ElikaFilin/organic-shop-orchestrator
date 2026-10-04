import { serve } from "@hono/node-server";
import type { Product } from "@organic/shared";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createTtlCache } from "./lib/cache";
import { createCatalogService } from "./lib/catalog";
import { createSnapshotSource } from "./lib/snapshot";
import { createKarashynyardAdapter } from "./shops/karashynyard";
import { createOsioAdapter } from "./shops/osio";

const config = loadConfig();
const shopFetch = (url: string, init?: { headers?: Record<string, string> }) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });

const catalog = createCatalogService({
  source: config.dataSource,
  shops: [
    { adapter: createKarashynyardAdapter({ fetch: shopFetch }), snapshotKey: "karashynyard" },
    { adapter: createOsioAdapter({ fetch: shopFetch }), snapshotKey: "osio" },
  ],
  snapshots: createSnapshotSource(config.snapshotDir),
  cache: createTtlCache<Product[]>({ ttlMs: 300_000, now: Date.now }),
  now: Date.now,
});

serve({ fetch: createApp({ catalog }).fetch, port: config.port }, (info) => {
  console.log(`organic-catalog-api listening on http://localhost:${info.port}`);
});

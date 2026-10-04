import {
  SHOP_KEYS,
  type CatalogResponse,
  type DataSource,
  type Product,
  type ShopKey,
  type ShopStatus,
  type ShopSummary,
} from "@organic/shared";
import type { ShopAdapter, ShopFetchResult } from "../shops/types";
import type { TtlCache } from "./cache";
import type { SnapshotSource } from "./snapshot";

/** One entry per configured shop: that shop's full upstream list, before the visibility rule. */
export type ShopProducts = { key: ShopKey; products: Product[] };

const VISIBLE_PER_SHOP = 10;

/**
 * The only place that decides which products the storefront shows: the first ten of each shop in upstream
 * order, shops concatenated in configured order. Pure, so `add-admin` replaces this function alone.
 */
export function selectVisibleProducts(perShop: ShopProducts[]): Product[] {
  return [...perShop]
    .sort((a, b) => SHOP_KEYS.indexOf(a.key) - SHOP_KEYS.indexOf(b.key))
    .flatMap((shop) => shop.products.slice(0, VISIBLE_PER_SHOP));
}

export interface CatalogShop {
  adapter: ShopAdapter;
  snapshotKey: ShopKey;
}

export interface CatalogServiceOptions {
  source: DataSource;
  shops: CatalogShop[];
  snapshots: SnapshotSource;
  cache: TtlCache<Product[]>;
  now: () => number;
}

export interface CatalogService {
  getSource(): DataSource;
  setSource(source: DataSource): void;
  load(): Promise<CatalogResponse>;
  findProduct(id: string): Promise<Product | undefined>;
}

interface ResolvedShop {
  key: ShopKey;
  products: Product[];
  status: ShopStatus;
  error?: string;
}

export function createCatalogService(options: CatalogServiceOptions): CatalogService {
  const { shops, snapshots, cache } = options;
  // A shop whose snapshot key is not its adapter key would serve another shop's products on every fallback.
  for (const shop of shops) {
    if (shop.adapter.shop.key !== shop.snapshotKey) {
      throw new Error(`catalog shop key mismatch: ${shop.adapter.shop.key} vs ${shop.snapshotKey}`);
    }
  }
  let source = options.source;
  // One adapter call per shop while it is in flight, so concurrent cold loads share it.
  const inFlight = new Map<ShopKey, Promise<ShopFetchResult>>();

  function fetchOnce(shop: CatalogShop): Promise<ShopFetchResult> {
    const key = shop.adapter.shop.key;
    const started = inFlight.get(key);
    if (started) return started;
    const call = shop.adapter.fetchProducts().finally(() => inFlight.delete(key));
    inFlight.set(key, call);
    return call;
  }

  /** The snapshot is the last resort: when it cannot be read the shop is reported, not thrown. */
  async function fromSnapshot(
    shop: CatalogShop,
    status: ShopStatus,
    error?: string,
  ): Promise<ResolvedShop> {
    const key = shop.adapter.shop.key;
    const failure = error === undefined ? {} : { error };
    try {
      return { key, products: await snapshots.read(shop.snapshotKey), status, ...failure };
    } catch {
      return { key, products: [], status: "unavailable", ...failure };
    }
  }

  async function resolveShop(shop: CatalogShop): Promise<ResolvedShop> {
    const key = shop.adapter.shop.key;
    if (source === "snapshot") return fromSnapshot(shop, "snapshot");

    const cached = cache.get(key);
    if (cached) return { key, products: cached, status: "live" };

    const result = await fetchOnce(shop);
    if (result.ok) {
      // Only successes are cached, so the next request retries a shop that was down.
      cache.set(key, result.products);
      return { key, products: result.products, status: "live" };
    }
    return fromSnapshot(shop, "snapshot-fallback", result.error);
  }

  async function load(): Promise<CatalogResponse> {
    const resolved = await Promise.all(
      shops.map(async (shop) => ({ shop, state: await resolveShop(shop) })),
    );
    const products = selectVisibleProducts(resolved.map(({ state }) => ({ key: state.key, products: state.products })));
    const summaries: ShopSummary[] = resolved.map(({ shop, state }) => ({
      key: state.key,
      name: shop.adapter.shop.name,
      url: shop.adapter.shop.url,
      status: state.status,
      ...(state.error === undefined ? {} : { error: state.error }),
      count: products.filter((product) => product.shopKey === state.key).length,
    }));
    return { source, shops: summaries, products };
  }

  return {
    getSource: () => source,
    setSource(next) {
      source = next;
    },
    load,
    // Goes through the same mode / cache / fallback path, so it answers on a cold service too.
    async findProduct(id) {
      return (await load()).products.find((product) => product.id === id);
    },
  };
}

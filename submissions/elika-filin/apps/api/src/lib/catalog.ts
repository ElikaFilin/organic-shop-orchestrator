import {
  SHOP_KEYS,
  defaultVisibility,
  type AdminSettings,
  type CatalogResponse,
  type DataSource,
  type Product,
  type ShopKey,
  type ShopStatus,
  type ShopSummary,
  type ShopVisibility,
} from "@organic/shared";
import type { ShopAdapter, ShopFetchResult } from "../shops/types";
import type { TtlCache } from "./cache";
import type { SnapshotSource } from "./snapshot";

/** One entry per configured shop: that shop's full upstream list, before the visibility rule. */
export type ShopProducts = { key: ShopKey; products: Product[] };

const VISIBLE_PER_SHOP = 10;

/**
 * The one place the visibility rule lives: `null` = the default first ten in upstream order, an array =
 * the ids the admin chose, served in upstream order (ids missing upstream are ignored).
 */
export function visibleOfShop(products: Product[], chosen: string[] | null): Product[] {
  return chosen === null
    ? products.slice(0, VISIBLE_PER_SHOP)
    : products.filter((product) => chosen.includes(product.id));
}

/**
 * Which products the storefront shows: `visibleOfShop` per shop, shops concatenated in configured order.
 * Pure; the default argument keeps the pre-admin one-argument call valid.
 */
export function selectVisibleProducts(
  perShop: ShopProducts[],
  visibility: ShopVisibility = defaultVisibility(),
): Product[] {
  return [...perShop]
    .sort((a, b) => SHOP_KEYS.indexOf(a.key) - SHOP_KEYS.indexOf(b.key))
    .flatMap((shop) => visibleOfShop(shop.products, visibility[shop.key]));
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
  /** The admin settings store in production, a stub or a temp-dir store in tests. */
  settings: { read(): Promise<AdminSettings>; filePath?: string };
}

/** Every shop resolved with its **full** upstream list, before the visibility rule — what the admin lists. */
export interface CatalogInventory {
  source: DataSource;
  shops: Array<{
    key: ShopKey;
    name: string;
    url: string;
    status: ShopStatus;
    error?: string;
    products: Product[];
  }>;
}

export interface CatalogService {
  getSource(): DataSource;
  setSource(source: DataSource): void;
  loadAll(): Promise<CatalogInventory>;
  load(): Promise<CatalogResponse>;
  findProduct(id: string): Promise<Product | undefined>;
  /** Every wanted id resolved in one catalog load, so a basket never loads the catalog per line. */
  findProducts(ids: string[]): Promise<Map<string, Product>>;
}

interface ResolvedShop {
  key: ShopKey;
  products: Product[];
  status: ShopStatus;
  error?: string;
}

export function createCatalogService(options: CatalogServiceOptions): CatalogService {
  const { shops, snapshots, cache, settings } = options;
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

  async function loadAll(): Promise<CatalogInventory> {
    const resolved = await Promise.all(
      shops.map(async (shop) => ({ shop, state: await resolveShop(shop) })),
    );
    return {
      source,
      shops: resolved.map(({ shop, state }) => ({
        key: state.key,
        name: shop.adapter.shop.name,
        url: shop.adapter.shop.url,
        status: state.status,
        ...(state.error === undefined ? {} : { error: state.error }),
        products: state.products,
      })),
    };
  }

  /**
   * One small file read per catalog load, so a manual edit of the settings file is picked up at once.
   * A settings file the schema rejects must not take the storefront down: the storefront serves the
   * default first ten and the failure is reported once, naming the file a human has to fix.
   */
  async function readVisibility(): Promise<ShopVisibility> {
    try {
      return (await settings.read()).visibility;
    } catch (error) {
      console.error(
        `catalog: cannot read ${settings.filePath ?? "admin-settings.json"}, serving the default visibility`,
        error,
      );
      return defaultVisibility();
    }
  }

  async function load(): Promise<CatalogResponse> {
    const inventory = await loadAll();
    const visibility = await readVisibility();
    const products = selectVisibleProducts(inventory.shops, visibility);
    const summaries: ShopSummary[] = inventory.shops.map((shop) => ({
      key: shop.key,
      name: shop.name,
      url: shop.url,
      status: shop.status,
      ...(shop.error === undefined ? {} : { error: shop.error }),
      count: products.filter((product) => product.shopKey === shop.key).length,
    }));
    return { source: inventory.source, shops: summaries, products };
  }

  /**
   * The **full** lists, not the served ones: a product the admin hid keeps its price in a basket and
   * still resolves by id. One `loadAll()` answers every wanted id, so a basket reads the catalog once.
   */
  async function findProducts(ids: string[]): Promise<Map<string, Product>> {
    const wanted = new Set(ids);
    const found = new Map<string, Product>();
    for (const shop of (await loadAll()).shops) {
      for (const product of shop.products) {
        if (wanted.has(product.id)) found.set(product.id, product);
      }
    }
    return found;
  }

  return {
    getSource: () => source,
    setSource(next) {
      source = next;
    },
    loadAll,
    load,
    findProducts,
    // Goes through the same mode / cache / fallback path, so it answers on a cold service too.
    async findProduct(id) {
      return (await findProducts([id])).get(id);
    },
  };
}

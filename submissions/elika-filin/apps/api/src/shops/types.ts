import type { Product, ShopKey } from "@organic/shared";

/** Identity of a shop as the catalog reports it. */
export interface ShopInfo {
  key: ShopKey;
  name: string;
  url: string;
}

/** An adapter never throws: an upstream problem comes back as `ok: false` with a "<shopKey>: <reason>" message. */
export type ShopFetchResult = { ok: true; products: Product[] } | { ok: false; error: string };

export interface ShopAdapter {
  shop: ShopInfo;
  fetchProducts(): Promise<ShopFetchResult>;
}

/** The slice of `fetch` the adapters use, so tests inject a stub instead of touching the network. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

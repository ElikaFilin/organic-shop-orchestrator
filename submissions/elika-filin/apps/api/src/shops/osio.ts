import { SHOPS, type Product } from "@organic/shared";
import type { FetchLike, ShopAdapter, ShopFetchResult } from "./types";

const SHOP_KEY = "osio";
const PRODUCTS_URL = "https://arsubs-production-1-back-t5tdi.ondigitalocean.app/v1/products";
const MAX_DESCRIPTION = 300;
// The shop's public tenant id, shipped in its own JS bundle; without it the API answers
// "400 Failed to determine the application".
const TENANT_HEADERS = { "Application-Instance": "3fc23022-4cf1-4d8b-a24c-c50e2651d4e0" };

interface OsioItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  unit: string;
  categoryName: string;
  description: string;
  isComingSoon: boolean;
}

function isOsioItem(value: unknown): value is OsioItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    typeof item.imageUrl === "string" &&
    typeof item.unit === "string" &&
    typeof item.categoryName === "string" &&
    typeof item.description === "string" &&
    typeof item.isComingSoon === "boolean"
  );
}

/** Collapse whitespace runs; over 300 characters, cut at the last space before position 300 and add "…". */
function shortenDescription(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_DESCRIPTION) return collapsed;
  const head = collapsed.slice(0, MAX_DESCRIPTION);
  const lastSpace = head.lastIndexOf(" ");
  return `${lastSpace === -1 ? head : head.slice(0, lastSpace)}…`;
}

function toProduct(item: OsioItem): Product {
  return {
    id: `${SHOP_KEY}:${item.id}`,
    shopKey: SHOP_KEY,
    shopName: SHOPS[SHOP_KEY].name,
    sourceId: item.id,
    name: item.name.trim(),
    price: item.price,
    currency: "UAH",
    imageUrl: item.imageUrl,
    productUrl: `https://osio-organic.com.ua/products/${item.id}`,
    description: shortenDescription(item.description),
    category: item.categoryName.trim(),
    unit: item.unit.trim(),
    inStock: !item.isComingSoon,
  };
}

/** Pure parser over the API body — the fixture tests call it without any fetch. */
export function parseOsioJson(body: string): ShopFetchResult {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return { ok: false, error: `${SHOP_KEY}: invalid JSON` };
  }
  if (!Array.isArray(payload)) return { ok: false, error: `${SHOP_KEY}: no products` };
  const products = payload.filter(isOsioItem).map(toProduct);
  if (products.length === 0) return { ok: false, error: `${SHOP_KEY}: no products` };
  return { ok: true, products };
}

export function createOsioAdapter({ fetch }: { fetch: FetchLike }): ShopAdapter {
  return {
    shop: { key: SHOP_KEY, ...SHOPS[SHOP_KEY] },
    async fetchProducts(): Promise<ShopFetchResult> {
      try {
        const response = await fetch(PRODUCTS_URL, { headers: TENANT_HEADERS });
        if (!response.ok) return { ok: false, error: `${SHOP_KEY}: HTTP ${response.status}` };
        return parseOsioJson(await response.text());
      } catch (error) {
        return { ok: false, error: `${SHOP_KEY}: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
  };
}

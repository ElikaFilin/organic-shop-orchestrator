import { BasketResponseSchema, CatalogResponseSchema, type BasketResponse, type CatalogResponse } from "@organic/shared";

/** Every server call goes through this module, so component tests mock one module. */
export async function getProducts(): Promise<CatalogResponse> {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error(`GET /api/products failed: ${response.status}`);
  return CatalogResponseSchema.parse(await response.json());
}

/** The basket id lives in an httpOnly cookie, so every basket call must send credentials. */
async function request(method: string, path: string, body?: unknown): Promise<BasketResponse> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status}`);
  return BasketResponseSchema.parse(await response.json());
}

export const getBasket = (): Promise<BasketResponse> => request("GET", "/api/basket");

// Every mutation answers the whole basket, so the caller never needs a second getBasket().
export const addToBasket = (productId: string, quantity: number): Promise<BasketResponse> =>
  request("POST", "/api/basket/items", { productId, quantity });

/**
 * Percent-encodes a product id for a path segment, except the ":" between shop key and source id:
 * RFC 3986 allows it literally in a path segment and the basket paths are pinned to the literal form.
 */
const itemPath = (productId: string): string =>
  `/api/basket/items/${encodeURIComponent(productId).replaceAll("%3A", ":")}`;

export const updateBasketItem = (productId: string, quantity: number): Promise<BasketResponse> =>
  request("PATCH", itemPath(productId), { quantity });

export const removeBasketItem = (productId: string): Promise<BasketResponse> =>
  request("DELETE", itemPath(productId));

export const clearBasket = (): Promise<BasketResponse> => request("DELETE", "/api/basket");

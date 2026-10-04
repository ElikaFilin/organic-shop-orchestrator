import {
  AdminProductsResponseSchema,
  AdminSessionSchema,
  AdminSettingsSchema,
  BasketResponseSchema,
  CatalogResponseSchema,
  ProductVisibilityResponseSchema,
  type AdminProductsResponse,
  type AdminSession,
  type AdminSettings,
  type BasketResponse,
  type CatalogResponse,
  type ProductVisibilityResponse,
  type UpdateAdminSettings,
} from "@organic/shared";

/** Carries the HTTP status, so a caller tells 401 from 503 without parsing the message. */
export class ApiError extends Error {
  constructor(
    method: string,
    path: string,
    readonly status: number,
  ) {
    super(`${method} ${path} failed: ${status}`);
    this.name = "ApiError";
  }
}

/** Every server call goes through this module, so component tests mock one module. */
export async function getProducts(): Promise<CatalogResponse> {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error(`GET /api/products failed: ${response.status}`);
  return CatalogResponseSchema.parse(await response.json());
}

/**
 * The basket id and the admin session live in httpOnly cookies, so every call sends credentials.
 * `schema` is typed structurally (every zod schema satisfies it): `zod` is a dependency of
 * `@organic/shared` only and does not resolve from apps/web.
 */
async function request<T>(
  method: string,
  path: string,
  options: { schema?: { parse(input: unknown): T }; body?: unknown } = {},
): Promise<T> {
  const { schema, body } = options;
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new ApiError(method, path, response.status);
  // No schema means a 204 answer: there is nothing to parse.
  return schema === undefined ? (undefined as T) : schema.parse(await response.json());
}

/**
 * Percent-encodes a product id for a path segment, except the ":" between shop key and source id:
 * RFC 3986 allows it literally in a path segment and the basket and admin paths are pinned to that form.
 */
const encodeProductId = (productId: string): string =>
  encodeURIComponent(productId).replaceAll("%3A", ":");

const itemPath = (productId: string): string => `/api/basket/items/${encodeProductId(productId)}`;

export const getBasket = (): Promise<BasketResponse> =>
  request("GET", "/api/basket", { schema: BasketResponseSchema });

// Every mutation answers the whole basket, so the caller never needs a second getBasket().
export const addToBasket = (productId: string, quantity: number): Promise<BasketResponse> =>
  request("POST", "/api/basket/items", { schema: BasketResponseSchema, body: { productId, quantity } });

export const updateBasketItem = (productId: string, quantity: number): Promise<BasketResponse> =>
  request("PATCH", itemPath(productId), { schema: BasketResponseSchema, body: { quantity } });

export const removeBasketItem = (productId: string): Promise<BasketResponse> =>
  request("DELETE", itemPath(productId), { schema: BasketResponseSchema });

export const clearBasket = (): Promise<BasketResponse> =>
  request("DELETE", "/api/basket", { schema: BasketResponseSchema });

export const getAdminSession = (): Promise<AdminSession> =>
  request("GET", "/api/admin/session", { schema: AdminSessionSchema });

export const adminLogin = (token: string): Promise<void> =>
  request<void>("POST", "/api/admin/login", { body: { token } });

export const adminLogout = (): Promise<void> => request<void>("POST", "/api/admin/logout");

export const getAdminSettings = (): Promise<AdminSettings> =>
  request("GET", "/api/admin/settings", { schema: AdminSettingsSchema });

export const updateSettings = (input: UpdateAdminSettings): Promise<AdminSettings> =>
  request("PUT", "/api/admin/settings", { schema: AdminSettingsSchema, body: input });

export const getAdminProducts = (): Promise<AdminProductsResponse> =>
  request("GET", "/api/admin/products", { schema: AdminProductsResponseSchema });

export const setProductVisibility = (
  productId: string,
  visible: boolean,
): Promise<ProductVisibilityResponse> =>
  request("PUT", `/api/admin/products/${encodeProductId(productId)}/visibility`, {
    schema: ProductVisibilityResponseSchema,
    body: { visible },
  });

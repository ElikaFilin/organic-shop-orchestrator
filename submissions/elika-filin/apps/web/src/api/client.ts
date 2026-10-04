import { CatalogResponseSchema, type CatalogResponse } from "@organic/shared";

/** Every server call goes through this module, so component tests mock one module. */
export async function getProducts(): Promise<CatalogResponse> {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error(`GET /api/products failed: ${response.status}`);
  return CatalogResponseSchema.parse(await response.json());
}

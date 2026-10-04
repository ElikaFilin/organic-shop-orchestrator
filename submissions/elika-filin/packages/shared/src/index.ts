// Shared contracts between apps/api and apps/web. Pure types and schemas only — no runtime I/O.
import { z } from "zod";

export const SHOP_KEYS = ["karashynyard", "osio"] as const;
export type ShopKey = (typeof SHOP_KEYS)[number];
export const ShopKeySchema = z.enum(SHOP_KEYS);

/** Display name and public URL of every shop, in the configured order of SHOP_KEYS. */
export const SHOPS: Record<ShopKey, { name: string; url: string }> = {
  karashynyard: { name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397" },
  osio: { name: "OSIO organic", url: "https://osio-organic.com.ua/" },
};

/** Prices are UAH numbers exactly as the shops publish them — never converted or rounded. */
export const ProductSchema = z.object({
  id: z.string(),
  shopKey: ShopKeySchema,
  shopName: z.string(),
  sourceId: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.literal("UAH"),
  imageUrl: z.string(),
  productUrl: z.string(),
  description: z.string(),
  category: z.string(),
  unit: z.string(),
  inStock: z.boolean(),
});
export type Product = z.infer<typeof ProductSchema>;

/**
 * "snapshot" is the chosen snapshot mode; "snapshot-fallback" means the shop's live source failed;
 * "unavailable" means its snapshot could not be read either, so the shop serves no products.
 */
export const ShopStatusSchema = z.enum(["live", "snapshot", "snapshot-fallback", "unavailable"]);
export type ShopStatus = z.infer<typeof ShopStatusSchema>;

export const ShopSummarySchema = z.object({
  key: ShopKeySchema,
  name: z.string(),
  url: z.string(),
  status: ShopStatusSchema,
  error: z.string().optional(),
  count: z.number().int(),
});
export type ShopSummary = z.infer<typeof ShopSummarySchema>;

export const DataSourceSchema = z.enum(["live", "snapshot"]);
export type DataSource = z.infer<typeof DataSourceSchema>;

export const CatalogResponseSchema = z.object({
  source: DataSourceSchema,
  shops: z.array(ShopSummarySchema),
  products: z.array(ProductSchema),
});
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

/** The shape of a committed snapshot file in data/shops/<key>.json. */
export const SnapshotFileSchema = z.object({
  shop: z.object({ key: ShopKeySchema, name: z.string(), url: z.string() }),
  fetchedAt: z.string(),
  products: z.array(ProductSchema.omit({ id: true, shopKey: true, shopName: true })),
});
export type SnapshotFile = z.infer<typeof SnapshotFileSchema>;

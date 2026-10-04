// Shared contracts between apps/api and apps/web. Pure types and schemas only — no runtime I/O.
export const SHOP_KEYS = ["karashynyard", "osio"] as const;
export type ShopKey = (typeof SHOP_KEYS)[number];

import { randomUUID } from "node:crypto";
import { AddBasketItemSchema, BasketIdSchema, ProductIdSchema, UpdateBasketItemSchema } from "@organic/shared";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { BasketService } from "../lib/basket";

const INVALID_BODY = { error: "Invalid request body" } as const;
const INVALID_PRODUCT_ID = { error: "Invalid product id" } as const;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function basketRoutes(service: BasketService) {
  const routes = new Hono<{ Variables: { basketId: string } }>();

  // Runs on 400 and 404 answers too, so a first visit always leaves with its cookie.
  routes.use("*", async (c, next) => {
    const parsed = BasketIdSchema.safeParse(getCookie(c, "basket_id"));
    const id = parsed.success ? parsed.data : randomUUID();
    if (!parsed.success) {
      // No `secure`: dev is http on localhost; a TLS deployment adds it in this one place.
      setCookie(c, "basket_id", id, {
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        maxAge: COOKIE_MAX_AGE_SECONDS,
      });
    }
    c.set("basketId", id);
    await next();
  });

  routes.get("/", async (c) => c.json(await service.get(c.get("basketId"))));

  routes.post("/items", async (c) => {
    // A body that is not JSON must read as "no body", not as a thrown request.
    const body = AddBasketItemSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json(INVALID_BODY, 400);
    const result = await service.addItem(c.get("basketId"), body.data);
    if (!result.ok) return c.json({ error: result.error }, 404);
    return c.json(result.basket, 201);
  });

  routes.patch("/items/:productId", async (c) => {
    // The path is checked before the body, so a malformed id always answers "Invalid product id".
    const productId = ProductIdSchema.safeParse(c.req.param("productId"));
    if (!productId.success) return c.json(INVALID_PRODUCT_ID, 400);
    const body = UpdateBasketItemSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json(INVALID_BODY, 400);
    const result = await service.updateItem(c.get("basketId"), productId.data, body.data.quantity);
    if (!result.ok) return c.json({ error: result.error }, 404);
    return c.json(result.basket);
  });

  routes.delete("/items/:productId", async (c) => {
    const productId = ProductIdSchema.safeParse(c.req.param("productId"));
    if (!productId.success) return c.json(INVALID_PRODUCT_ID, 400);
    const result = await service.removeItem(c.get("basketId"), productId.data);
    if (!result.ok) return c.json({ error: result.error }, 404);
    return c.json(result.basket);
  });

  routes.delete("/", async (c) => c.json(await service.clear(c.get("basketId"))));

  return routes;
}

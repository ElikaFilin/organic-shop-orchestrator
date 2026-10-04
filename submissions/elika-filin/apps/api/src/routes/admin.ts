import {
  AdminLoginSchema,
  ProductIdSchema,
  SetProductVisibilitySchema,
  UpdateAdminSettingsSchema,
} from "@organic/shared";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AdminService } from "../lib/admin";
import type { AdminAuth } from "../lib/admin-auth";

const INVALID_BODY = { error: "Invalid request body" } as const;
const INVALID_PRODUCT_ID = { error: "Invalid product id" } as const;
const UNAUTHORIZED = { error: "Unauthorized" } as const;

const COOKIE = "admin_session";
// No `secure`: dev is http on localhost; a TLS deployment adds it in this one place.
const COOKIE_OPTIONS = { httpOnly: true, path: "/", sameSite: "Lax" as const };
const SESSION_MAX_AGE = 43_200;

export function adminRoutes(auth: AdminAuth, service: AdminService) {
  const routes = new Hono();

  /** A session is the value `admin` signed with the admin token: no token configured, no session. */
  async function isAuthenticated(c: Context): Promise<boolean> {
    if (auth.secret === undefined) return false;
    return (await getSignedCookie(c, auth.secret, COOKIE)) === "admin";
  }

  routes.post("/login", async (c) => {
    // A body that is not JSON must read as "no body", not as a thrown request.
    const body = AdminLoginSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json(INVALID_BODY, 400);
    const result = auth.login(body.data.token);
    if (!result.ok) return c.json({ error: result.error }, result.error === "Invalid token" ? 401 : 503);
    const { secret } = auth;
    // `login` succeeds only with a configured token, so this narrows the signing secret rather than branching.
    if (secret === undefined) return c.json({ error: "Admin is not configured" }, 503);
    await setSignedCookie(c, COOKIE, "admin", secret, { ...COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE });
    return c.body(null, 204);
  });

  // Needs no session: clearing a cookie that is already gone is the same answer.
  routes.post("/logout", (c) => {
    deleteCookie(c, COOKIE, COOKIE_OPTIONS);
    return c.body(null, 204);
  });

  // Never 401: the page needs an answer about its session, not an error.
  routes.get("/session", async (c) => c.json({ authenticated: await isAuthenticated(c) }));

  const guard: MiddlewareHandler = async (c, next) => {
    if (!(await isAuthenticated(c))) return c.json(UNAUTHORIZED, 401);
    await next();
  };
  // Bound to the paths, not to registration order, so a later route cannot slip in front of the guard.
  routes.use("/settings/*", guard);
  routes.use("/products/*", guard);

  routes.get("/settings", async (c) => c.json(await service.getSettings()));

  routes.put("/settings", async (c) => {
    const body = UpdateAdminSettingsSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json(INVALID_BODY, 400);
    return c.json(await service.updateSettings(body.data));
  });

  routes.get("/products", async (c) => c.json(await service.listProducts()));

  routes.put("/products/:id/visibility", async (c) => {
    // The path is checked before the body, so a malformed id always answers "Invalid product id".
    const id = ProductIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json(INVALID_PRODUCT_ID, 400);
    const body = SetProductVisibilitySchema.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json(INVALID_BODY, 400);
    const result = await service.setProductVisibility(id.data, body.data.visible);
    if (!result.ok) return c.json({ error: result.error }, 404);
    return c.json(result.result);
  });

  return routes;
}

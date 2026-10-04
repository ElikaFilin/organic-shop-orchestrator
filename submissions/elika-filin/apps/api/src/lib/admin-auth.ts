// Who may enter the admin. No Hono import: the cookie itself is an HTTP concern and stays in the route.

export type AdminLoginResult = { ok: true } | { ok: false; error: "Admin is not configured" | "Invalid token" };

export interface AdminAuth {
  /** The signing secret — undefined means no admin is configured, so every session is rejected. */
  readonly secret: string | undefined;
  login(token: string): AdminLoginResult;
}

export function createAdminAuth({ adminToken }: { adminToken: string | undefined }): AdminAuth {
  return {
    secret: adminToken,
    login(token) {
      if (adminToken === undefined) return { ok: false, error: "Admin is not configured" };
      // One admin, local use and no rate limiting: a constant-time comparison would buy nothing here.
      return token === adminToken ? { ok: true } : { ok: false, error: "Invalid token" };
    },
  };
}

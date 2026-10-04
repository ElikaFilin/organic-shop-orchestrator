import { expect, test } from "vitest";
import { createAdminAuth } from "./admin-auth";

// The three login answers of the "Admin login" requirement, asserted on the function the route calls.

test("Unconfigured admin cannot log in", () => {
  const auth = createAdminAuth({ adminToken: undefined });

  expect(auth.secret).toBeUndefined();
  expect(auth.login("secret-token")).toEqual({ ok: false, error: "Admin is not configured" });
});

test("Wrong token is rejected", () => {
  expect(createAdminAuth({ adminToken: "secret-token" }).login("wrong-token")).toEqual({
    ok: false,
    error: "Invalid token",
  });
});

test("Right token is accepted", () => {
  const auth = createAdminAuth({ adminToken: "secret-token" });

  expect(auth.login("secret-token")).toEqual({ ok: true });
  // The token doubles as the cookie's signing secret.
  expect(auth.secret).toBe("secret-token");
});

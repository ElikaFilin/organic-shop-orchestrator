import { expect, test } from "vitest";
import { createApp } from "./app";

test("GET /api/health answers ok", async () => {
  const res = await createApp().request("/api/health");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, service: "organic-catalog-api" });
});

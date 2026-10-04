import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { loadConfig } from "./config";

test("Config reads DATA_SOURCE", () => {
  expect(loadConfig({}).dataSource).toBe("live");
  expect(loadConfig({ DATA_SOURCE: "snapshot" }).dataSource).toBe("snapshot");

  const invalid = () => loadConfig({ DATA_SOURCE: "foo" });
  expect(invalid).toThrow(Error);
  expect(invalid).toThrow(/^DATA_SOURCE must be "live" or "snapshot", got "foo"$/);
});

test("Config reads DATA_DIR", () => {
  // This test file sits next to config.ts, so the repository's .data resolves the same way from here.
  expect(loadConfig({}).dataDir).toBe(resolve(dirname(fileURLToPath(import.meta.url)), "../../../.data"));
  expect(loadConfig({ DATA_DIR: "/tmp/organic-baskets" }).dataDir).toBe("/tmp/organic-baskets");
});

test("Empty DATA_DIR fails fast", () => {
  const empty = () => loadConfig({ DATA_DIR: "" });
  expect(empty).toThrow(Error);
  expect(empty).toThrow(/^DATA_DIR must be a non-empty path$/);
});

test("Empty SNAPSHOT_DIR fails fast", () => {
  const empty = () => loadConfig({ SNAPSHOT_DIR: "" });
  expect(empty).toThrow(Error);
  expect(empty).toThrow(/^SNAPSHOT_DIR must be a non-empty path$/);

  expect(loadConfig({ SNAPSHOT_DIR: "/tmp/shops" }).snapshotDir).toBe("/tmp/shops");
  expect(loadConfig({}).snapshotDir).toMatch(/data[/\\]shops$/);
});

test("Config reads ADMIN_TOKEN", () => {
  expect(loadConfig({}).adminToken).toBeUndefined();
  expect(loadConfig({ ADMIN_TOKEN: "secret-token" }).adminToken).toBe("secret-token");
  // A blank token is "unset": the storefront runs without an admin instead of failing at startup.
  expect(loadConfig({ ADMIN_TOKEN: "   " }).adminToken).toBeUndefined();
});

import { expect, test } from "vitest";
import { loadConfig } from "./config";

test("Config reads DATA_SOURCE", () => {
  expect(loadConfig({}).dataSource).toBe("live");
  expect(loadConfig({ DATA_SOURCE: "snapshot" }).dataSource).toBe("snapshot");

  const invalid = () => loadConfig({ DATA_SOURCE: "foo" });
  expect(invalid).toThrow(Error);
  expect(invalid).toThrow(/^DATA_SOURCE must be "live" or "snapshot", got "foo"$/);
});

test("Empty SNAPSHOT_DIR fails fast", () => {
  const empty = () => loadConfig({ SNAPSHOT_DIR: "" });
  expect(empty).toThrow(Error);
  expect(empty).toThrow(/^SNAPSHOT_DIR must be a non-empty path$/);

  expect(loadConfig({ SNAPSHOT_DIR: "/tmp/shops" }).snapshotDir).toBe("/tmp/shops");
  expect(loadConfig({}).snapshotDir).toMatch(/data[/\\]shops$/);
});

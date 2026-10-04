import { expect, test } from "vitest";
import { loadConfig } from "./config";

test("Config reads DATA_SOURCE", () => {
  expect(loadConfig({}).dataSource).toBe("live");
  expect(loadConfig({ DATA_SOURCE: "snapshot" }).dataSource).toBe("snapshot");

  const invalid = () => loadConfig({ DATA_SOURCE: "foo" });
  expect(invalid).toThrow(Error);
  expect(invalid).toThrow(/^DATA_SOURCE must be "live" or "snapshot", got "foo"$/);
});

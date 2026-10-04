import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AdminSettings } from "@organic/shared";
import { afterEach, expect, test } from "vitest";
import { createAdminSettingsStore } from "./admin-settings";

const DEFAULTS: AdminSettings = { dataSource: "live", visibility: { karashynyard: null, osio: null } };

// The exact file of the "Reads persisted settings" scenario: snapshot mode, two chosen karashynyard ids.
const PERSISTED_FILE =
  '{"dataSource":"snapshot","visibility":{"karashynyard":["karashynyard:1743423686258","karashynyard:1498486363994"],"osio":null}}';
// Fails the schema: no visibility, and "foo" is neither data source.
const INVALID_FILE = '{"dataSource":"foo"}';

const dirs: string[] = [];

/** A fresh empty temp directory per test; the store gets `<tmp>/admin-settings.json` as a value. */
function newDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "admin-settings-"));
  dirs.push(dir);
  return dir;
}

function newStore(dir: string) {
  return createAdminSettingsStore(join(dir, "admin-settings.json"), {
    dataSource: "live",
    visibility: { karashynyard: null, osio: null },
  });
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("Missing file reads as defaults", async () => {
  const dir = newDir();
  const store = newStore(dir);

  await expect(store.read()).resolves.toEqual({
    dataSource: "live",
    visibility: { karashynyard: null, osio: null },
  });

  // A read never creates the file.
  expect(readdirSync(dir)).toEqual([]);
});

test("Reads persisted settings", async () => {
  const dir = newDir();
  writeFileSync(join(dir, "admin-settings.json"), PERSISTED_FILE);
  const store = newStore(dir);

  await expect(store.read()).resolves.toEqual({
    dataSource: "snapshot",
    visibility: { karashynyard: ["karashynyard:1743423686258", "karashynyard:1498486363994"], osio: null },
  });
});

test("Update writes atomically", async () => {
  const dir = newDir();
  const store = newStore(dir);
  let received: unknown = "callback not called";

  const result = await store.update((current) => {
    received = current;
    return { ...current, dataSource: "snapshot" };
  });

  const expected = { dataSource: "snapshot", visibility: { karashynyard: null, osio: null } };
  expect(received).toEqual(DEFAULTS);
  expect(result).toEqual(expected);
  // Temporary file renamed over the target: nothing else is left in the directory.
  expect(readdirSync(dir)).toEqual(["admin-settings.json"]);
  expect(JSON.parse(readFileSync(join(dir, "admin-settings.json"), "utf8"))).toEqual(expected);
  await expect(store.read()).resolves.toEqual(expected);
});

test("Invalid file content is an error", async () => {
  const dir = newDir();
  writeFileSync(join(dir, "admin-settings.json"), INVALID_FILE);
  const store = newStore(dir);

  await expect(store.read()).rejects.toBeInstanceOf(Error);

  // Never silently replaced: a human fixes or deletes the file.
  expect(readFileSync(join(dir, "admin-settings.json"), "utf8")).toBe('{"dataSource":"foo"}');
});

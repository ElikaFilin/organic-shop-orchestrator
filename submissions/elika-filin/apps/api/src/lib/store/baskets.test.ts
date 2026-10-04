import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { createBasketStore } from "./baskets";

const BASKET_A = "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc";
const BASKET_B = "6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f";

// The exact file of the "Reads a basket from an existing file" scenario: basket A with one karashynyard line.
const FILE_WITH_BASKET_A =
  '{"baskets":{"0f3c9d6e-7a1b-4c2d-9e8f-123456789abc":{"updatedAt":"2026-10-04T10:00:00.000Z","items":[{"productId":"karashynyard:1498486363994","quantity":2,"addedAt":"2026-10-04T10:00:00.000Z"}]}}}';

const basketA = {
  updatedAt: "2026-10-04T10:00:00.000Z",
  items: [{ productId: "karashynyard:1498486363994", quantity: 2, addedAt: "2026-10-04T10:00:00.000Z" }],
};

const VALID_RECORD = "11111111-1111-4111-8111-111111111111";
const CORRUPT_RECORD = "22222222-2222-4222-8222-222222222222";
const osioLine = { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, addedAt: "2026-10-04T10:00:00.000Z" };

// Two baskets, the second one holding a line whose productId is not "<shopKey>:<sourceId>".
const FILE_WITH_CORRUPT_RECORD = JSON.stringify({
  baskets: {
    [VALID_RECORD]: { updatedAt: "2026-10-04T10:00:00.000Z", items: [osioLine] },
    [CORRUPT_RECORD]: {
      updatedAt: "2026-10-04T10:00:00.000Z",
      items: [{ productId: "bad id", quantity: 1, addedAt: "2026-10-04T10:00:00.000Z" }],
    },
  },
});

const dirs: string[] = [];

/** A fresh empty temp directory per test; the store gets `<tmp>/baskets.json` as a value. */
function newStore() {
  const dir = mkdtempSync(join(tmpdir(), "baskets-"));
  dirs.push(dir);
  return { dir, file: join(dir, "baskets.json"), store: createBasketStore(join(dir, "baskets.json")) };
}

function readFile(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("Missing file means no baskets", async () => {
  const { dir, store } = newStore();

  await expect(store.get(BASKET_A)).resolves.toBeUndefined();

  expect(readdirSync(dir)).toEqual([]);
});

test("Reads a basket from an existing file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "baskets-"));
  dirs.push(dir);
  writeFileSync(join(dir, "baskets.json"), FILE_WITH_BASKET_A);
  const store = createBasketStore(join(dir, "baskets.json"));

  await expect(store.get(BASKET_A)).resolves.toEqual(basketA);
});

test("Update writes the basket to the file", async () => {
  const { file, store } = newStore();

  const written = await store.update(BASKET_A, () => basketA);

  expect(written).toEqual(basketA);
  expect(readFile(file)).toEqual({ baskets: { [BASKET_A]: basketA } });
  await expect(store.get(BASKET_A)).resolves.toEqual(basketA);
});

test("A corrupt record does not break other baskets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "baskets-"));
  dirs.push(dir);
  writeFileSync(join(dir, "baskets.json"), FILE_WITH_CORRUPT_RECORD);
  const store = createBasketStore(join(dir, "baskets.json"));
  // The skip is reported on stderr; the test owns the console so the run stays readable.
  const reported = vi.spyOn(console, "error").mockImplementation(() => {});

  await expect(store.get(VALID_RECORD)).resolves.toEqual({
    updatedAt: "2026-10-04T10:00:00.000Z",
    items: [osioLine],
  });
  await expect(store.get(CORRUPT_RECORD)).resolves.toEqual({ updatedAt: "2026-10-04T10:00:00.000Z", items: [] });

  expect(reported).toHaveBeenCalled();
  reported.mockRestore();
});

test("Write is atomic and keeps other baskets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "baskets-"));
  dirs.push(dir);
  writeFileSync(join(dir, "baskets.json"), FILE_WITH_BASKET_A);
  const store = createBasketStore(join(dir, "baskets.json"));
  const osioLine = { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, addedAt: "2026-10-04T10:05:00.000Z" };
  let received: unknown = "callback not called";

  await store.update(BASKET_B, (current) => {
    received = current;
    return { updatedAt: "2026-10-04T10:05:00.000Z", items: [...(current?.items ?? []), osioLine] };
  });

  expect(received).toBeUndefined();
  expect(readdirSync(dir)).toEqual(["baskets.json"]);
  expect(readFile(join(dir, "baskets.json"))).toEqual({
    baskets: {
      [BASKET_A]: basketA,
      [BASKET_B]: { updatedAt: "2026-10-04T10:05:00.000Z", items: [osioLine] },
    },
  });
});

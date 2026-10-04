import { expect, test } from "vitest";
import { createTtlCache } from "./cache";

// The 5-minute rule of "Live results are cached per shop for five minutes", asserted on the cache itself:
// a value stored at now = 0 is still a hit one millisecond before the TTL and a miss exactly on it.
test("Cached value expires after the TTL", () => {
  let time = 0;
  const cache = createTtlCache<string[]>({ ttlMs: 300000, now: () => time });

  cache.set("karashynyard", ["a"]);
  expect(cache.get("karashynyard")).toEqual(["a"]);

  time = 299999;
  expect(cache.get("karashynyard")).toEqual(["a"]);

  time = 300000;
  expect(cache.get("karashynyard")).toBeUndefined();
});

test("Unknown key is a miss", () => {
  const cache = createTtlCache<string[]>({ ttlMs: 300000, now: () => 0 });

  expect(cache.get("osio")).toBeUndefined();
});

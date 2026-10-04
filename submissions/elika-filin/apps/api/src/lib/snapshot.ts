import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SHOPS, SnapshotFileSchema, type Product, type ShopKey } from "@organic/shared";

export interface SnapshotSource {
  read(key: ShopKey): Promise<Product[]>;
}

async function readSnapshot(dir: string, key: ShopKey): Promise<Product[]> {
  const file = SnapshotFileSchema.parse(JSON.parse(await readFile(join(dir, `${key}.json`), "utf8")));
  return file.products.map((product) => ({
    ...product,
    id: `${key}:${product.sourceId}`,
    shopKey: key,
    shopName: SHOPS[key].name,
  }));
}

/** Reads the committed snapshots from a directory passed as a value — never from the environment. */
export function createSnapshotSource(dir: string): SnapshotSource {
  const pending = new Map<ShopKey, Promise<Product[]>>();
  return {
    read(key) {
      const memoized = pending.get(key);
      if (memoized) return memoized;
      // A rejection is never memoized: a snapshot written after a failed read is picked up on the next call.
      const started = readSnapshot(dir, key).catch((error: unknown) => {
        pending.delete(key);
        throw error;
      });
      pending.set(key, started);
      return started;
    },
  };
}

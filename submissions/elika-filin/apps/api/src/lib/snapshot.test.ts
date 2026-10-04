import { copyFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductSchema } from "@organic/shared";
import { expect, test } from "vitest";
import { createSnapshotSource } from "./snapshot";

// The committed snapshot directory, passed as a value — never read from the environment.
const snapshotDir = fileURLToPath(new URL("../../../../data/shops", import.meta.url));

test("Snapshot product normalizes to a Product", async () => {
  const products = await createSnapshotSource(snapshotDir).read("karashynyard");

  expect(products).toHaveLength(10);
  expect(products[0]).toEqual({
    id: "karashynyard:1498486363994",
    shopKey: "karashynyard",
    shopName: "Карашин Яр",
    sourceId: "1498486363994",
    name: "Філе індички, 1 кг",
    price: 665,
    currency: "UAH",
    imageUrl: "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg",
    productUrl: "https://karashynyard.com.ua/#rec638772397",
    description: "Ніжне філе без кістки для котлет, запікання, тушкування та дитячих страв.",
    category: "Індичка з вільного вигулу",
    unit: "1 кг",
    inStock: true,
  });
  expect(ProductSchema.safeParse(products[0]).success).toBe(true);
});

test("A failed snapshot read is retried", async () => {
  const dir = await mkdtemp(join(tmpdir(), "organic-snapshots-"));
  const source = createSnapshotSource(dir);

  await expect(source.read("osio")).rejects.toBeInstanceOf(Error);

  await copyFile(join(snapshotDir, "osio.json"), join(dir, "osio.json"));
  const products = await source.read("osio");

  expect(products).toHaveLength(10);
  expect(products[0]?.id).toBe("osio:6abcf192b7db2532803d266d");
});

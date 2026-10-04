// Every basket in one JSON file. No Hono import: the store is plain Node + the shared schema.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { StoredBasketLineSchema, StoredBasketSchema, type BasketsFile, type StoredBasket } from "@organic/shared";

export interface BasketStore {
  get(id: string): Promise<StoredBasket | undefined>;
  /**
   * Read → mutate → write as one step, so two requests for the same basket never lose an update and a
   * caller can decide inside the step. `mutate` returning `undefined` means "nothing to write".
   */
  update(
    id: string,
    mutate: (current: StoredBasket | undefined) => StoredBasket | undefined,
  ): Promise<StoredBasket | undefined>;
}

const EMPTY: BasketsFile = { baskets: {} };

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

/**
 * Keeps what is readable of one basket: a record whose shape is beyond repair is dropped, a record with a
 * corrupt line keeps its other lines. One buyer's bad record never takes the whole file down.
 */
function salvageBasket(id: string, value: unknown): StoredBasket | undefined {
  const candidate = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const head = StoredBasketSchema.safeParse({ updatedAt: candidate.updatedAt, items: [] });
  if (!head.success) {
    console.error(`baskets.json: basket ${id} is not readable and was skipped`);
    return undefined;
  }
  const stored = Array.isArray(candidate.items) ? candidate.items : [];
  const items = stored.flatMap((line) => {
    const parsed = StoredBasketLineSchema.safeParse(line);
    return parsed.success ? [parsed.data] : [];
  });
  if (items.length !== stored.length) {
    console.error(`baskets.json: basket ${id} lost ${stored.length - items.length} corrupt line(s)`);
  }
  return { updatedAt: head.data.updatedAt, items };
}

export function createBasketStore(filePath: string): BasketStore {
  // One promise chain for the whole file: `then(op, op)` keeps the queue alive after a failed write.
  let queue: Promise<unknown> = Promise.resolve();

  async function readAll(): Promise<BasketsFile> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      // A missing file means no baskets yet; anything else is a real failure and must surface.
      if (isMissingFile(error)) return EMPTY;
      throw error;
    }
    const parsed: unknown = JSON.parse(raw);
    const envelope = (parsed as { baskets?: unknown } | null)?.baskets;
    // A file that is not a baskets file at all still throws: that is a deployment mistake, not one bad basket.
    if (typeof envelope !== "object" || envelope === null) {
      throw new Error(`${filePath} is not a baskets file`);
    }
    const baskets: BasketsFile["baskets"] = {};
    for (const [id, value] of Object.entries(envelope)) {
      const basket = salvageBasket(id, value);
      if (basket) baskets[id] = basket;
    }
    return { baskets };
  }

  async function writeAll(file: BasketsFile): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, JSON.stringify(file, null, 2));
      // Same directory, so the replace is atomic: a reader sees the old or the new file, never a partial one.
      await rename(tmp, filePath);
    } catch (error) {
      await unlink(tmp).catch(() => undefined);
      throw error;
    }
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation, operation);
    queue = next.catch(() => undefined);
    return next;
  }

  return {
    get: (id) => enqueue(async () => (await readAll()).baskets[id]),
    update: (id, mutate) =>
      enqueue(async () => {
        const file = await readAll();
        const basket = mutate(file.baskets[id]);
        // The decision happens inside the queued step, so a concurrent clear cannot slip between the two.
        if (!basket) return undefined;
        await writeAll({ baskets: { ...file.baskets, [id]: basket } });
        return basket;
      }),
  };
}

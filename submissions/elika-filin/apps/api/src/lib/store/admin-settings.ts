// The admin's settings in one JSON file. No Hono import: plain Node + the shared schema.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AdminSettingsSchema, type AdminSettings } from "@organic/shared";

export interface AdminSettingsStore {
  /** The file behind the store, so a caller that falls back to the defaults can name it. */
  filePath: string;
  read(): Promise<AdminSettings>;
  /** Read → mutate → write as one step, so two concurrent toggles never lose an update. */
  update(mutate: (current: AdminSettings) => AdminSettings): Promise<AdminSettings>;
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

export function createAdminSettingsStore(filePath: string, defaults: AdminSettings): AdminSettingsStore {
  // One promise chain for the file: `then(op, op)` keeps the queue alive after a failed write.
  let queue: Promise<unknown> = Promise.resolve();

  async function readFileOrDefaults(): Promise<AdminSettings> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      // No file yet means the admin has never saved anything; anything else is a real failure.
      if (isMissingFile(error)) return structuredClone(defaults);
      throw error;
    }
    // A file that does not parse is never rewritten: the admin answers 500 until a human fixes it.
    return AdminSettingsSchema.parse(JSON.parse(raw));
  }

  async function write(next: AdminSettings): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmp, JSON.stringify(next, null, 2));
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
    filePath,
    // No in-memory cache: the file is a few hundred bytes and a manual edit must be picked up.
    read: () => enqueue(readFileOrDefaults),
    update: (mutate) =>
      enqueue(async () => {
        const next = mutate(await readFileOrDefaults());
        await write(next);
        return next;
      }),
  };
}

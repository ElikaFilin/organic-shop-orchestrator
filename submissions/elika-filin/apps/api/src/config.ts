// The ONLY file in apps/** allowed to touch process.env (enforced by .claude/hooks/protect-env.mjs).
// Everything else receives configuration as plain values, so tests never depend on the environment.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DataSourceSchema, type DataSource } from "@organic/shared";

export interface AppConfig {
  port: number;
  dataSource: DataSource;
  snapshotDir: string;
  dataDir: string;
  /** Undefined = no admin configured; declared non-optional so every call site passes it explicitly. */
  adminToken: string | undefined;
}

const DEFAULT_SNAPSHOT_DIR = fileURLToPath(new URL("../../../data/shops", import.meta.url));
/** Runtime JSON stores live in <repo>/.data (git-ignored); DATA_DIR points them elsewhere. */
const DEFAULT_DATA_DIR = fileURLToPath(new URL("../../../.data", import.meta.url));

/** `<repo>/.env` — copied from .env.example by a human; the agent never reads or edits it (hook + deny rule). */
const DEFAULT_DOTENV = fileURLToPath(new URL("../../../.env", import.meta.url));

/**
 * Loads KEY=value lines from the submission's `.env` into process.env with Node's built-in parser
 * (`process.loadEnvFile`, Node >= 20.12). Variables already set in the environment win, so
 * `ADMIN_TOKEN=x pnpm dev` still overrides the file. A missing file is a no-op and returns false.
 */
export function loadDotEnv(file: string = DEFAULT_DOTENV): boolean {
  if (!existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawDataSource = env.DATA_SOURCE ?? "live";
  const dataSource = DataSourceSchema.safeParse(rawDataSource);
  // Fail fast at startup beats silently serving the wrong source.
  if (!dataSource.success) {
    throw new Error(`DATA_SOURCE must be "live" or "snapshot", got "${rawDataSource}"`);
  }
  // An empty override would silently point the snapshot reader at the process's working directory.
  if (env.SNAPSHOT_DIR !== undefined && env.SNAPSHOT_DIR.trim() === "") {
    throw new Error("SNAPSHOT_DIR must be a non-empty path");
  }
  // Same for the stores: an empty override would write baskets next to whatever started the process.
  if (env.DATA_DIR !== undefined && env.DATA_DIR.trim() === "") {
    throw new Error("DATA_DIR must be a non-empty path");
  }
  return {
    port: Number(env.PORT ?? 4000),
    dataSource: dataSource.data,
    snapshotDir: env.SNAPSHOT_DIR ?? DEFAULT_SNAPSHOT_DIR,
    dataDir: env.DATA_DIR ?? DEFAULT_DATA_DIR,
    // A blank token means "no admin yet" — failing fast would block the storefront for a copied .env.
    adminToken:
      env.ADMIN_TOKEN !== undefined && env.ADMIN_TOKEN.trim() !== "" ? env.ADMIN_TOKEN : undefined,
  };
}

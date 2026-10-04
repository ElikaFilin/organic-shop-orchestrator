// The ONLY file in apps/** allowed to touch process.env (enforced by .claude/hooks/protect-env.mjs).
// Everything else receives configuration as plain values, so tests never depend on the environment.
import { fileURLToPath } from "node:url";
import { DataSourceSchema, type DataSource } from "@organic/shared";

export interface AppConfig {
  port: number;
  dataSource: DataSource;
  snapshotDir: string;
}

const DEFAULT_SNAPSHOT_DIR = fileURLToPath(new URL("../../../data/shops", import.meta.url));

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
  return {
    port: Number(env.PORT ?? 4000),
    dataSource: dataSource.data,
    snapshotDir: env.SNAPSHOT_DIR ?? DEFAULT_SNAPSHOT_DIR,
  };
}

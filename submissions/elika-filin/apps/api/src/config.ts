// The ONLY file in apps/** allowed to touch process.env (enforced by .claude/hooks/protect-env.mjs).
// Everything else receives configuration as plain values, so tests never depend on the environment.
export interface AppConfig {
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 4000),
  };
}

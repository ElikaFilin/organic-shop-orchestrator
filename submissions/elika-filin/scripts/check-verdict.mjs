#!/usr/bin/env node
// Wraps `pnpm check` and records its verdict in .agent-log/last-check.json, which the dynamic-context hook
// feeds back into the next prompt. Usage: node scripts/check-verdict.mjs  (same exit code as pnpm check).
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const r = spawnSync("pnpm", ["check"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } });
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
process.stdout.write(out);
const tests = out.match(/Tests\s+[^\n]+/g)?.at(-1)?.trim();
const spec = out.match(/spec:check (ok|FAILED)[^\n]*/)?.[0]?.trim();
const summary = [tests, spec].filter(Boolean).join(" · ");
mkdirSync(join(process.cwd(), ".agent-log"), { recursive: true });
writeFileSync(
  join(process.cwd(), ".agent-log", "last-check.json"),
  JSON.stringify({ ok: r.status === 0, exit: r.status, ts: new Date().toISOString(), summary }, null, 2) + "\n",
);
process.exit(r.status ?? 1);

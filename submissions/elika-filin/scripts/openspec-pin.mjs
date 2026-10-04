#!/usr/bin/env node
// OpenSpec generates skills and /opsx commands that call a bare `openspec`. Here the CLI is a pinned
// devDependency, so a bare call reaches a global install of another version — or "command not found" on a
// machine without one. This rewrites every call to `pnpm exec openspec`, the only form this repo allows.
// Idempotent. Run after `pnpm exec openspec init` or `pnpm exec openspec update`: `pnpm openspec:pin`.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// A call is `openspec <subcommand|--flag>` not already preceded by `exec `, and not part of a path or a
// longer name (`openspec/`, `openspec-propose`, `@fission-ai/openspec`). Capitalised prose ("OpenSpec") is left alone.
export const BARE_CALL = /(?<![\w./@-])(?<!exec )openspec (?=[a-z-])/g;

const ROOTS = [
  [".claude/skills", (name) => name.startsWith("openspec-")],
  [".claude/commands/opsx", () => true],
  [".agents/skills", (name) => name.startsWith("openspec-")],
];

export function generatedFiles(cwd = process.cwd()) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".md")) files.push(p);
    }
  };
  for (const [root, accept] of ROOTS) {
    const dir = join(cwd, root);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (!accept(name)) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".md")) files.push(p);
    }
  }
  return files;
}

export function pin(text) {
  return text
    .replace(BARE_CALL, "pnpm exec openspec ")
    .replaceAll("Bash(openspec:*)", "Bash(pnpm exec openspec:*)")
    .replaceAll("compatibility: Requires openspec CLI.", "compatibility: Requires the project's pinned OpenSpec CLI (pnpm exec openspec).");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let changed = 0;
  let calls = 0;
  for (const file of generatedFiles()) {
    const before = readFileSync(file, "utf8");
    const n = before.match(BARE_CALL)?.length ?? 0;
    const after = pin(before);
    if (after !== before) {
      writeFileSync(file, after);
      changed++;
      calls += n;
      console.log(`pinned  ${String(n).padStart(2)}  ${relative(process.cwd(), file).replaceAll("\\", "/")}`);
    }
  }
  console.log(`${changed} file(s) rewritten, ${calls} bare call(s) -> pnpm exec openspec`);
}

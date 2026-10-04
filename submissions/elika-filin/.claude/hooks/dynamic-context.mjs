#!/usr/bin/env node
// Claude Code hook for SessionStart and UserPromptSubmit — DYNAMIC context.
// Static context (AGENTS.md, .claude/rules/) is the same on every request. This hook computes, at the moment
// of the request, what no rule file can know in advance and prints it to stdout, which Claude Code adds to the
// conversation as context:
//   - active OpenSpec changes and their task progress (openspec/changes/*/tasks.md),
//   - the open "start next session with" line from docs/session-notes.md,
//   - the verdict of the last `pnpm check` (written by scripts/check-verdict.mjs into .agent-log/last-check.json).
// Never blocks, never fails: any error -> exit 0 and silence.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;
let ev = {};
try {
  ev = JSON.parse(raw || "{}");
} catch {
  /* fall through with an empty event */
}

const root = process.env.CLAUDE_PROJECT_DIR || ev.cwd || process.cwd();
const lines = [];

try {
  const changesDir = join(root, "openspec", "changes");
  const active = existsSync(changesDir)
    ? readdirSync(changesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== "archive")
        .map((d) => d.name)
    : [];
  if (active.length === 0) {
    lines.push("OpenSpec: no active change — outside a change the trust level is 1 (propose, then wait).");
  }
  for (const name of active) {
    const tasksFile = join(changesDir, name, "tasks.md");
    if (!existsSync(tasksFile)) {
      lines.push(`OpenSpec change "${name}": no tasks.md yet (propose not finished).`);
      continue;
    }
    const tasks = readFileSync(tasksFile, "utf8");
    const done = (tasks.match(/^\s*- \[x\]/gim) ?? []).length;
    const open = (tasks.match(/^\s*- \[ \]/gm) ?? []).length;
    const next = tasks.split("\n").find((l) => /^\s*- \[ \]/.test(l))?.trim();
    lines.push(
      `OpenSpec change "${name}": ${done}/${done + open} tasks done — trust level 3 inside it.` +
        (next ? ` Next: ${next.slice(0, 160)}` : " All tasks done — archive it."),
    );
  }
} catch {
  /* openspec tree unreadable — say nothing */
}

try {
  const notes = readFileSync(join(root, "docs", "session-notes.md"), "utf8");
  const m = notes.match(/\*\*Починати наступну сесію з:\*\*\s*(.+)/);
  if (m && m[1].trim()) lines.push(`Session notes say to start with: ${m[1].trim().slice(0, 200)}`);
} catch {
  /* no notes yet */
}

try {
  const last = JSON.parse(readFileSync(join(root, ".agent-log", "last-check.json"), "utf8"));
  lines.push(`Last pnpm check: ${last.ok ? "GREEN" : "RED"} at ${last.ts}${last.summary ? ` — ${last.summary}` : ""}`);
} catch {
  lines.push("Last pnpm check: unknown — run `pnpm check` before claiming anything is done.");
}

if (lines.length) process.stdout.write(`[dynamic-context hook]\n${lines.join("\n")}\n`);
process.exit(0);

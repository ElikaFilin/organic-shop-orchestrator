#!/usr/bin/env node
// Claude Code Stop hook — the loop-closing invariant: the agent may not declare itself finished while the
// tree it edited has not been checked. Exit 2 blocks the stop and the stderr line is fed back as the reason.
//   - stop_hook_active=true (we already blocked once this turn) -> exit 0, never loop forever;
//   - no Edit/Write of source files in this session (.agent-log/actions.jsonl, same session id) -> exit 0;
//   - .agent-log/last-check.json missing, RED, or older than the last edit -> exit 2 "run node scripts/check-verdict.mjs".
// Never throws: any error -> exit 0 silently.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;
let ev = {};
try {
  ev = JSON.parse(raw || "{}");
} catch {
  process.exit(0);
}
if (ev.stop_hook_active) process.exit(0);

try {
  const root = process.env.CLAUDE_PROJECT_DIR || ev.cwd || process.cwd();
  const logFile = join(root, ".agent-log", "actions.jsonl");
  if (!existsSync(logFile)) process.exit(0);
  const session = String(ev.session_id ?? "").slice(0, 8);
  const edits = readFileSync(logFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    })
    .filter((e) => e.event === "PostToolUse" && /^(Edit|Write|NotebookEdit)$/.test(e.tool) && (!session || e.session === session))
    .filter((e) => !/^(docs\/|openspec\/|\.agent-log\/|README)/.test(e.path ?? ""));
  if (edits.length === 0) process.exit(0);
  const lastEdit = edits.map((e) => Date.parse(e.ts)).reduce((a, b) => Math.max(a, b), 0);

  const verdictFile = join(root, ".agent-log", "last-check.json");
  const verdict = existsSync(verdictFile) ? JSON.parse(readFileSync(verdictFile, "utf8")) : null;
  const checkedAt = verdict ? Date.parse(verdict.ts) : 0;
  if (verdict?.ok && checkedAt >= lastEdit) process.exit(0);

  const why = !verdict
    ? "no pnpm check has been recorded"
    : !verdict.ok
      ? `the last pnpm check was RED (${verdict.summary || `exit ${verdict.exit}`})`
      : "source files were edited after the last green pnpm check";
  process.stderr.write(`Blocked by hook (stop-gate): ${why}. Run \`node scripts/check-verdict.mjs\` and quote its summary lines before finishing.\n`);
  process.exit(2);
} catch {
  process.exit(0);
}

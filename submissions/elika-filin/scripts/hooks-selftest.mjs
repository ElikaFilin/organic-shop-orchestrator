#!/usr/bin/env node
// Self-test for the Claude Code hooks in .claude/hooks/ — no agent needed. Part of `pnpm check`.
// Pipes realistic hook payloads through the scripts against a TEMP project dir and checks:
//   1.  protect-env.mjs blocks Read/Edit/Write of .env, .env.local, .env.production (exit 2); allows .env.example
//   1b. protect-env.mjs blocks `process.env` written anywhere under apps/**/src or packages/**/src except
//       apps/api/src/config.ts — through Edit (new_string) AND Write (content)
//   2.  log-action.mjs appends one JSON line per event with repo-relative paths
//   3.  a PreToolUse line without a Post line for the same id is reported as "proposed but not executed"
//   4.  log-filter.mjs rewrites a raw dump of .agent-log/actions.jsonl into the summary command / summary file
//   5.  dynamic-context.mjs prints active change progress, the session-notes line and the last check verdict
// Usage: pnpm hooks:selftest
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = process.cwd();
const tmp = mkdtempSync(join(tmpdir(), "hooks-selftest-"));
const env = { ...process.env, CLAUDE_PROJECT_DIR: tmp };
const run = (script, payload) =>
  spawnSync(process.execPath, [join(here, ".claude", "hooks", script)], { input: JSON.stringify(payload), env, encoding: "utf8" });

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failed++;
};
const base = { session_id: "selftest-0001", cwd: tmp, permission_mode: "default" };

// 1. secrets guard
for (const [tool, file, expect] of [
  ["Edit", join(tmp, ".env"), 2],
  ["Write", join(tmp, ".env.local"), 2],
  ["Read", tmp + "\\.env.production", 2],
  ["Edit", join(tmp, ".env.example"), 0],
  ["Read", join(tmp, "apps", "api", "src", "config.ts"), 0],
]) {
  const r = run("protect-env.mjs", { ...base, hook_event_name: "PreToolUse", tool_name: tool, tool_input: { file_path: file } });
  check(`protect-env ${tool} ${file.split(/[\\/]/).pop()} -> exit ${expect}`, r.status === expect, r.status === 2 ? r.stderr.trim() : "");
}

// 1b. process.env invariant: same body through two tools (Edit -> new_string, Write -> content)
const withEnv = "export function load() {\n  return process.env.ADMIN_TOKEN;\n}\n";
const clean = "export function load(env: Record<string, string>) {\n  return env.ADMIN_TOKEN;\n}\n";
for (const [tool, file, field, body, note, expect] of [
  ["Edit", join(tmp, "apps", "api", "src", "routes", "admin.ts"), "new_string", withEnv, "", 2],
  ["Write", join(tmp, "apps", "api", "src", "lib", "auth.ts"), "content", withEnv, "", 2],
  ["Write", join(tmp, "apps", "web", "src", "api", "client.ts"), "content", withEnv, "", 2],
  ["Edit", join(tmp, "apps", "api", "src", "config.ts"), "new_string", withEnv, "(the one allowed file)", 0],
  ["Write", join(tmp, "scripts", "loop.mjs"), "content", withEnv, "(outside apps/**)", 0],
  ["Write", join(tmp, "apps", "api", "src", "lib", "auth.ts"), "content", clean, "(no process.env)", 0],
]) {
  const r = run("protect-env.mjs", { ...base, hook_event_name: "PreToolUse", tool_name: tool, tool_input: { file_path: file, [field]: body } });
  check(`protect-env ${tool} ${file.split(/[\\/]/).slice(-2).join("/")}${note ? " " + note : ""} -> exit ${expect}`, r.status === expect, r.status === 2 ? r.stderr.trim().split("\n")[0] : "");
}

// 2. logger
const events = [
  { ...base, hook_event_name: "PreToolUse", tool_use_id: "t1", tool_name: "Bash", tool_input: { command: "pnpm check" } },
  { ...base, hook_event_name: "PostToolUse", tool_use_id: "t1", tool_name: "Bash", tool_input: { command: "pnpm check" }, tool_response: { stdout: "ok" }, duration_ms: 4200 },
  { ...base, hook_event_name: "PreToolUse", tool_use_id: "t2", tool_name: "Edit", tool_input: { file_path: join(tmp, "apps", "web", "src", "App.tsx") } },
  { ...base, hook_event_name: "PostToolUse", tool_use_id: "t2", tool_name: "Edit", tool_input: { file_path: join(tmp, "apps", "web", "src", "App.tsx") }, duration_ms: 15 },
  { ...base, hook_event_name: "PreToolUse", tool_use_id: "t3", tool_name: "Bash", tool_input: { command: "pnpm typecheck" } },
  { ...base, hook_event_name: "PostToolUseFailure", tool_use_id: "t3", tool_name: "Bash", tool_input: { command: "pnpm typecheck" }, error: "Exit code 2\nerror TS2339", duration_ms: 900 },
  { ...base, hook_event_name: "PreToolUse", tool_use_id: "t4", tool_name: "Edit", tool_input: { file_path: join(tmp, ".env") } },
];
for (const e of events) {
  const r = run("log-action.mjs", e);
  check(`log-action ${e.hook_event_name} ${e.tool_name} exits 0 silently`, r.status === 0 && r.stdout === "");
}
const lines = readFileSync(join(tmp, ".agent-log", "actions.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
check("log has 7 lines", lines.length === 7);
check("PreToolUse line has no exit field", lines[0].event === "PreToolUse" && !("exit" in lines[0]) && lines[0].id === "t1");
check("PostToolUse Bash keeps cmd and exit 0", lines[1].cmd === "pnpm check" && lines[1].exit === 0 && lines[1].ms === 4200);
check("Edit line stores repo-relative path", lines[3].path === "apps/web/src/App.tsx", lines[3].path);
check("failure line carries exit code 2", lines[5].exit === 2);

// 3. summary pairs Pre/Post by id
const summary = spawnSync(process.execPath, [join(here, "scripts", "agent-log-summary.mjs"), join(tmp, ".agent-log", "actions.jsonl")], { encoding: "utf8" });
check("agent-log-summary reports 1 proposed but not executed", summary.status === 0 && /1 proposed but not executed/.test(summary.stdout));

// 4. filter: the raw log never reaches the context window
const SUMMARY_CMD = "node scripts/agent-log-summary.mjs";
const logPath = join(tmp, ".agent-log", "actions.jsonl");
const summaryPath = join(tmp, ".agent-log", "summary.txt");
mkdirSync(join(tmp, "scripts"), { recursive: true });
copyFileSync(join(here, "scripts", "agent-log-summary.mjs"), join(tmp, "scripts", "agent-log-summary.mjs"));
const filter = (payload) => {
  const r = run("log-filter.mjs", { ...base, hook_event_name: "PreToolUse", ...payload });
  let out = {};
  try {
    out = JSON.parse(r.stdout || "{}");
  } catch {
    /* not JSON -> the hook decided nothing */
  }
  return { r, updated: out.hookSpecificOutput?.updatedInput, message: out.systemMessage ?? "" };
};
for (const [command, expected] of [
  ["cat .agent-log/actions.jsonl", SUMMARY_CMD],
  ["tail -n 500 .agent-log/actions.jsonl | grep PreToolUse", SUMMARY_CMD],
  ["pnpm check", null],
  ["cat package.json", null],
  [SUMMARY_CMD, null],
]) {
  const { r, updated } = filter({ tool_name: "Bash", tool_input: { command, description: "look at the log" } });
  const ok = expected ? r.status === 0 && updated?.command === expected : r.status === 0 && r.stdout === "";
  check(`log-filter Bash \`${command}\` -> ${expected ? "summary command" : "untouched"}`, ok, updated?.command ?? "");
}
const res = filter({ tool_name: "Read", tool_input: { file_path: logPath, limit: 200 } });
check("log-filter Read actions.jsonl -> summary.txt, other input kept", res.updated?.file_path === summaryPath && res.updated?.limit === 200, res.updated?.file_path ?? "");
check("log-filter names itself in systemMessage", /hook \(log-filter\)/.test(filter({ tool_name: "Bash", tool_input: { command: "cat .agent-log/actions.jsonl" } }).message));

// 5. dynamic context: computed from disk at request time
const changeDir = join(tmp, "openspec", "changes", "add-basket");
mkdirSync(changeDir, { recursive: true });
mkdirSync(join(tmp, "openspec", "changes", "archive", "2026-01-01-old"), { recursive: true });
writeFileSync(join(changeDir, "tasks.md"), "## 1. Tests\n- [x] 1.1 scenario tests\n- [ ] 1.2 implement add\n- [ ] 1.3 run pnpm check\n");
mkdirSync(join(tmp, "docs"), { recursive: true });
writeFileSync(join(tmp, "docs", "session-notes.md"), "- **Починати наступну сесію з:** /opsx:apply add-basket\n");
writeFileSync(join(tmp, ".agent-log", "last-check.json"), JSON.stringify({ ok: false, exit: 1, ts: "2026-10-04T10:00:00.000Z", summary: "Tests 1 failed | 3 passed (4)" }));
const dyn = run("dynamic-context.mjs", { ...base, hook_event_name: "UserPromptSubmit", prompt: "continue" });
check("dynamic-context exits 0", dyn.status === 0, dyn.stderr);
check("dynamic-context reports the active change with task progress", /add-basket.*1\/3 tasks done/.test(dyn.stdout), dyn.stdout.split("\n")[1] ?? "");
check("dynamic-context names the next open task", /Next: - \[ \] 1\.2 implement add/.test(dyn.stdout));
check("dynamic-context ignores the archive directory", !/2026-01-01-old/.test(dyn.stdout));
check("dynamic-context carries the session-notes line", /start with: \/opsx:apply add-basket/.test(dyn.stdout));
check("dynamic-context carries the last check verdict", /Last pnpm check: RED at 2026-10-04T10:00:00.000Z — Tests 1 failed/.test(dyn.stdout));
rmSync(changeDir, { recursive: true, force: true });
const dynEmpty = run("dynamic-context.mjs", { ...base, hook_event_name: "SessionStart" });
check("dynamic-context says 'no active change' when the tree is empty", /no active change/.test(dynEmpty.stdout));

// 6. stop-gate: the agent cannot stop with unchecked edits
const stopEv = { ...base, hook_event_name: "Stop", stop_hook_active: false };
const stopLog = join(tmp, ".agent-log", "actions.jsonl");
const stopVerdict = join(tmp, ".agent-log", "last-check.json");
const sessionLine = (tool, path, ts) => JSON.stringify({ ts, event: "PostToolUse", id: "s1", session: "selftest", mode: "default", tool, path, exit: 0 }) + "\n";
writeFileSync(stopLog, sessionLine("Edit", "apps/api/src/lib/basket.ts", "2026-10-04T12:00:00.000Z"));
rmSync(stopVerdict, { force: true });
let sg = run("stop-gate.mjs", stopEv);
check("stop-gate blocks (exit 2) when a source edit has no recorded pnpm check", sg.status === 2 && /no pnpm check has been recorded/.test(sg.stderr), sg.stderr.trim());
writeFileSync(stopVerdict, JSON.stringify({ ok: false, exit: 1, ts: "2026-10-04T12:05:00.000Z", summary: "Tests 1 failed | 3 passed (4)" }));
sg = run("stop-gate.mjs", stopEv);
check("stop-gate blocks when the last pnpm check was RED", sg.status === 2 && /was RED/.test(sg.stderr));
writeFileSync(stopVerdict, JSON.stringify({ ok: true, exit: 0, ts: "2026-10-04T11:00:00.000Z", summary: "Tests 4 passed (4)" }));
sg = run("stop-gate.mjs", stopEv);
check("stop-gate blocks when files were edited after the last GREEN check", sg.status === 2 && /edited after the last green/.test(sg.stderr));
writeFileSync(stopVerdict, JSON.stringify({ ok: true, exit: 0, ts: "2026-10-04T12:30:00.000Z", summary: "Tests 4 passed (4)" }));
sg = run("stop-gate.mjs", stopEv);
check("stop-gate allows the stop once a GREEN check is newer than the last edit", sg.status === 0 && sg.stderr === "");
writeFileSync(stopLog, sessionLine("Edit", "docs/session-notes.md", "2026-10-04T13:00:00.000Z"));
rmSync(stopVerdict, { force: true });
sg = run("stop-gate.mjs", stopEv);
check("stop-gate ignores edits to docs/ and openspec/ (no code changed)", sg.status === 0);
writeFileSync(stopLog, sessionLine("Edit", "apps/web/src/App.tsx", "2026-10-04T13:00:00.000Z"));
sg = run("stop-gate.mjs", { ...stopEv, stop_hook_active: true });
check("stop-gate never blocks twice in a row (stop_hook_active)", sg.status === 0);

rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} hook check(s) failed` : "\nall hook checks passed");
process.exit(failed ? 1 : 0);

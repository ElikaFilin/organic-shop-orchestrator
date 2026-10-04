#!/usr/bin/env node
// Claude Code PreToolUse hook (matcher: Read|Edit|Write|NotebookEdit).
// 1. Blocks reading or writing secrets files (.env, .env.local, ...); .env.example stays open.
// 2. Enforces one project invariant: `process.env` is read ONLY in apps/api/src/config.ts.
//    Every other file under apps/** or packages/** receives configuration as values.
// Exit code 2 = the tool call is BLOCKED and stderr is fed back to the agent as the reason.
// PreToolUse hooks run BEFORE the permission check, in EVERY permission mode: hooks enforce, AGENTS.md only advises.
let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

let ev = {};
try {
  ev = JSON.parse(raw || "{}");
} catch {
  process.exit(0);
}

const input = ev.tool_input ?? {};
const p = String(input.file_path ?? input.notebook_path ?? "").replace(/\\/g, "/");
const base = p.split("/").pop() ?? "";

if (/^\.env(\..+)?$/.test(base) && base !== ".env.example") {
  const verb = ev.tool_name === "Read" ? "read" : "edit";
  process.stderr.write(
    `Blocked by hook: ${p} is a secrets file; the agent must not ${verb} it. Use .env.example instead and ask the user to update .env manually.\n`,
  );
  process.exit(2);
}

// Look at BOTH new-content fields: Edit puts it in new_string, Write in content.
const written = `${input.new_string ?? ""}\n${input.content ?? ""}`;
const inSource = /(^|\/)(apps|packages)\/[^/]+\/(src|scripts)\//.test(p);
const isConfig = /(^|\/)apps\/api\/src\/config\.ts$/.test(p);
if (inSource && !isConfig && /\bprocess\.env\b/.test(written)) {
  process.stderr.write(
    `Blocked by hook: process.env is read only in apps/api/src/config.ts — pass configuration into ${p} as a value.\n`,
  );
  process.exit(2);
}
process.exit(0);

#!/usr/bin/env node
// Proof-of-use helper: search the Claude Code session transcripts of THIS project directory (every `claude -p`
// run started by scripts/loop.mjs and scripts/review.mjs lands there, with the project hooks active) for a marker
// and print decoded, timestamped matches. The capstone's 22 transcripts sit in ./sessions/<session_id>.jsonl;
// transcripts of newer runs live in ~/.claude/projects/<encoded cwd>/ (use --dir to point there).
//
//   pnpm transcripts -- "[dynamic-context hook]"
//   pnpm transcripts -- "Blocked by hook (stop-gate)" --context 300
//   pnpm transcripts -- "requires approval" --dir ~/.claude/projects/<other-project>
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const marker = argv.find((a, i) => !a.startsWith("--") && (i === 0 || !argv[i - 1].startsWith("--")));
if (!marker) {
  console.error('usage: node scripts/transcript-grep.mjs "<marker>" [--dir <transcripts dir>] [--context 200] [--max 50]');
  process.exit(2);
}
const encoded = resolve(process.cwd()).replace(/[^A-Za-z0-9]/g, "-");
// The 22 transcripts of this capstone were moved into ./sessions/<session_id>.jsonl so a clone of the repo can be
// searched; new `claude -p` runs still land in ~/.claude/projects/ (use --dir to point there).
const sessionsDir = join(process.cwd(), "sessions");
const dir = arg("--dir", existsSync(sessionsDir) ? sessionsDir : join(homedir(), ".claude", "projects", encoded));
const context = Number(arg("--context", 200));
const max = Number(arg("--max", 50));
if (!existsSync(dir)) {
  console.error(`no transcripts at ${dir}`);
  process.exit(1);
}

const text = (content) =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content
          .map((c) => {
            if (c.type === "text") return c.text;
            if (c.type === "tool_use") return `[tool_use ${c.name}] ${JSON.stringify(c.input)}`;
            if (c.type === "tool_result") return `[tool_result] ${text(c.content)}`;
            return "";
          })
          .join("\n")
      : "";

let hits = 0;
const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
for (const file of files) {
  const lines = readFileSync(join(dir, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (hits >= max || !line.includes(marker.replace(/"/g, '\\"')) && !line.includes(marker)) return;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      return;
    }
    const body = text(ev.message?.content ?? ev.content ?? "");
    const at = body.indexOf(marker);
    if (at < 0) return;
    hits++;
    const snippet = body.slice(Math.max(0, at - context), at + marker.length + context).replace(/\n{3,}/g, "\n\n");
    console.log(`\n=== ${file}:${i + 1} · ${ev.timestamp ?? "?"} · session ${String(ev.sessionId ?? "").slice(0, 8)} · ${ev.type ?? ev.message?.role ?? "?"}`);
    console.log(snippet);
  });
}
console.log(`\n${hits} match(es) for "${marker}" in ${files.length} transcript(s) under ${dir}${hits >= max ? ` (stopped at --max ${max})` : ""}`);

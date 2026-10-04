#!/usr/bin/env node
// maker ≠ checker: a SEPARATE, read-only agent session reviews what the maker (the apply loop or an interactive
// session) produced, and its verdict is saved verbatim where a human can read it.
//
//   pnpm review -- --change <openspec-change-id> [--agent spec-reviewer|code-reviewer] [--model <id>]
//
// The reviewer's prompt is the agent definition in .claude/agents/<agent>.md (the same file Claude Code uses for
// the subagent), its tool set is the read-only list that file declares, and the output goes verbatim to
// docs/reviews/<date>-<change>-<agent>.md. The script never edits code: a finding is fixed by the maker in a
// new session, and the review is run again.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const change = arg("--change");
const agentName = arg("--agent", "spec-reviewer");
const model = arg("--model");
if (!change) {
  console.error("usage: pnpm review -- --change <openspec-change-id> [--agent spec-reviewer|code-reviewer] [--model id]");
  process.exit(2);
}
const root = process.cwd();
const agentFile = join(root, ".claude", "agents", `${agentName}.md`);
if (!existsSync(agentFile)) {
  console.error(`review: no agent definition at .claude/agents/${agentName}.md`);
  process.exit(2);
}
const def = readFileSync(agentFile, "utf8");
const fm = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(def);
const frontmatter = fm?.[1] ?? "";
const body = (fm?.[2] ?? def).trim();
const tools = /^tools:\s*(.+)$/m.exec(frontmatter)?.[1]?.split(",").map((s) => s.trim()).filter(Boolean) ?? ["Read", "Grep", "Glob"];

// An active change lives in openspec/changes/<id>; an archived one in openspec/changes/archive/<date>-<id>.
const archiveDir = join(root, "openspec", "changes", "archive");
const archived = existsSync(archiveDir) ? readdirSync(archiveDir).find((d) => d.endsWith(`-${change}`)) : undefined;
const changeDir = existsSync(join(root, "openspec", "changes", change))
  ? `openspec/changes/${change}`
  : archived
    ? `openspec/changes/archive/${archived}`
    : `openspec/changes/${change}`;

const prompt = `${body}

---
Review request: change "${change}" at ${changeDir}. Today is ${new Date().toISOString().slice(0, 10)}.`;

const stamp = new Date().toISOString().slice(0, 10);
mkdirSync(join(root, "docs", "reviews"), { recursive: true });
const reviewsDir = join(root, "docs", "reviews");
const existing = readdirSync(reviewsDir).filter((f) => f.startsWith(`${stamp}-${change}-${agentName}`)).length;
const outFile = join(reviewsDir, `${stamp}-${change}-${agentName}${existing ? `-round${existing + 1}` : ""}.md`);

const args = [
  "-p", prompt,
  "--permission-mode", "default",
  "--allowedTools", tools.join(","),
  "--disallowedTools", "Edit,Write,NotebookEdit,Bash(pnpm add *),Bash(git commit *)",
  "--output-format", "json",
  "--max-turns", "40",
];
if (model) args.push("--model", model);
const env = { ...process.env };
delete env.CLAUDECODE;
delete env.CLAUDE_CODE_ENTRYPOINT;
const t0 = Date.now();
const r = spawnSync("claude", args, { cwd: root, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
let json;
try {
  json = JSON.parse(r.stdout || "{}");
} catch {
  json = { result: r.stdout };
}
const text = String(json.result ?? r.stderr ?? "").trim();
const meta = `agent: ${agentName} · tools: ${tools.join(", ")} · model: ${Object.keys(json.modelUsage ?? {}).join(", ") || model || "session default"} · turns: ${json.num_turns ?? "?"} · cost: $${Number(json.total_cost_usd ?? 0).toFixed(2)} · ${Math.round((Date.now() - t0) / 1000)} s`;
writeFileSync(
  outFile,
  `# Review · ${change} · ${agentName} · ${new Date().toISOString()}\n\n> ${meta}\n> The reviewer is a separate \`claude -p\` session with read-only tools; the maker never sees this prompt.\n\n${text}\n`,
);
console.log(text);
console.log(`\nreview saved: ${outFile}`);
process.exit(r.status ?? 1);

#!/usr/bin/env node
// Loop engineering: run the agent until the gate is green, instead of prompting it step by step.
//
//   pnpm loop -- --change <openspec-change-id> [--max-iter 5] [--budget-usd 4] [--model <id>] [--dry-run]
//
// Each iteration:
//   1. gate   — `node scripts/check-verdict.mjs` (= pnpm check, verdict saved to .agent-log/last-check.json);
//               the loop also reads openspec/changes/<change>/tasks.md and stops only when the gate is green
//               AND every task is [x].
//   2. agent  — one FRESH `claude -p` session (print mode, acceptEdits, allow-listed tools) with the same prompt
//               every time plus the gate's tail: "here is what is red, here is the next open task".
//   3. log    — one row in .agent-log/loop.jsonl and a Markdown record in docs/loops/<date>-<change>.md:
//               iteration, gate exit, failing tests, cost, output tokens, turns, duration.
// Stop conditions: green + all tasks done · max iterations · budget exhausted · the gate output is identical
// twice in a row (stuck). The exit code is 0 only on the first condition.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const change = arg("--change");
const maxIter = Number(arg("--max-iter", 5));
const budgetUsd = Number(arg("--budget-usd", 4));
const model = arg("--model");
const dryRun = argv.includes("--dry-run");
if (!change) {
  console.error("usage: pnpm loop -- --change <openspec-change-id> [--max-iter N] [--budget-usd N] [--model id] [--dry-run]");
  process.exit(2);
}

const root = process.cwd();
const tasksFile = join(root, "openspec", "changes", change, "tasks.md");
if (!existsSync(tasksFile)) {
  console.error(`loop: no active change at openspec/changes/${change}/tasks.md — run /opsx:propose first.`);
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(join(root, "docs", "loops"), { recursive: true });
mkdirSync(join(root, ".agent-log"), { recursive: true });
const record = join(root, "docs", "loops", `${stamp}-${change}.md`);
const rows = [];

const tasks = () => {
  const text = readFileSync(tasksFile, "utf8");
  const done = (text.match(/^\s*- \[x\]/gim) ?? []).length;
  const open = text.split("\n").filter((l) => /^\s*- \[ \]/.test(l)).map((l) => l.trim());
  return { done, open, total: done + open.length };
};

const gate = () => {
  const r = spawnSync(process.execPath, ["scripts/check-verdict.mjs"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const failing = out
    .split("\n")
    .filter((l) => /(FAIL|✗|×|error TS\d+|AssertionError|spec:check FAILED|hook check\(s\) failed|\d+ problems?)/.test(l))
    .slice(0, 40);
  const summary = [out.match(/Tests\s+[^\n]+/g)?.at(-1), out.match(/spec:check (ok|FAILED)[^\n]*/)?.[0]].filter(Boolean).join(" · ");
  return { ok: r.status === 0, exit: r.status ?? 1, failing, summary, out };
};

const prompt = (g, t) => `You are inside the OpenSpec change "${change}" (trust level 3 — see AGENTS.md). Goal: every task in
openspec/changes/${change}/tasks.md is [x] and \`pnpm check\` is green.

Follow the apply workflow in .claude/commands/opsx/apply.md: read proposal.md, specs/**/spec.md, design.md (if any)
and tasks.md from disk, then implement the next open tasks, ticking each \`- [ ]\` to \`- [x]\` as soon as its
behaviour is fully implemented and verified. Scenario tests come first; quote the red run before you make it green.

Current state (computed by scripts/loop.mjs, not from memory):
- tasks: ${t.done}/${t.total} done${t.open.length ? `; next open: ${t.open[0]}` : ""}
- pnpm check: ${g.ok ? "GREEN" : `RED (exit ${g.exit})`}${g.summary ? ` — ${g.summary}` : ""}
${g.failing.length ? `- failing lines:\n${g.failing.map((l) => `    ${l}`).join("\n")}` : ""}

Rules for this run: do not add dependencies; do not touch .env*, .agent-log/ or .claude/hooks/; do not edit the
spec to make a test pass — if the spec is wrong, stop and say so. Finish by running \`node scripts/check-verdict.mjs\`
and quoting its summary lines. Stop after at most 25 tool calls if you are not converging and explain where you are.`;

const allowed = [
  "Read", "Edit", "Write", "Glob", "Grep",
  "Bash(pnpm check)", "Bash(pnpm test *)", "Bash(pnpm typecheck)", "Bash(pnpm lint)", "Bash(pnpm spec:check)",
  "Bash(pnpm hooks:selftest)", "Bash(pnpm exec openspec *)", "Bash(node scripts/check-verdict.mjs)",
  "Bash(git status *)", "Bash(git diff *)", "mcp__context7__resolve-library-id", "mcp__context7__query-docs",
].join(",");

const runAgent = (text) => {
  const args = ["-p", text, "--permission-mode", "acceptEdits", "--allowedTools", allowed, "--output-format", "json", "--max-turns", "80"];
  if (model) args.push("--model", model);
  if (dryRun) return { cost: 0, outputTokens: 0, turns: 0, ms: 0, text: "(dry run — agent not called)", error: false };
  const env = { ...process.env };
  delete env.CLAUDECODE; // allow a nested print-mode run from inside an interactive session
  delete env.CLAUDE_CODE_ENTRYPOINT;
  const t0 = Date.now();
  const r = spawnSync("claude", args, { cwd: root, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
  let json;
  try {
    json = JSON.parse(r.stdout || "{}");
  } catch {
    json = { result: r.stdout };
  }
  return {
    cost: Number(json.total_cost_usd ?? 0),
    outputTokens: Number(json.usage?.output_tokens ?? 0),
    turns: Number(json.num_turns ?? 0),
    ms: Date.now() - t0,
    text: String(json.result ?? r.stderr ?? "").slice(0, 4000),
    error: r.status !== 0 || json.is_error === true,
  };
};

const header = `# Loop run · ${change} · ${new Date().toISOString()}\n\nCommand: \`pnpm loop -- --change ${change} --max-iter ${maxIter} --budget-usd ${budgetUsd}${model ? ` --model ${model}` : ""}\`\n\n| # | gate before | tasks before | agent turns | output tokens | cost USD | agent time | gate after |\n|---|---|---|---|---|---|---|---|\n`;
writeFileSync(record, header);

let spent = 0;
let lastSignature = "";
let stop = "max-iter";
for (let i = 1; i <= maxIter; i++) {
  const before = gate();
  const t = tasks();
  if (before.ok && t.open.length === 0) {
    stop = "green";
    appendFileSync(record, `| ${i} | GREEN · ${before.summary} | ${t.done}/${t.total} | — | — | — | — | already green, all tasks done |\n`);
    break;
  }
  const signature = `${before.exit}:${t.done}:${before.failing.join("|")}`;
  if (signature === lastSignature) {
    stop = "stuck";
    appendFileSync(record, `| ${i} | ${before.ok ? "GREEN" : "RED"} · ${before.summary} | ${t.done}/${t.total} | — | — | — | — | stopped: identical gate output twice |\n`);
    break;
  }
  lastSignature = signature;
  if (spent >= budgetUsd) {
    stop = "budget";
    appendFileSync(record, `| ${i} | ${before.ok ? "GREEN" : "RED"} | ${t.done}/${t.total} | — | — | — | — | stopped: budget $${budgetUsd} exhausted |\n`);
    break;
  }
  console.log(`loop ${change} · iteration ${i}/${maxIter} · gate ${before.ok ? "green" : "red"} · tasks ${t.done}/${t.total}`);
  const a = runAgent(prompt(before, t));
  spent += a.cost;
  const after = gate();
  const t2 = tasks();
  const row = { ts: new Date().toISOString(), change, iteration: i, gateBefore: before.exit, gateAfter: after.exit, tasksBefore: `${t.done}/${t.total}`, tasksAfter: `${t2.done}/${t2.total}`, turns: a.turns, outputTokens: a.outputTokens, costUsd: +a.cost.toFixed(4), agentMs: a.ms, spentUsd: +spent.toFixed(4) };
  appendFileSync(join(root, ".agent-log", "loop.jsonl"), JSON.stringify(row) + "\n");
  rows.push(row);
  appendFileSync(
    record,
    `| ${i} | ${before.ok ? "GREEN" : "RED"}${before.summary ? ` · ${before.summary}` : ""} | ${t.done}/${t.total} | ${a.turns} | ${a.outputTokens} | ${a.cost.toFixed(2)} | ${Math.round(a.ms / 1000)} s | ${after.ok ? "GREEN" : "RED"}${after.summary ? ` · ${after.summary}` : ""} · tasks ${t2.done}/${t2.total} |\n`,
  );
  appendFileSync(record, `\n<details><summary>agent output, iteration ${i}</summary>\n\n\`\`\`\n${a.text}\n\`\`\`\n\n</details>\n\n`);
  if (after.ok && t2.open.length === 0) {
    stop = "green";
    break;
  }
}
const final = gate();
const t = tasks();
const summary = `loop ${change}: ${rows.length} agent iteration(s), stopped on "${stop}", final pnpm check exit ${final.exit}${final.summary ? ` (${final.summary})` : ""}, tasks ${t.done}/${t.total}, spent $${spent.toFixed(2)}`;
appendFileSync(record, `\n**Result:** ${summary}\n`);
console.log(summary);
console.log(`record: ${record}`);
process.exit(stop === "green" && final.ok ? 0 : 1);

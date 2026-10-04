@AGENTS.md

## Claude Code

- Start in plan mode for anything touching `apps/api/src/routes/**` or config files; a one-line diff needs no plan.
- Do not edit `.agent-log/` or `.claude/hooks/` — they are the observability layer (a hook logs every tool call).
- The `[dynamic-context hook]` block that arrives with a prompt is computed from disk at request time (active
  OpenSpec change and task progress, the open session-notes item, the last `pnpm check` verdict). Trust it over
  what you remember from earlier in the conversation.

# Compact instructions

Carry over, verbatim:

- The invariant: `process.env` only in `apps/api/src/config.ts`; `.agent-log/` and `.claude/hooks/` are never
  edited by the agent; the log is read with `pnpm agent:log`, never by dumping the JSONL into the conversation.
- The change in flight: its name, which tasks are `[x]`, which files are being changed, and the verdict of the
  last `pnpm check`.

Drop:

- Anything already enforced deterministically outside the conversation (hooks, permission rules, the spec gate).
- Contents of files already read — the path is enough; the file can be re-read from disk.
- Command output (`pnpm check`, test runs) — keep the verdict and the numbers, not the wall of text.
- Approaches already tried and rejected, and the reasoning that led to them.

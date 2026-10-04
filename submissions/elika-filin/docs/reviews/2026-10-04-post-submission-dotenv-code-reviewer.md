# Review · post-submission-dotenv · code-reviewer · 2026-10-04T17:20:31.854Z

> agent: code-reviewer · tools: Read, Grep, Glob, Bash(git diff *), Bash(git status *), Bash(git show *), Bash(git log *) · model: claude-opus-5[1m] · turns: 16 · cost: $0.72 · 130 s
> The reviewer is a separate `claude -p` session with read-only tools; the maker never sees this prompt.

## Findings

- `apps/api/src/config.test.ts:51` — `loadConfig()` is called with the real `process.env`; per the diff's own JSDoc ("variables already set in the environment win") `process.loadEnvFile` will not overwrite an existing var, so the assertion breaks. Failing input: `ADMIN_TOKEN=x pnpm test` → expected `"from-dotenv-test"`, got `"x"`. Breaks AGENTS.md "tests never depend on the environment".
- `.data/baskets.json:1` — a file the basket store rewrites at runtime is now tracked (the `.gitignore` change dropped all of `.data/`, not just the settings file). After one "add to basket" the tree is dirty, `git add -A` publishes cookie-keyed basket ids, and every teammate's pull conflicts. Only `admin-settings.json` needed tracking: `.data/*` + `!.data/admin-settings.json`.
- `apps/api/src/server.ts:14` — `loadDotEnv()` is unguarded while the adjacent settings read is deliberately `.catch`ed; `existsSync` only covers a missing file, so an unreadable or non-file `.env` makes `process.loadEnvFile` throw and kills startup. Failing input: `chmod 000 .env` (or `.env` as a directory) → uncaught `EACCES`/`EISDIR` instead of booting without an admin token.
- `apps/api/src/config.test.ts:45` — the test permanently mutates the worker's `process.env` (`ADMIN_TOKEN`, `ORGANIC_UNUSED`) and leaves the `mkdtempSync` directory behind; no snapshot/restore, so any test added after it in this file inherits the token.
- `openspec/changes/post-submission-dotenv` — does not exist; the behaviour was shipped outside any OpenSpec change, so `loadDotEnv` has a unit test but no spec scenario behind it, against the AGENTS.md definition of done. `docs/autonomy-log.md:27` records this as a deliberate level-1 call, which is consistent — but the review request's premise (a change at that path) is wrong.
- `apps/api/src/config.ts:17`, `AGENTS.md:16`, `README.md` — in the committed range these still described `.data/` as git-ignored while the same range commits it. Already corrected in the working tree, not in `fb8f97d`.

Suite state: `pnpm test` → **183 passed (183)**, 27 files, exit 0. `engines: node >=22.12` covers `process.loadEnvFile` (needs ≥20.12), so the API choice is safe. Note the recorded last-check verdict (182) is stale by one test.

## Verdict

`FIX FIRST`

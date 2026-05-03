---
name: web-monitor-auto-repair
description: >
  Web Monitor auto-repair workflow. Analyze a traceback, make a minimal code
  fix in the monitored service repository, run verification, and return a final
  report for the oh-my-feishu Gateway runtime.
context: fork
agent: general-purpose
allowed-tools: Read Edit Bash(pytest *) Bash(npm test *) Bash(npm run *) Bash(git *) Bash(gh *) Bash(curl *) Bash(cat *) Bash(tail *) Bash(ls *) Bash(find *)
---

# Web Monitor Auto-Repair Protocol

You are handling an oh-my-feishu Web Monitor background task. A monitored service produced a new traceback. Work in the current repository directory, make the smallest safe fix you can, run a relevant verification command, and return only the final result.

## Input

Use these input sources in order:

1. The JSON context passed after `/web-monitor-auto-repair` in the prompt.
2. Environment variables:
   - `SERVICE_NAME`
   - `GITHUB_REPO_OWNER`
   - `GITHUB_REPO_NAME`
   - `TRACEBACK_URL`
   - `TARGET_REPO_PATH`
   - `NOTIFY_CHAT_ID`
   - `WEB_MONITOR_AUTO_PR`
   - `WEB_MONITOR_PR_BASE_BRANCH`
   - `WEB_MONITOR_PR_DRAFT`
   - `WEB_MONITOR_PR_BRANCH_PREFIX`
3. Optional fallback files if present:
   - `.claude/triggers/latest.json`
   - `workspace/.claude/triggers/latest.json`

The Gateway normally runs this skill from the main oh-my-feishu `workspace` so this skill is not installed into user project directories. The monitored service repository is provided as `localRepoPath` in the structured context and as `TARGET_REPO_PATH` in the environment. Do not clone a second copy unless `TARGET_REPO_PATH` is missing or is not a git repository.

## Safety Rules (ABSOLUTE — never violate)

1. **PathGuard**: Only modify files under `TARGET_REPO_PATH` / `localRepoPath`.
2. **DiffGuard**: If a fix touches >10 files or >500 lines, STOP and ask for human approval.
3. **TestGuard**: Run the most relevant available verification command after every code change.
4. **No Secrets**: Never hardcode API keys, tokens, or credentials.
5. **No Destructive Revert**: Do not run `git reset --hard`. If you need to abandon your own change, use a targeted reverse edit and explain why.
6. **No Auto Push**: Do not push or open a PR unless the prompt explicitly asks for it or `WEB_MONITOR_AUTO_PR=true` is set.

## 7-Step Repair Flow

Execute sequentially. Do not skip steps.

### Step 1: Detect
Confirm the bug context. Identify:
- Service name and target repo
- Local service repository path (`TARGET_REPO_PATH` or `localRepoPath`)
- Error type (exception, assertion, timeout)
- Affected file(s) if mentioned in traceback

Before editing, verify the target directory exists and is a git repository. Run commands with `cd "$TARGET_REPO_PATH" && ...` or equivalent.

### Step 2: Fetch Log
Read the relevant log or traceback:
- If `traceback_url` is set: `curl` it to get the full traceback
  - For JSON responses: parse and extract the latest error entry
  - For text responses: use the full content
- If `error_log` points to a file path: `Read` it.
- If `error_log` is inline text: use it directly.
- If a demo service is running: `curl` the buggy endpoint to reproduce and capture the traceback.

### Step 3: Analyze Root Cause
Use reasoning (not guessing) to determine:
- Why the error happens
- Which line(s) need to change
- What the minimal correct fix looks like

Use `web-monitor-analyze-log` as supporting guidance if the traceback is non-trivial. Write a concise analysis to `.claude/triggers/analysis.md` if `.claude/` exists or can be created in this repository.

### Step 4: Propose Diff
Generate a minimal, focused code change. Prefer:
- Guard clauses over deep nesting
- Explicit error handling over silent swallowing
- Type-safe operations

### Step 5: Safety Review
Before applying any edit:
- Count how many files and lines will change.
- Verify every changed file path is inside `TARGET_REPO_PATH` / `localRepoPath`.
- If limits exceeded, STOP and write a report to `.claude/triggers/blocked.md`.
- Use `web-monitor-safety-check` as supporting guidance before finalizing the diff.

### Step 6: Apply & Test
1. Apply the diff using `Edit`.
2. Run the most relevant verification command available in the repo:
   - Python project: `cd "$TARGET_REPO_PATH" && pytest -v --tb=short --color=no`
   - Node project: `cd "$TARGET_REPO_PATH" && npm test` or `cd "$TARGET_REPO_PATH" && npm run test`
   - If no test command is discoverable, run the narrowest syntax/build check available and clearly report the gap.
3. If verification passes, continue.
4. If verification fails, attempt one focused fix. If it still fails, STOP and report the failure reason and current diff.

### Step 7: Commit & Notify
1. Leave the working tree with the minimal fix applied.
2. If `WEB_MONITOR_AUTO_PR` is not `true`, do not commit, push, or create a PR by default.
3. If `WEB_MONITOR_AUTO_PR=true`, create a branch, commit the minimal fix, push it, and open a GitHub PR:
   - base branch: `WEB_MONITOR_PR_BASE_BRANCH` or `main`
   - branch prefix: `WEB_MONITOR_PR_BRANCH_PREFIX` or `oh-my-feishu/web-monitor`
   - PR mode: draft unless `WEB_MONITOR_PR_DRAFT=false`
   - use `gh pr create` and include root cause plus verification in the PR body
4. If auto PR is enabled but `gh` is unavailable, authentication is missing, push fails, or PR creation fails, keep the local fix and report the exact failure.
5. Do not send a separate Feishu notification by default. The Gateway runtime publishes your final stdout to Feishu.
6. Use `web-monitor-notify-feishu` only if the prompt explicitly asks for a separate Feishu card.

## Output

Always return a concise final report on stdout:

- `status`: `success` | `failed` | `blocked`
- `service`: service name if known
- `root_cause`: one concise paragraph
- `changes`: files changed and why
- `verification`: command run and result
- `pr`: PR URL if created, otherwise `not_created` with reason
- `follow_up`: anything the user must do

Also write the same report to `.claude/triggers/result.md` when possible.

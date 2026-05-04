---
name: web-monitor-analyze-only
description: >
  Web Monitor analysis-only workflow. Analyze a traceback and propose a fix plan
  WITHOUT making any code changes. Returns a structured analysis result for user
  confirmation before the actual repair.
context: fork
agent: general-purpose
allowed-tools: Read Bash(cat *) Bash(tail *) Bash(ls *) Bash(find *) Bash(curl *)
---

# Web Monitor Analyze-Only Protocol

You are handling an oh-my-feishu Web Monitor analysis task. A monitored service produced a new traceback. Analyze the problem and propose a fix plan WITHOUT making any code changes.

## Input

Use these input sources in order:

1. The JSON context passed after `/web-monitor-analyze-only` in the prompt.
2. Environment variables:
   - `SERVICE_NAME`
   - `GITHUB_REPO_OWNER`
   - `GITHUB_REPO_NAME`
   - `TRACEBACK_URL`
   - `TARGET_REPO_PATH`
3. Optional fallback files if present:
   - `.claude/triggers/latest.json`
   - `workspace/.claude/triggers/latest.json`

The Gateway runs this skill from the main oh-my-feishu `workspace`. The monitored service repository is provided as `localRepoPath` in the structured context and as `TARGET_REPO_PATH` in the environment.

## Safety Rules (ABSOLUTE — never violate)

1. **Read-Only**: Do NOT use Edit or Write tools. This is analysis only.
2. **No Modifications**: Do not create, modify, or delete any files.
3. **No Git Operations**: Do not commit, push, or create branches.

## Analysis Steps

### Step 1: Detect
Confirm the bug context. Identify:
- Service name and target repo
- Local service repository path (`TARGET_REPO_PATH` or `localRepoPath`)
- Error type (exception, assertion, timeout)
- Affected file(s) if mentioned in traceback

### Step 2: Fetch Log
Read the relevant log or traceback:
- If `traceback_url` is set: `curl` it to get the full traceback
- If `error_log` points to a file path: `Read` it.
- If `error_log` is inline text: use it directly.

### Step 3: Analyze Root Cause
Use reasoning (not guessing) to determine:
- Why the error happens
- Which line(s) need to change
- What the minimal correct fix looks like

Read the relevant source files in the target repository to understand the context.

### Step 4: Propose Fix
Generate a minimal, focused fix proposal:
- List the specific files that need to be changed
- Describe the change for each file
- Explain why this fix addresses the root cause
- Estimate the risk level (low/medium/high)

## Output Format

At the end of the analysis, write a JSON result file and a brief summary to stdout.

### Step 1: Write Result File

Write a JSON file to `.claude/triggers/analysis.json` (create the directory if needed).

**IMPORTANT**: All string values MUST be in Chinese (中文) for better readability in Feishu cards.

```json
{
  "status": "analyzed",
  "service": "<服务名称>",
  "root_cause": "<用中文解释错误发生的根本原因>",
  "affected_files": [
    {
      "path": "<相对于仓库根目录的路径>",
      "line_range": "<行号范围>",
      "change_description": "<需要修改的内容描述>"
    }
  ],
  "proposed_fix": "<详细的修复方案描述>",
  "risk_level": "<low|medium|high>",
  "risk_reason": "<用中文解释为什么是这个风险等级>",
  "verification_command": "<修复后运行的验证命令>",
  "follow_up": "<用户需要手动执行的后续步骤，如无则填'无'>"
}
```

### Step 2: Print Summary

After writing the file, print a one-line summary to stdout:

```
Analysis completed. See analysis file for details.
```

The Gateway will read the JSON file to build the confirmation card. Do NOT rely on stdout JSON parsing.

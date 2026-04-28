---
name: safety-check
description: >
  Review proposed code changes for safety violations:
  path traversal, excessive diff size, missing tests, hardcoded secrets.
  Gatekeeper for auto-repair pipeline.
---

# Safety Check Protocol

## Input

- A git diff (from `git diff` or proposed edits)
- Repository root path

## Checks

1. **Path Guard**
   - Every changed file must be inside `REPO_ROOT`
   - Reject any absolute path outside the repo

2. **Diff Size Guard**
   - Max files: 10
   - Max lines changed: 500
   - If exceeded → BLOCK and require human approval

3. **Secret Scan**
   - Reject diffs containing: `api_key`, `password`, `token`, `secret`
   - Except in test fixtures clearly marked as fake

4. **Test Presence**
   - If the fix modifies logic, there must be a corresponding test change
   - Or the existing tests must already cover the fixed path

## Output

```json
{
  "approved": true | false,
  "violations": ["path_guard", "diff_size", "secret", "missing_tests"],
  "reason": "human readable explanation"
}
```

If `approved: false`, STOP the pipeline and report.

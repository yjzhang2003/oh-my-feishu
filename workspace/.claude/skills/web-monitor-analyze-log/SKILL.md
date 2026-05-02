---
name: web-monitor-analyze-log
description: >
  Web Monitor helper. Analyze service error logs and tracebacks to identify
  root cause, affected files, and a minimal fix.
---

# Log Analysis Protocol

## Input

- A traceback string or log file path
- Optional: service source code directory

## Procedure

1. **Parse the traceback**
   - Identify the exception type and message
   - Note the file path and line number of the error
   - Trace the call stack to find the origin

2. **Read the code**
   - `Read` the file at the error line
   - Read 5 lines before and after for context

3. **Determine root cause**
   - What precondition was violated?
   - Was it missing input validation, wrong logic, type mismatch?

4. **Propose fix**
   - Write a concise explanation
   - Include a code snippet showing the proposed change

## Output Format

```markdown
## Error Summary
<one sentence>

## Root Cause
<2-3 sentences>

## Affected File(s)
- `path/to/file.py` line N

## Proposed Fix
```python
# before
...
# after
...
```

## Confidence
High / Medium / Low
```

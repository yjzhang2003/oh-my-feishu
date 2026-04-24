# Feishu Agent — Technical Specification

## Product Idea
Build an autonomous repair Agent that monitors a web service, detects errors/bugs, analyzes root causes via Claude LLM, auto-fixes code, submits PRs, and notifies developers via Feishu interactive cards.

## Requirements

### Functional
1. **Service Monitoring**: Health checks, log tailing, GitHub issue polling.
2. **Error Detection**: Detect exceptions, failed health checks, new bug reports.
3. **Log Analysis**: Fetch traceback/error logs and feed to LLM for root-cause analysis.
4. **Auto-Repair**: Generate code diff, apply fix, run tests, commit to branch, open PR.
5. **Feishu Integration**: Deep integration with Feishu (Lark) via lark-oapi SDK so developers can chat with / command the Agent in groups/DMs.
6. **Interactive Cards**: Send rich Feishu cards with bug summary, diff preview, PR link, approve/reject buttons.
7. **Skill System**: Extensible skill registry — add new domain tools without core changes.
8. **Hook System**: Lifecycle callbacks (before_repair, after_repair, etc.) for logging, metrics, custom gates.

### Non-Functional
- Safety: Path guard prevents modifications outside designated repo; diff size limits; mandatory test run.
- Coverage: ≥ 80% unit-test coverage for agent/, gateway/, repair/.
- Extensibility: Skills and hooks loaded at runtime from filesystem.
- Latency: Feishu response < 10s; end-to-end repair < 5min.

## Tech Stack
- **LLM**: Claude via Anthropic Agent SDK (`anthropic` Python package).
- **Feishu**: `lark-oapi` (runtime bot); `larksuite/lark-cli` reserved for CI/deployment.
- **GitHub**: `httpx` + GitHub REST API for PR creation.
- **Testing**: `pytest`, `pytest-asyncio`, `pytest-cov`.
- **Demo**: Flask (intentionally buggy web service).

## Architecture Summary
```
agent/      — Claude Agent SDK orchestration (core, tools, prompts)
gateway/    — Feishu event dispatcher, webhook server, card builder
skills/     — Skill registry + built-in skills (service_monitor, auto_repair)
hooks/      — Hook manager + built-in hooks
monitor/    — Log watcher, health checker, issue poller
repair/     — 7-step repair flow + safety gates + GitHub client
demo/       — Buggy Flask service + tests
```

## Safety Gates
1. PathGuard: realpath must be inside `REPO_ROOT`.
2. DiffGuard: reject patches touching >N files or >M lines unless explicitly allowed.
3. TestGuard: all tests must pass before PR is created.
4. Optional Human-in-the-Loop for destructive changes.

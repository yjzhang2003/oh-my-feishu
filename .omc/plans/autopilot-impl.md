# Feishu Agent — Autopilot Implementation Plan

## Source
Derived from `.omc/plans/feishu-agent-integration-plan.md` and `.omc/autopilot/spec.md`.

## Goal
Autonomously implement the full Feishu Agent stack with test coverage ≥ 80%, safety gates, and extensible skill/hook systems.

## Execution Order

### Stage 1 — Bootstrap
- `pyproject.toml`
- `.env.example`
- `.gitignore`
- Verify pytest baseline

### Stage 2 — Extension Systems
- `skills/registry.py` + `skills/_builtins/`
- `hooks/manager.py` + `hooks/built_in.py`
- Unit tests

### Stage 3 — Agent Core + Tools
- `agent/core.py`
- `agent/tools/` (read_log, read_code, run_test, git_commit, send_feishu_card)
- `agent/prompts/system_prompt.md`
- Unit tests

### Stage 4 — Repair Pipeline
- `repair/flow.py`
- `repair/safety.py`
- `repair/github_client.py`
- Unit tests

### Stage 5 — Feishu Gateway
- `gateway/bot.py`
- `gateway/card_builder.py`
- `gateway/webhook_server.py`
- Unit tests

### Stage 6 — Demo + Integration
- `demo/web_service/app.py` (3 intentional bugs)
- `demo/web_service/tests/`
- Integration test

### Stage 7 — QA + Validation
- pytest --cov ≥ 80%
- Build verification
- Code review + security review

## Commit Strategy
- One commit per Stage (1–6).
- Each commit preceded by code review.
- Final commit after Stage 7 validation.

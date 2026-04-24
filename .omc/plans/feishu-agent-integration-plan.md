# Feishu Agent Integration Plan — Claude Agent SDK + Lark CLI

## Requirements Restatement

Build an autonomous repair Agent that:
1. Monitors a simple Web service (logs + health checks + GitHub issues).
2. When an error or new bug is detected, automatically fetches the Traceback / error log.
3. Uses an LLM (Claude via Agent SDK) to analyze root cause.
4. Automatically modifies code, runs tests, and submits a PR.
5. Sends a Feishu (Lark) interactive card to developers: "I found a bug and have fixed it for you, please Review."

Additionally:
- Power the entire Agent with **Claude Agent SDK** (Python).
- Integrate deeply with **Feishu** via `larksuite/lark-cli` (or `lark-oapi`) so developers can chat with / command the Agent directly in Feishu groups / DMs.
- Reserve clean extension points for **skills** (domain-specific tool bundles) and **hooks** (lifecycle callbacks).

## Acceptance Criteria

| # | Criteria | Testable? |
|---|----------|-----------|
| 1 | Agent starts and connects to Feishu without crashing. | Yes — startup smoke test. |
| 2 | Feishu `@bot` mention or slash command triggers Agent response within 10 s. | Yes — E2E pytest + manual. |
| 3 | Triggering a demo bug (`/divide?a=10&b=0`) causes Agent to detect error, read traceback, propose fix, run tests, open PR, and send Feishu card — end-to-end within 5 min. | Yes — demo script + screenshot/video. |
| 4 | Skill system can load a new skill (new directory + YAML manifest) without code changes to core. | Yes — unit test loading a dummy skill. |
| 5 | Hook system allows pre/post callbacks on repair flow stages without core edits. | Yes — unit test registering dummy hooks. |
| 6 | Safety gate prevents AI from modifying files outside designated repo paths. | Yes — unit test path guard. |
| 7 | 80 %+ unit-test coverage for `agent/`, `gateway/`, `repair/` packages. | Yes — pytest --cov. |

## Architecture Overview

```text
feishu-agent/
├── agent/                      # Claude Agent SDK orchestration
│   ├── __init__.py
│   ├── core.py                 # Agent loop, session manager
│   ├── runner.py               # High-level: run_repair_task()
│   ├── tools/                  # Built-in tool definitions (Agent SDK format)
│   │   ├── __init__.py
│   │   ├── read_log.py
│   │   ├── read_code.py
│   │   ├── run_test.py
│   │   ├── git_commit.py
│   │   └── send_feishu_card.py
│   └── prompts/
│       └── system_prompt.md
├── gateway/                    # Feishu (Lark) integration
│   ├── __init__.py
│   ├── bot.py                  # Lark CLI / lark-oapi event dispatcher
│   ├── webhook_server.py       # Optional: HTTP server for Feishu webhooks
│   └── card_builder.py         # Construct interactive Feishu cards
├── skills/                     # EXTENSION: skill registry + manifests
│   ├── __init__.py
│   ├── registry.py             # SkillLoader, Skill base class
│   ├── _builtins/              # Built-in skills shipped with repo
│   │   ├── service_monitor/
│   │   │   ├── skill.yaml
│   │   │   └── monitor.py
│   │   └── auto_repair/
│   │       ├── skill.yaml
│   │       └── repair.py
│   └── README.md               # How to add a new skill
├── hooks/                      # EXTENSION: lifecycle hook system
│   ├── __init__.py
│   ├── manager.py              # HookManager, register / emit
│   ├── built_in.py             # Default hooks (logging, metrics)
│   └── README.md               # How to register a hook
├── monitor/                    # Concrete monitoring implementations
│   ├── __init__.py
│   ├── log_watcher.py          # Tail / parse logs
│   ├── health_checker.py       # HTTP health probe
│   └── issue_poller.py         # GitHub Issues polling
├── repair/                     # Auto-repair flow (7-step pipeline)
│   ├── __init__.py
│   ├── flow.py                 # Step orchestrator
│   ├── safety.py               # Path guard + diff review gate
│   └── github_client.py        # PR creation, branch push
├── demo/                       # Intentionally buggy Flask service
│   └── web_service/
│       ├── app.py
│       └── tests/
├── tests/                      # pytest suite
├── pyproject.toml
├── .env.example
└── README.md
```

## Implementation Phases

### Phase 0 — Bootstrap & Tooling (1–2 h)
1. Create `pyproject.toml` with deps: `anthropic>=0.40`, `lark-oapi`, `httpx`, `pytest`, `pytest-asyncio`, `pytest-cov`, `python-dotenv`.
2. Create `.env.example` listing all required secrets (`ANTHROPIC_API_KEY`, `FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `GITHUB_TOKEN`, etc.).
3. Add `.gitignore`.
4. Verify `pytest` runs empty suite.

### Phase 1 — Skill & Hook Extension Systems (2–3 h)
1. **`skills/registry.py`**
   - `Skill` abstract base (load, unload, get_tools).
   - `SkillRegistry` discovers subdirectories under `skills/` containing `skill.yaml` manifest.
   - Unit test: load a dummy skill and assert its tools are exported.
2. **`hooks/manager.py`**
   - `HookManager` with `register(event, callback)` and `emit(event, **kwargs)`.
   - Events: `before_repair`, `after_repair`, `before_tool_call`, `after_tool_call`, `on_error`.
   - Unit test: register a hook, emit event, assert callback received kwargs.
3. Write `skills/README.md` and `hooks/README.md` documenting contract.

### Phase 2 — Agent Core + Built-in Tools (3–4 h)
1. **`agent/prompts/system_prompt.md`**
   - Role: senior SRE / SWE bot.
   - Safety rules: never modify outside repo root, always run tests before commit, ask for human confirmation on destructive ops.
2. **`agent/tools/`**
   - Implement each tool as a Python function decorated for Agent SDK (`@tool` or manual schema).
   - `read_log`: tail file or fetch remote log URL.
   - `read_code`: read file(s) with line numbers.
   - `run_test`: execute pytest / unittest, capture stdout/stderr.
   - `git_commit`: stage, commit, push branch, open PR via GitHub API.
   - `send_feishu_card`: call gateway helper to post interactive card.
3. **`agent/core.py`**
   - Initialize `Anthropic` client.
   - Build tool list from builtins + loaded skills.
   - Conversation loop with tool-use iteration.
4. Unit tests for each tool with mocked IO.

### Phase 3 — Repair Flow + Safety Gates (2–3 h)
1. **`repair/flow.py`**
   - 7-step pipeline:
     1. Detect (monitor signal)
     2. Fetch log
     3. Analyze (LLM)
     4. Propose diff
     5. Safety review (path + diff size check)
     6. Apply & test
     7. Commit & notify
   - Each step emits hooks (`before_repair`, `after_repair`, etc.).
2. **`repair/safety.py`**
   - `PathGuard`: realpath must be inside `REPO_ROOT`.
   - `DiffGuard`: reject patches touching >N files or >M lines unless explicitly allowed.
   - Optional: require human-in-the-loop for destructive changes.
3. **`repair/github_client.py`**
   - Thin wrapper around `httpx` for GitHub REST API: create branch, commit, push (via GitHub API or local git), open PR.
4. Unit tests mocking GitHub API.

### Phase 4 — Feishu Gateway (3–4 h)
1. **`gateway/bot.py`**
   - Use `lark-oapi` (or `larksuite/lark-cli` if it exposes a Python API; otherwise shell out to CLI) to listen for:
     - Group `@mentions`
     - P2P messages
     - Slash commands (`/repair`, `/status`)
   - Map each event to `agent/core.py` entry point.
2. **`gateway/webhook_server.py`** (optional, if using webhook mode instead of WS)
   - FastAPI/Flask endpoint verifying Feishu request signature.
3. **`gateway/card_builder.py`**
   - Helper to build interactive cards with: bug summary, diff preview, PR link, "Approve / Reject" buttons.
4. E2E test with mocked Feishu API.

### Phase 5 — Demo Web Service & Integration Test (2 h)
1. **`demo/web_service/app.py`** — Flask app with 3 intentional bugs:
   - ZeroDivisionError
   - KeyError on missing dict key
   - TypeError on string + int
2. **`demo/web_service/tests/`** — pytest suite: 6 pass, 3 fail before fix.
3. Integration script: trigger bug → monitor detects → repair flow runs → PR created → Feishu card sent.

### Phase 6 — Documentation & Video Prep (2 h)
1. Update root `README.md` with architecture, setup, and run instructions.
2. Prepare demo video script / checklist for challenge submission.

## Dependencies

| Package | Purpose |
|---------|---------|
| `anthropic` | Claude Agent SDK + API client |
| `lark-oapi` | Feishu (Lark) official Python SDK |
| `httpx` | GitHub API + async HTTP |
| `pytest`, `pytest-asyncio`, `pytest-cov` | Testing |
| `python-dotenv` | Env var management |
| `fastapi` / `flask` | Optional webhook server |

## Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| `larksuite/lark-cli` has no Python API (only CLI binary); forces shell-out or we pivot to `lark-oapi`. | **HIGH** | **Decision**: use `lark-oapi` for runtime bot logic; reserve `lark-cli` for CI / deployment automation. Document this choice. |
| AI-generated patches break more than they fix. | **HIGH** | Multi-layer safety: path guard, diff size limit, mandatory test run, optional human approval gate. |
| GitHub token scopes insufficient for PR creation. | **MEDIUM** | Token checklist in `.env.example`; fail fast at startup if scopes missing. |
| Feishu interactive card JSON schema changes. | **MEDIUM** | Isolate card building in `gateway/card_builder.py`; add schema validation. |
| Context window overflow when feeding large tracebacks. | **MEDIUM** | Truncate / summarize logs >4k tokens; use prompt compression techniques. |

## Estimated Complexity: HIGH
- Phase 0: 1–2 h
- Phase 1: 2–3 h
- Phase 2: 3–4 h
- Phase 3: 2–3 h
- Phase 4: 3–4 h
- Phase 5: 2 h
- Phase 6: 2 h
- **Total: 15–22 h**

## Verification Steps

1. `pytest tests/ -v --cov=agent --cov=gateway --cov=repair --cov-report=term-missing` → coverage ≥ 80%.
2. `python -m demo.web_service.app` + `curl "http://localhost:5000/divide?a=10&b=0"` + run Agent → observe Feishu card within 5 min.
3. Add a dummy skill under `skills/my_skill/` with `skill.yaml` + `my_tool.py` → restart Agent → skill tools appear in tool list.
4. Register a dummy hook printing to stdout → trigger repair → hook output visible.

---

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes / no / modify)

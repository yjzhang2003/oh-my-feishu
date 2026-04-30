# Gateway Features

## Goal

Gateway features turn background capabilities into a single execution model:

`trigger -> event -> feature -> runtime -> result`

This separates:

- trigger collection
- business logic
- Claude task execution
- Feishu result publishing

Regular chat remains streaming. Gateway features are non-streaming by default and should publish only final results.

## Core Types

The implementation lives under `src/gateway/features/`.

- `GatewayEvent`: normalized trigger input from Feishu, timer, webhook, CLI, or internal callers
- `GatewayFeature`: a named module that declares supported triggers and handles matching events
- `GatewayRuntime`: runtime capabilities exposed to features, including:
  - `invokeMainClaude()`
  - `sendFeishuMessage()`
  - `updateCard()`
  - `log`
- `GatewayFeatureRegistry`: feature lookup and trigger matching
- `GatewayFeatureRunner`: executes one matched feature and normalizes failures

## Execution Rules

1. A trigger source creates a `GatewayEvent`.
2. The event is routed through `GatewayFeatureRunner`.
3. The matched feature performs business logic.
4. If Claude is needed, the feature calls `runtime.invokeMainClaude()`.
5. Only the final result is returned or published.

Features should not depend on Feishu command parsing details. Commands are only adapters.

## Current Features

- `web-monitor`
  - input: `traceback.detected`
  - source: timer, webhook, internal
  - behavior: call main Claude silently and optionally notify Feishu

- `service-admin`
  - input: `service.command`
  - source: Feishu
  - behavior: manage the service registry and return structured card content

- `status`
  - input: `status.query`
  - source: Feishu
  - behavior: collect runtime status and return a final text block

- `repair`
  - input: `repair.requested`
  - source: Feishu
  - behavior: write trigger context, then invoke main Claude silently with the `auto-repair` protocol

## Integration Points

- `FeishuWebSocket` owns the shared `GatewayFeatureRunner`
- `MessageRouter` injects the runner into `CommandContext`
- `TracebackMonitor` reuses the same runner instead of calling repair logic directly
- `invokeClaudeTask()` is the non-streaming Claude execution path for Gateway features
- `oh-my-feishu gateway ...` exposes a CLI adapter over the Gateway IPC socket

## CLI Access

Gateway features are available through the local CLI when the Gateway service is running:

```bash
oh-my-feishu gateway list
oh-my-feishu gateway status
oh-my-feishu gateway trigger <feature> <eventType> '<jsonPayload>'
```

This is the intended bridge for Claude Code skills that need to inspect or trigger Gateway capabilities from the workspace.

## Migration Rule

When adding a new Gateway capability:

1. create a feature under `src/gateway/features/<name>/`
2. register it in `createDefaultGatewayFeatureRegistry()`
3. adapt the trigger source to emit a `GatewayEvent`
4. keep UI concerns in the adapter layer
5. keep the feature focused on business logic and final result generation

If a feature still relies on legacy trigger files or old skills, preserve that compatibility first, then remove it in a later migration.

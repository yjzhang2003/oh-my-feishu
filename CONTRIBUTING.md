# Contributing to oh-my-feishu

## Architecture

### Overview

```
Feishu App
    │
    │ 扫码添加 Bot
    ▼
┌─────────────────────────────┐
│  WebSocket 长连接            │
│  (lark_oapi SDK)            │
└──────────┬──────────────────┘
           │ 消息事件
           ▼
┌─────────────────────────────┐
│  Gateway                     │
│  ├── MessageRouter          │
│  ├── CardDispatcher         │
│  └── SessionStore            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Claude Code CLI             │
│  └── Skills                  │
└─────────────────────────────┘
```

### Core Components

#### Gateway (`src/feishu/`)

| File | Purpose |
|------|---------|
| `websocket-connector.ts` | WebSocket connection, event dispatcher |
| `message-router.ts` | Routes messages to commands, chat, or flows |
| `card-dispatcher.ts` | Handles card button callbacks |
| `card-builder.ts` | Builds interactive Feishu cards |
| `session-store.ts` | In-memory session state with TTL |
| `commands/` | Command handlers (help, status, service, repair) |

#### Skills (`workspace/.claude/skills/`)

| Skill | Purpose |
|-------|---------|
| `lark-chat-guide` | Navigation and skill discovery |
| `lark-im` | Instant messaging |
| `lark-doc` | Document operations |
| `auto-repair` | Automatic error fixing |
| `notify-feishu` | Feishu notifications |
| `service-manager` | Service registry management |

### Message Flow

1. **Message Received** → `websocket-connector.handleMessage()`
2. **Dedup Check** → Skip if already processed
3. **Route** → `MessageRouter.handleMessage()`
   - If command → `CommandRegistry` → specific handler
   - If chat → `invokeClaudeChat()` → Claude Code CLI
   - If card action → `CardDispatcher.dispatch()`
4. **Response** → Send via `sendTextMessage()` or `sendCardMessage()`

### Card Interactions

Cards use callback buttons with action values:

```
nav:help      → Shows help
nav:repair    → Starts repair flow
nav:service   → Opens service management
service:add-start → Starts service registration flow
```

## Development

### Setup

```bash
npm install
npm run build
npm link
```

### Commands

```bash
oh-my-feishu        # Interactive CLI (configure, manage services)
npm start            # Start Gateway
npm run build        # TypeScript build
npm test             # Run tests
npm run typecheck   # Type check
```

Gateway feature architecture is documented in [GATEWAY_FEATURES.md](GATEWAY_FEATURES.md).

### Adding a New Command

1. Create `src/feishu/commands/<name>-command.ts`:

```typescript
export class MyCommand implements CommandHandler {
  name = '/mycommand';
  description = 'Does something';

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.sendText('Hello!');
  }
}
```

2. Register in `websocket-connector.ts`:

```typescript
this.commandRegistry.register(new MyCommand());
```

### Adding a New Card Flow

1. Add flow state to `SessionStore`:

```typescript
type InteractionFlow = 'none' | 'my-flow-step1' | 'my-flow-step2';
```

2. Create flow handler in `src/feishu/interactions/flows/`

3. Route card actions in `CardDispatcher`

## Project Structure

```
oh-my-feishu/
├── src/
│   ├── cli/                  # Interactive CLI (Ink/React)
│   ├── feishu/               # Gateway core
│   │   ├── commands/          # Command handlers
│   │   └── interactions/      # Card flows
│   ├── monitor/              # TracebackMonitor
│   ├── service/              # Service registry
│   ├── trigger/              # Claude CLI invoker
│   └── config/              # Environment config
├── workspace/
│   └── .claude/             # Claude Code workspace
│       ├── skills/          # Skills
│       └── services.json    # Service registry
├── docs/                    # Screenshots, etc.
└── CONTRIBUTING.md          # This file
```

## License

MIT

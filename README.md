# oh-my-feishu

> The best way to use Claude Code on Feishu.

![Screenshots placeholder](docs/screenshots.png)

## What is this?

`oh-my-feishu` brings Claude Code to Feishu with deep integration. It turns Feishu into a powerful interface for Claude Code — where every conversation becomes a bridge to your development environment.

## Features

- **Deep Feishu Integration** — Native WebSocket connection, no public URL needed
- **Interactive Cards** — Rich button-based interactions for navigation and workflows
- **Gateway Architecture** — Extensible message routing and command system
- **Service Discovery** — Register services and let Claude Code discover your infrastructure
- **One-click Setup** — QR code onboarding, up in 60 seconds

## Quick Start

```bash
# Clone
git clone https://github.com/yjzhang2003/oh-my-feishu.git
cd oh-my-feishu

# Install
npm install
npm run build

# Configure (opens interactive CLI)
npm run cli

# Start
npm start
```

Scan the QR code with Feishu, and you're ready to go.

## How it Works

Every message in Feishu flows through our Gateway:

```
You → Feishu → Gateway → Claude Code → Gateway → Feishu → You
```

The Gateway handles:
- Message routing (text, cards, commands)
- Session state management
- Interactive card callbacks
- Service discovery and registry

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture details, development guide, and contribution workflow.

## License

MIT

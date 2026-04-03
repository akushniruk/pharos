# Setup Guide

#setup #quickstart

This guide walks you through installing and running the Multi-Agent Observability system.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Go](https://go.dev/) | 1.25+ | Runs the server |
| [Python](https://python.org/) + [uv](https://docs.astral.sh/uv/) | Python 3.11+, uv any | Runs the hook scripts |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | latest | The CLI being observed |
| [just](https://github.com/casey/just) | any | Optional task runner |

Install Go (see [go.dev/dl](https://go.dev/dl/) for platform-specific installers):
```bash
# macOS (Homebrew)
brew install go

# Linux (snap)
sudo snap install go --classic
```

Install uv:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/disler/claude-code-hooks-multi-agent-observability.git
cd claude-code-hooks-multi-agent-observability

# 2. Install all dependencies
make install
# or: just install

# 3. Start both server and client in development mode
make dev
# or: just start
# or: ./scripts/start-system.sh

# 4. Open the dashboard in your browser
open http://localhost:5173

# 5. Start a Claude Code session (in any project that has the .claude hooks configured)
# Events will start streaming to the dashboard immediately
```

The server runs on **port 4000** (HTTP + WebSocket). The client dev server runs on **port 5173**.

## Integrating Hooks Into Your Projects

To send events from your own Claude Code projects, copy the hooks:

```bash
# Copy the entire .claude directory to your project
cp -R .claude /path/to/your-project/

# Then edit .claude/settings.json in your project and replace
# --source-app YOUR_PROJECT_NAME with your own identifier
```

Minimal `settings.json` example:
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "uv run .claude/hooks/send_event.py --source-app my-app --event-type PreToolUse --summarize"
      }]
    }]
  }
}
```

See [[hook-events]] for all 12 event types you can hook into.

## Environment Variables

### Server (`apps/server-go/`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `4000` | Port the Go HTTP/WebSocket server listens on |
| `DB_PATH` | `events.db` | Path to the SQLite database file (relative to server dir) |

### Client (`apps/client-solid/`)

The Solid client reads its API settings directly from Vite environment variables. Typical local development uses the default daemon port `4000`, so no `.env` file is required.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_PORT` | `4000` | Rust daemon port used for HTTP and WebSocket traffic |
| `CLIENT_PORT` | `5173` | Vite dev server port |

### Hook Scripts (`.env` at project root)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key (used by `--summarize` flag) |
| `ENGINEER_NAME` | No | Your name for logging/identification |
| `OPENAI_API_KEY` | No | OpenAI key for multi-model support |
| `ELEVENLABS_API_KEY` | No | ElevenLabs key for TTS in `notification.py` |
| `FIRECRAWL_API_KEY` | No | Firecrawl key for web scraping features |

Copy `.env.sample` to `.env` and fill in the values:
```bash
cp .env.sample .env
```

## Development Workflow

### Modifying Hook Scripts

Hook scripts live in `.claude/hooks/`. They are plain Python scripts executed by `uv run`, so no virtual environment setup is needed — `uv` handles dependencies automatically from the inline script metadata at the top of each file.

After editing a hook, test it by triggering the relevant Claude Code action or using:
```bash
just test-event
# or manually:
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"source_app":"test","session_id":"test-123","hook_event_type":"PreToolUse","payload":{"tool_name":"Bash"}}'
```

### Modifying the Server

The server entry point is `apps/server-go/cmd/pharos/main.go`. Run in watch mode:
```bash
just server
# or: cd apps/server-go && go run cmd/pharos/main.go
```

### Modifying the Client

The client entry point is `apps/client-solid/src/App.tsx`. Run the Vite dev server:
```bash
just client
# or: cd apps/client-solid && pnpm dev
```

### Resetting State

```bash
just db-reset      # Wipe the SQLite database
just stop          # Stop all background processes
just restart       # Stop then start everything
```

### Useful just Recipes

```bash
just               # List all available recipes
just health        # Check if server and client are responding
just hooks         # List all hook scripts
just open          # Open http://localhost:5173 in the browser
```

## Verifying the System

Run the system validation script:
```bash
./scripts/test-system.sh
```

This checks that the server is reachable, posts a test event, and verifies the WebSocket endpoint.

## Related Docs

- [[architecture]] — How all the components fit together
- [[hook-events]] — Event type reference with payload schemas
- [[api-reference]] — Server API endpoint reference
- [[deployment]] — Docker and production deployment

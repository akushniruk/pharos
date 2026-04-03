# Pharos — AI Agent Observability
# Usage: make <target>

.DEFAULT_GOAL := help

SERVER_PORT ?= 4000
CLIENT_PORT ?= 5173
PROJECT_ROOT := $(shell pwd)
CARGO := rustup run 1.85.1 cargo

.PHONY: help dev stop client build test health open

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ─── Development ────────────────────────────────────────

dev: ## Start daemon + client (two terminals needed)
	@echo "Terminal 1: make daemon"
	@echo "Terminal 2: make client"

daemon: ## Start the Pharos daemon (port $(SERVER_PORT))
	cd $(PROJECT_ROOT)/apps/daemon-rs && PHAROS_DAEMON_PORT=$(SERVER_PORT) $(CARGO) run -- serve

client: ## Start client dev server (port $(CLIENT_PORT))
	cd $(PROJECT_ROOT)/apps/client-solid && VITE_PORT=$(CLIENT_PORT) pnpm dev

build: ## Build client for production
	cd $(PROJECT_ROOT)/apps/client-solid && pnpm build

install: ## Install client dependencies
	cd $(PROJECT_ROOT)/apps/client-solid && pnpm install

# ─── Testing ────────────────────────────────────────────

test: ## Run all daemon tests
	cd $(PROJECT_ROOT)/apps/daemon-rs && $(CARGO) test

clippy: ## Run clippy lints on daemon
	cd $(PROJECT_ROOT)/apps/daemon-rs && $(CARGO) clippy

# ─── Database ───────────────────────────────────────────

db-reset: ## Delete the daemon SQLite database
	rm -f $(PROJECT_ROOT)/pharos-daemon.db
	@echo "Database reset"

# ─── Utilities ──────────────────────────────────────────

health: ## Check daemon and client health
	@curl -sf http://localhost:$(SERVER_PORT)/health > /dev/null 2>&1 \
	  && echo "Daemon: UP (port $(SERVER_PORT))" \
	  || echo "Daemon: DOWN (port $(SERVER_PORT))"
	@curl -sf http://localhost:$(CLIENT_PORT) > /dev/null 2>&1 \
	  && echo "Client: UP (port $(CLIENT_PORT))" \
	  || echo "Client: DOWN (port $(CLIENT_PORT))"

open: ## Open the dashboard in browser
	open http://localhost:$(CLIENT_PORT)

# Pharos — AI Agent Observability
# Usage: make <target>

.DEFAULT_GOAL := help

SERVER_PORT ?= 4000
CLIENT_PORT ?= 5173
PROJECT_ROOT := $(shell pwd)
CARGO := rustup run 1.85.1 cargo
RUN_DIR := $(PROJECT_ROOT)/.run
LOG_DIR := $(RUN_DIR)/logs
DAEMON_PID_FILE := $(RUN_DIR)/daemon.pid
CLIENT_PID_FILE := $(RUN_DIR)/client.pid
DAEMON_DB_PATH ?= $(PROJECT_ROOT)/apps/daemon-rs/pharos-daemon.db

.PHONY: help dev up down daemon client build test health open db-reset

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ─── Development ────────────────────────────────────────

dev: up ## Start daemon + client in background

daemon: ## Start the Pharos daemon (port $(SERVER_PORT))
	cd $(PROJECT_ROOT)/apps/daemon-rs && \
	PHAROS_DAEMON_PORT=$(SERVER_PORT) \
	PHAROS_DAEMON_DB_PATH=$(DAEMON_DB_PATH) \
	$(CARGO) run -- serve

client: ## Start client dev server (port $(CLIENT_PORT))
	cd $(PROJECT_ROOT)/apps/client-solid && VITE_PORT=$(CLIENT_PORT) pnpm dev

up: ## Start daemon + client in background and write pid files
	@mkdir -p $(RUN_DIR) $(LOG_DIR)
	@if [ -f "$(DAEMON_PID_FILE)" ] && kill -0 "$$(cat "$(DAEMON_PID_FILE)")" 2>/dev/null; then \
		echo "Daemon already running (pid $$(cat "$(DAEMON_PID_FILE)"))"; \
	else \
		cd $(PROJECT_ROOT)/apps/daemon-rs && \
		nohup env PHAROS_DAEMON_PORT=$(SERVER_PORT) PHAROS_DAEMON_DB_PATH=$(DAEMON_DB_PATH) $(CARGO) run -- serve \
			> "$(LOG_DIR)/daemon.log" 2>&1 & \
		echo $$! > "$(DAEMON_PID_FILE)"; \
		echo "Started daemon on http://127.0.0.1:$(SERVER_PORT) (pid $$(cat "$(DAEMON_PID_FILE)"))"; \
	fi
	@if [ -f "$(CLIENT_PID_FILE)" ] && kill -0 "$$(cat "$(CLIENT_PID_FILE)")" 2>/dev/null; then \
		echo "Client already running (pid $$(cat "$(CLIENT_PID_FILE)"))"; \
	else \
		cd $(PROJECT_ROOT)/apps/client-solid && \
		nohup env VITE_PORT=$(CLIENT_PORT) pnpm dev \
			> "$(LOG_DIR)/client.log" 2>&1 & \
		echo $$! > "$(CLIENT_PID_FILE)"; \
		echo "Started client on http://127.0.0.1:$(CLIENT_PORT) (pid $$(cat "$(CLIENT_PID_FILE)"))"; \
	fi
	@echo "Logs: $(LOG_DIR)/daemon.log and $(LOG_DIR)/client.log"

down: ## Stop background daemon + client started by make up/dev
	@if [ -f "$(CLIENT_PID_FILE)" ]; then \
		pid="$$(cat "$(CLIENT_PID_FILE)")"; \
		if kill -0 "$$pid" 2>/dev/null; then \
			kill "$$pid" && echo "Stopped client ($$pid)"; \
		else \
			echo "Client pid file found, but process $$pid is not running"; \
		fi; \
		rm -f "$(CLIENT_PID_FILE)"; \
	else \
		echo "Client not running"; \
	fi
	@if [ -f "$(DAEMON_PID_FILE)" ]; then \
		pid="$$(cat "$(DAEMON_PID_FILE)")"; \
		if kill -0 "$$pid" 2>/dev/null; then \
			kill "$$pid" && echo "Stopped daemon ($$pid)"; \
		else \
			echo "Daemon pid file found, but process $$pid is not running"; \
		fi; \
		rm -f "$(DAEMON_PID_FILE)"; \
	else \
		echo "Daemon not running"; \
	fi

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
	rm -f "$(DAEMON_DB_PATH)" "$(DAEMON_DB_PATH)-shm" "$(DAEMON_DB_PATH)-wal"
	@echo "Database reset at $(DAEMON_DB_PATH)"

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

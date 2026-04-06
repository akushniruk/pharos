# Pharos — AI Agent Observability
# Usage: make <target>

.DEFAULT_GOAL := help

SERVER_PORT ?= 4000
CLIENT_PORT ?= 5173
PROJECT_ROOT := $(shell pwd)
CARGO := cargo
RUN_DIR := $(PROJECT_ROOT)/.run
LOG_DIR := $(RUN_DIR)/logs
DAEMON_PID_FILE := $(RUN_DIR)/daemon.pid
CLIENT_PID_FILE := $(RUN_DIR)/client.pid
DAEMON_DB_PATH ?= $(PROJECT_ROOT)/apps/daemon-rs/pharos-daemon.db
DAEMON_BIN := $(PROJECT_ROOT)/apps/daemon-rs/target/debug/pharos-daemon

.PHONY: help dev up down daemon client build test health open db-reset line-budget

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
	@daemon_port_pid="$$(lsof -tiTCP:$(SERVER_PORT) -sTCP:LISTEN 2>/dev/null | head -n 1)"; \
	if [ -n "$$daemon_port_pid" ]; then \
		echo "Daemon already running on http://127.0.0.1:$(SERVER_PORT) (pid $$daemon_port_pid)"; \
		echo "$$daemon_port_pid" > "$(DAEMON_PID_FILE)"; \
	else \
		cd $(PROJECT_ROOT)/apps/daemon-rs && $(CARGO) build > /dev/null && \
		nohup env PHAROS_DAEMON_PORT=$(SERVER_PORT) PHAROS_DAEMON_DB_PATH=$(DAEMON_DB_PATH) "$(DAEMON_BIN)" serve \
			> "$(LOG_DIR)/daemon.log" 2>&1 & \
		daemon_pid="$$!"; \
		echo "$$daemon_pid" > "$(DAEMON_PID_FILE)"; \
		sleep 1; \
		daemon_port_pid="$$(lsof -tiTCP:$(SERVER_PORT) -sTCP:LISTEN 2>/dev/null | head -n 1)"; \
		if [ -n "$$daemon_port_pid" ]; then \
			echo "$$daemon_port_pid" > "$(DAEMON_PID_FILE)"; \
			echo "Started daemon on http://127.0.0.1:$(SERVER_PORT) (pid $$daemon_port_pid)"; \
		else \
			echo "Started daemon on http://127.0.0.1:$(SERVER_PORT) (pid $$daemon_pid)"; \
		fi; \
	fi
	@client_port_pid="$$(lsof -tiTCP:$(CLIENT_PORT) -sTCP:LISTEN 2>/dev/null | head -n 1)"; \
	if [ -n "$$client_port_pid" ]; then \
		echo "Client already running on http://127.0.0.1:$(CLIENT_PORT) (pid $$client_port_pid)"; \
		echo "$$client_port_pid" > "$(CLIENT_PID_FILE)"; \
	else \
		cd $(PROJECT_ROOT)/apps/client-solid && \
		nohup env VITE_PORT=$(CLIENT_PORT) pnpm exec vite --port $(CLIENT_PORT) --strictPort \
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
	@client_port_pid="$$(lsof -tiTCP:$(CLIENT_PORT) -sTCP:LISTEN 2>/dev/null | head -n 1)"; \
	if [ -n "$$client_port_pid" ]; then \
		kill "$$client_port_pid" 2>/dev/null && echo "Stopped client listener ($$client_port_pid)"; \
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
	@daemon_port_pid="$$(lsof -tiTCP:$(SERVER_PORT) -sTCP:LISTEN 2>/dev/null | head -n 1)"; \
	if [ -n "$$daemon_port_pid" ]; then \
		kill "$$daemon_port_pid" 2>/dev/null && echo "Stopped daemon listener ($$daemon_port_pid)"; \
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

line-budget: ## Fail if any daemon .rs or client .tsx file exceeds the line budget
	cd $(PROJECT_ROOT)/apps/client-solid && pnpm run check:lines

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

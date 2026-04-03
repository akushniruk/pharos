# Deployment

#deployment #docker

This document covers running the observability system in production using Docker, and production hardening tips.

## Docker Quickstart

```bash
# Build and start all services
make docker-build && make docker-up

# Or using docker compose directly
docker compose build
docker compose up -d
```

To stop:
```bash
make docker-down
# or
docker compose down
```

## docker-compose.yml Overview

The repository ships with a `docker-compose.yml` that defines two services: `server` and `client`.

```yaml
# Key configuration points (see docker-compose.yml for full file)

services:
  server:
    build:
      context: ./apps/server-go
    ports:
      - "4000:4000"
    environment:
      - SERVER_PORT=4000
    volumes:
      - ./data:/app/data   # Persist SQLite database outside the container

  client:
    build:
      context: ./apps/client-solid
    ports:
      - "5173:5173"
    environment:
      - VITE_SERVER_URL=http://localhost:4000
    depends_on:
      - server
```

### Persistent Storage

The SQLite database (`events.db`) should be stored on a host volume so data survives container restarts:

```yaml
volumes:
  - ./data:/app/data
```

Set `DB_PATH=/app/data/events.db` in the server environment to point to the mounted path.

## Environment Variables

### Server Container

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | `4000` | Port the server listens on |
| `DB_PATH` | `events.db` | Path to the SQLite database file |

### Client Container

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SERVER_URL` | `http://localhost:4000` | URL of the server (used at build time by Vite) |
| `VITE_MAX_EVENTS_TO_DISPLAY` | `100` | Max events kept in the browser |
| `CLIENT_PORT` | `5173` | Port the client serves on |

## Production Tips

### Reverse Proxy with nginx

Place nginx in front of both services so they are accessible on standard ports. Example nginx config:

```nginx
server {
    listen 80;
    server_name observability.example.com;

    # Client (Vue SPA)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Server API and WebSocket
    location /api/ {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # WebSocket stream endpoint
    location /stream {
        proxy_pass http://localhost:4000/stream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }
}
```

For TLS, add your certificate with `certbot` or point to your cert/key files.

### SQLite WAL Mode

The server enables WAL (Write-Ahead Logging) mode automatically on startup:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
```

WAL mode allows concurrent reads while a write is in progress, which matters when many agents are sending events simultaneously. No manual configuration is required — it is set in `apps/server-go/internal/db/sqlite.go`.

For high-throughput deployments (many agents), ensure the data volume is on fast local storage (NVMe SSD). SQLite is typically sufficient for hundreds of events per second.

### Backup Strategy

Since all data lives in a single SQLite file, backups are straightforward:

```bash
# Live backup using SQLite's built-in backup API (safe while server is running)
sqlite3 /app/data/events.db ".backup /backups/events-$(date +%Y%m%d-%H%M%S).db"

# Or stop the server and copy the file directly
cp /app/data/events.db /backups/events-$(date +%Y%m%d).db
```

Automate with a cron job or a systemd timer. For long-running deployments, rotate backups to avoid unbounded disk growth:

```bash
# Keep only the last 7 daily backups
find /backups -name "events-*.db" -mtime +7 -delete
```

### Resetting the Database

To wipe all stored events (development or after a long run):

```bash
just db-reset
# or manually:
rm apps/server-go/events.db
# Restart the server — it will create a fresh database on startup
```

### Scaling Considerations

The system is designed for a single-server deployment. If you need to fan events from many projects to one dashboard:

1. All projects point `--server-url` at the same server address.
2. Use `--source-app` to distinguish projects; events are filtered in the UI by `source_app`.
3. SQLite handles concurrent writes via WAL mode. For very high volume (thousands of events/second), consider running multiple server instances behind a load balancer with a shared database — but for typical multi-agent workloads, a single Go + SQLite instance is sufficient.

## Building Production Images

```bash
# Server image only
cd apps/server-go
docker build -t observability-server:latest .

# Client image (produces a static build served by nginx or similar)
cd apps/client-solid
docker build -t observability-client:latest .
```

## Checking Server Health

```bash
# Health check via HTTP
curl http://localhost:4000/

# Check recent events are accessible
curl "http://localhost:4000/events/recent?limit=5"

# Using just
just health
```

## Related Docs

- [[setup-guide]] — Local development setup
- [[architecture]] — System overview and component descriptions
- [[api-reference]] — All server endpoints

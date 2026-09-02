# =============================================================================
# AstraDraw Development Commands
# =============================================================================
# Run `just` to see all available commands
#
# QUICK REFERENCE:
#   just dev          - Start everything with hot-reload
#   just dev-stop     - Stop everything
#   just check        - Run all code checks before commit
#   just up           - Start with containers (production images)
#   just up-local     - Start with containers (local builds)
#
# Works with Docker or Podman - engine is auto-detected. Force one with
# `CONTAINER_ENGINE=podman just <recipe>`.
# =============================================================================

# Container engine (docker or podman) and compose command, auto-detected.
# Override with `CONTAINER_ENGINE=podman just ...` if both are installed.
engine := env_var_or_default("CONTAINER_ENGINE", `command -v docker >/dev/null 2>&1 && echo docker || echo podman`)
compose := env_var_or_default("COMPOSE", `command -v docker >/dev/null 2>&1 && echo "docker compose" || (command -v podman-compose >/dev/null 2>&1 && echo "podman-compose" || echo "podman compose")`)

# docker-compose.infra.yml, plus a Podman-only override (drops an
# extra_hosts entry Podman Machine can't resolve; Podman already provides
# host.docker.internal automatically without it).
infra_files := if engine == "podman" { "-f docker-compose.infra.yml -f docker-compose.infra.podman.yml" } else { "-f docker-compose.infra.yml" }

# Default: show help
default:
    @just --list

# =============================================================================
# DAILY DEVELOPMENT (most used commands)
# =============================================================================
# Use these for day-to-day development with hot-reload.
# Native services (frontend/backend/room) + containerized infrastructure.

# Start everything for development (infrastructure + native services with hot-reload)
dev:
    #!/usr/bin/env bash
    set -e
    
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           AstraDraw Development Mode                       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Check if draw.local is in /etc/hosts
    if ! grep -q "draw.local" /etc/hosts 2>/dev/null; then
        echo "⚠️  WARNING: 'draw.local' is not in /etc/hosts!"
        echo ""
        echo "   Add it with:"
        echo "   sudo sh -c 'echo \"127.0.0.1 draw.local\" >> /etc/hosts'"
        echo ""
        read -p "   Press Enter to continue anyway, or Ctrl+C to abort..."
        echo ""
    fi
    
    # Clean up any existing processes
    echo "🧹 Cleaning up existing processes..."
    pkill -f "vite" 2>/dev/null || true
    pkill -f "nest start" 2>/dev/null || true
    pkill -f "ts-node-dev" 2>/dev/null || true
    sleep 1
    
    # Start infrastructure
    echo ""
    echo "🐳 Starting infrastructure ({{engine}})..."
    just _up-infra-oidc

    # Wait for infrastructure (check the actual service ports rather than
    # `compose ps` health text, which podman-compose doesn't render the same
    # way docker compose does)
    echo ""
    echo "⏳ Waiting for infrastructure to be ready..."
    for i in {1..30}; do
        if (exec 3<>/dev/tcp/localhost/5432) 2>/dev/null && curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
            echo "   ✅ Infrastructure is healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "   ⚠️  Timeout waiting for infrastructure (continuing anyway)"
        fi
        sleep 1
    done
    
    # Configure MinIO thumbnails
    echo ""
    echo "🖼️  Configuring MinIO thumbnails public access..."
    just _configure-minio-thumbnails
    
    # Generate frontend env
    echo ""
    echo "📝 Generating frontend env-config.js..."
    just _generate-frontend-env
    
    # Run migrations
    echo ""
    echo "🗄️  Running database migrations..."
    cd backend && npx prisma migrate deploy 2>&1 | sed 's/^/   /' || echo "   ⚠️  Migration warning (may be OK if already applied)"
    cd ..
    
    # Start services
    echo ""
    echo "🚀 Starting native services..."
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  Service      │  Port   │  URL                             │"
    echo "├─────────────────────────────────────────────────────────────┤"
    echo "│  Frontend     │  3000   │  http://localhost:3000           │"
    echo "│  Backend      │  8080   │  http://localhost:8080           │"
    echo "│  Room         │  3002   │  http://localhost:3002           │"
    echo "│  Traefik      │  443    │  https://draw.local              │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
    echo "📌 Access the app at: https://draw.local"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # Start all services in background
    just _dev-frontend &
    FRONTEND_PID=$!
    just _dev-backend &
    BACKEND_PID=$!
    just _dev-room &
    ROOM_PID=$!
    
    # Trap Ctrl+C
    trap 'echo ""; echo "🛑 Stopping services..."; kill $FRONTEND_PID $BACKEND_PID $ROOM_PID 2>/dev/null; just _down-infra; echo "✅ All services stopped."; exit 0' INT TERM
    
    wait

# Stop all development services
dev-stop:
    #!/usr/bin/env bash
    echo "🛑 Stopping AstraDraw development environment..."
    echo ""
    
    echo "Stopping native services..."
    if pgrep -f "vite" > /dev/null 2>&1; then
        pkill -f "vite" && echo "   ✅ Frontend stopped"
    else
        echo "   ⚪ Frontend was not running"
    fi
    
    if pgrep -f "nest start" > /dev/null 2>&1; then
        pkill -f "nest start" && echo "   ✅ Backend stopped"
    else
        echo "   ⚪ Backend was not running"
    fi
    
    if pgrep -f "ts-node-dev" > /dev/null 2>&1; then
        pkill -f "ts-node-dev" && echo "   ✅ Room service stopped"
    else
        echo "   ⚪ Room service was not running"
    fi
    
    echo ""
    echo "Stopping infrastructure ({{engine}})..."
    just _down-infra
    
    echo ""
    echo "✅ All services stopped."

# Restart backend service only (useful after schema/module changes)
dev-restart-backend:
    #!/usr/bin/env bash
    echo "🔄 Restarting backend service..."
    if pgrep -f "nest start" > /dev/null 2>&1; then
        pkill -f "nest start"
        echo "   ✅ Backend stopped"
    fi
    sleep 1
    echo "   🚀 Starting backend..."
    cd backend && npm run start:dev 2>&1 | sed 's/^/[backend] /' &
    sleep 3
    if curl -s http://localhost:8080/api/v2/auth/status > /dev/null 2>&1; then
        echo "   ✅ Backend restarted successfully"
    else
        echo "   🟡 Backend starting... (may take a few seconds)"
    fi

# Restart frontend service only
dev-restart-frontend:
    #!/usr/bin/env bash
    echo "🔄 Restarting frontend service..."
    if pgrep -f "vite" > /dev/null 2>&1; then
        pkill -f "vite"
        echo "   ✅ Frontend stopped"
    fi
    sleep 1
    echo "   🚀 Starting frontend..."
    cd frontend && yarn start 2>&1 | sed 's/^/[frontend] /' &
    sleep 3
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "   ✅ Frontend restarted successfully"
    else
        echo "   🟡 Frontend starting... (may take a few seconds)"
    fi

# Restart room service only
dev-restart-room:
    #!/usr/bin/env bash
    echo "🔄 Restarting room service..."
    if pgrep -f "ts-node-dev" > /dev/null 2>&1; then
        pkill -f "ts-node-dev"
        echo "   ✅ Room service stopped"
    fi
    sleep 1
    echo "   🚀 Starting room service..."
    cd room-service && yarn start:dev 2>&1 | sed 's/^/[room] /' &
    sleep 3
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo "   ✅ Room service restarted successfully"
    else
        echo "   🟡 Room service starting... (may take a few seconds)"
    fi

# Check status of all services
dev-status:
    #!/usr/bin/env bash
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           AstraDraw Service Status                         ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    echo "🐳 Container Infrastructure ({{engine}}):"
    echo "─────────────────────────"
    {{engine}} ps --filter "name=deploy" --format "table {{ "{{" }}.Names{{ "}}" }}\t{{ "{{" }}.Status{{ "}}" }}" 2>/dev/null | tail -n +2 | sed 's/^/   /' || echo "   No containers running"
    
    echo ""
    echo "💻 Native Services:"
    echo "───────────────────"
    
    if pgrep -f "vite" > /dev/null 2>&1; then
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo "   ✅ Frontend: running on http://localhost:3000"
        else
            echo "   🟡 Frontend: process running, port not responding"
        fi
    else
        echo "   ❌ Frontend: not running"
    fi
    
    if pgrep -f "nest start" > /dev/null 2>&1; then
        if curl -s http://localhost:8080/api/v2/auth/status > /dev/null 2>&1; then
            echo "   ✅ Backend: running on http://localhost:8080"
        else
            echo "   🟡 Backend: process running, port not responding"
        fi
    else
        echo "   ❌ Backend: not running"
    fi
    
    if pgrep -f "ts-node-dev" > /dev/null 2>&1; then
        if curl -s http://localhost:3002 > /dev/null 2>&1; then
            echo "   ✅ Room: running on http://localhost:3002"
        else
            echo "   🟡 Room: process running, port not responding"
        fi
    else
        echo "   ❌ Room: not running"
    fi
    
    echo ""
    echo "🌐 Traefik Routing:"
    echo "───────────────────"
    if curl -sk https://draw.local > /dev/null 2>&1; then
        echo "   ✅ https://draw.local is accessible"
    else
        echo "   ❌ https://draw.local is not accessible"
    fi

# =============================================================================
# CODE QUALITY (run before commits)
# =============================================================================

# Run all checks (frontend + backend + room)
check: check-frontend check-backend check-room

# Run frontend checks (TypeScript + Prettier + ESLint)
check-frontend:
    cd frontend && yarn test:typecheck && yarn test:other && yarn test:code

# Run backend checks (Build + Prettier + ESLint)
check-backend:
    cd backend && npm run build && npm run format && npm run lint

# Run room service checks
check-room:
    cd room-service && yarn build && yarn test

# Fix all formatting issues
fix:
    cd frontend && yarn fix
    cd backend && npm run format
    cd room-service && yarn fix

# =============================================================================
# CONTAINER DEPLOYMENT (Docker or Podman)
# =============================================================================
# Use these when you want to run everything in containers.
# For daily development, use `just dev` instead (hot-reload, no image rebuilds).
# Engine is auto-detected (docker preferred, podman as fallback); override with
# `CONTAINER_ENGINE=podman just up`.

# Start with production images (from GHCR)
up:
    cd deploy && {{compose}} up -d

# Start with local builds (builds from ../frontend, ../backend)
up-local:
    cd deploy && {{compose}} -f docker-compose.yml -f docker-compose.local.yml up -d --build

# Start with OIDC testing (Dex)
up-oidc:
    cd deploy && {{compose}} --profile oidc up -d

# Start with admin tools (pgAdmin, MinIO Console)
up-admin:
    cd deploy && {{compose}} --profile admin up -d

# Stop all containers
down:
    cd deploy && {{compose}} --profile oidc --profile admin down

# View logs (all services)
logs:
    cd deploy && {{compose}} logs -f

# View API logs only
logs-api:
    cd deploy && {{compose}} logs -f api

# View frontend logs only
logs-app:
    cd deploy && {{compose}} logs -f app

# Restart all services
restart:
    cd deploy && {{compose}} restart

# Fresh start with production images (removes all data)
fresh:
    cd deploy && {{compose}} --profile oidc --profile admin down -v
    {{engine}} volume rm astradraw_postgres_data astradraw_minio_data 2>/dev/null || true
    cd deploy && {{compose}} up -d

# Fresh start with local builds (removes all data)
fresh-local:
    cd deploy && {{compose}} --profile oidc --profile admin down -v
    {{engine}} volume rm astradraw_postgres_data astradraw_minio_data 2>/dev/null || true
    cd deploy && {{compose}} -f docker-compose.yml -f docker-compose.local.yml up -d --build

# Build local images without starting
build:
    cd deploy && {{compose}} -f docker-compose.yml -f docker-compose.local.yml build

# Build without cache (use when changes aren't being picked up)
build-no-cache:
    cd deploy && {{compose}} -f docker-compose.yml -f docker-compose.local.yml build --no-cache

# Pull latest production images
pull:
    cd deploy && {{compose}} pull

# Clean up container resources (old images, build cache, etc.)
clean:
    #!/usr/bin/env bash
    set -e
    echo "🧹 Cleaning up {{engine}} resources..."
    echo ""

    # Remove dangling images (untagged)
    echo "Removing dangling images..."
    {{engine}} image prune -f

    # Remove unused build cache (docker has a dedicated command; podman folds
    # build cache into `system prune`)
    echo ""
    echo "Removing build cache..."
    if [ "{{engine}}" = "docker" ]; then
        docker builder prune -f
    else
        podman system prune -f
    fi

    echo ""
    echo "✅ Cleanup complete!"
    echo ""
    echo "📊 Current disk usage:"
    {{engine}} system df

# Deep clean - removes ALL unused data (images, containers, volumes, networks)
clean-all:
    #!/usr/bin/env bash
    set -e
    echo "🧹 Deep cleaning {{engine}} resources..."
    echo "⚠️  This will remove ALL unused images, containers, volumes, and networks!"
    echo ""
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        {{engine}} system prune -a --volumes -f
        echo ""
        echo "✅ Deep cleanup complete!"
    else
        echo "Cancelled."
    fi

# =============================================================================
# DATABASE
# =============================================================================

# Run Prisma migrations
db-migrate:
    cd backend && npx prisma migrate deploy

# Generate Prisma client
db-generate:
    cd backend && npx prisma generate

# Open Prisma Studio (database GUI)
db-studio:
    cd backend && npx prisma studio

# Reset database (development only!)
db-reset:
    cd backend && npx prisma migrate reset

# Seed database with test data (users, workspaces, teams, collections, scenes)
db-seed:
    cd backend && npx prisma db seed

# Fresh development start with seed data (reset + seed + dev)
dev-fresh:
    #!/usr/bin/env bash
    set -e
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           AstraDraw Fresh Development Start                ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Stop any running services
    echo "🛑 Stopping existing services..."
    just dev-stop 2>/dev/null || true
    
    # Start infrastructure (needed for database)
    echo ""
    echo "🐳 Starting infrastructure ({{engine}})..."
    just _up-infra-oidc

    # Wait for database
    echo ""
    echo "⏳ Waiting for database..."
    for i in {1..30}; do
        if (cd deploy && {{compose}} {{infra_files}} exec -T postgres pg_isready -U excalidraw) > /dev/null 2>&1; then
            echo "   ✅ Database is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "   ❌ Timeout waiting for database"
            exit 1
        fi
        sleep 1
    done
    
    # Reset and seed database
    echo ""
    echo "🗄️  Resetting database..."
    cd backend && npx prisma migrate reset --force --skip-seed
    
    echo ""
    echo "🌱 Seeding database with test data..."
    cd backend && npx prisma db seed
    
    echo ""
    echo "✅ Fresh database ready! Starting dev environment..."
    echo ""
    
    # Continue with normal dev startup
    cd .. && just dev

# =============================================================================
# GIT
# =============================================================================

# Show git status
status:
    git status -s

# =============================================================================
# SETUP (one-time)
# =============================================================================

# Initial setup for new developers
setup:
    #!/usr/bin/env bash
    set -e
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║           AstraDraw Development Setup                      ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Step 1: Check /etc/hosts
    echo "📋 Step 1: Checking /etc/hosts..."
    if grep -q "draw.local" /etc/hosts 2>/dev/null; then
        echo "   ✅ draw.local is in /etc/hosts"
    else
        echo "   ⚠️  draw.local is NOT in /etc/hosts"
        echo ""
        echo "   Please add it with:"
        echo "   sudo sh -c 'echo \"127.0.0.1 draw.local\" >> /etc/hosts'"
        echo ""
        read -p "   Press Enter after adding, or Ctrl+C to abort..."
    fi
    echo ""
    
    # Step 2: Environment file
    echo "📋 Step 2: Setting up environment..."
    test -f deploy/.env || cp deploy/env.example deploy/.env
    echo "   ✅ deploy/.env ready"
    echo ""

    # Step 3: Secrets
    echo "📋 Step 3: Generating secrets..."
    mkdir -p deploy/secrets
    test -f deploy/secrets/minio_access_key || echo "minioadmin" > deploy/secrets/minio_access_key
    test -f deploy/secrets/minio_secret_key || openssl rand -base64 32 > deploy/secrets/minio_secret_key
    test -f deploy/secrets/postgres_user || echo -n "excalidraw" > deploy/secrets/postgres_user
    test -f deploy/secrets/postgres_password || openssl rand -base64 32 > deploy/secrets/postgres_password
    test -f deploy/secrets/postgres_db || echo -n "excalidraw" > deploy/secrets/postgres_db
    test -f deploy/secrets/jwt_secret || openssl rand -base64 32 > deploy/secrets/jwt_secret
    echo "   ✅ Secrets ready"
    echo ""

    # Step 4: SSL Certificate
    echo "📋 Step 4: Generating SSL certificate..."
    if [ ! -f deploy/certs/server.crt ]; then
        just setup-certs
    else
        echo "   ✅ Certificate already exists"
    fi
    echo ""

    # Step 5: Install dependencies
    echo "📋 Step 5: Installing dependencies..."
    just install
    echo ""
    
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                    Setup Complete! 🎉                      ║"
    echo "╠════════════════════════════════════════════════════════════╣"
    echo "║  To start development:                                     ║"
    echo "║    just dev                                                ║"
    echo "║                                                            ║"
    echo "║  Then open: https://draw.local                             ║"
    echo "╚════════════════════════════════════════════════════════════╝"

# Generate self-signed SSL certificate for draw.local
setup-certs:
    #!/usr/bin/env bash
    set -e
    echo "🔐 Generating SSL certificate for draw.local..."
    mkdir -p deploy/certs
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout deploy/certs/server.key \
        -out deploy/certs/server.crt \
        -subj "/CN=draw.local" \
        -addext "subjectAltName=DNS:draw.local,DNS:localhost,IP:127.0.0.1"
    
    echo "✅ Certificate generated at deploy/certs/"
    echo ""
    echo "📝 Note: Your browser will show a security warning."
    echo "   Click 'Advanced' → 'Proceed to draw.local' to accept it."

# Install all dependencies
install:
    cd frontend && yarn install
    cd backend && npm install
    cd room-service && yarn install

# =============================================================================
# TESTING
# =============================================================================

# Run backend API tests (requires running services)
test-api url="https://draw.local":
    chmod +x deploy/tests/test-backend-api.sh
    deploy/tests/test-backend-api.sh {{url}}

# Run interactive scene navigation test
test-navigation:
    @cd deploy/tests && node test-scene-navigation.js

# Setup test data for collaboration testing
test-setup-collab url="https://draw.local":
    chmod +x deploy/tests/setup-collab-test.sh
    deploy/tests/setup-collab-test.sh {{url}}

# =============================================================================
# INTERNAL HELPERS (prefixed with _ to hide from list)
# =============================================================================

# Start frontend dev server
_dev-frontend:
    cd frontend && yarn start 2>&1 | sed 's/^/[frontend] /'

# Start backend dev server
_dev-backend:
    cd backend && rm -f tsconfig.build.tsbuildinfo && npm run start:dev 2>&1 | sed 's/^/[backend] /'

# Start room service dev server
_dev-room:
    cd room-service && yarn start:dev 2>&1 | sed 's/^/[room] /'

# Start infrastructure only
_up-infra:
    cd deploy && {{compose}} {{infra_files}} up -d

# Start infrastructure with OIDC
_up-infra-oidc:
    cd deploy && {{compose}} {{infra_files}} --profile oidc up -d

# Stop infrastructure
_down-infra:
    cd deploy && {{compose}} {{infra_files}} --profile oidc --profile admin down

# Generate frontend env-config.js
_generate-frontend-env:
    ./deploy/generate-frontend-env.sh

# Configure MinIO thumbnails for public access
_configure-minio-thumbnails:
    COMPOSE="{{compose}}" COMPOSE_FILES="{{infra_files}}" ./deploy/configure-minio-thumbnails.sh

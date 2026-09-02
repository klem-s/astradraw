# Contributing to AstraDraw

Thank you for your interest in contributing to AstraDraw! This guide will help you set up your local development environment.

## Prerequisites

- **Node.js** 18+ 
- **Yarn** 1.22+ (for frontend)
- **npm** 9+ (for backend)
- **Docker** and **Docker Compose**
- **Git**
- **just** (command runner) - `brew install just` or see [just installation](https://github.com/casey/just#installation)

## Repository Structure

AstraDraw is a monorepo:

| Folder | Description |
|--------|-------------|
| `frontend/` | React frontend (Excalidraw fork) |
| `backend/` | NestJS backend API |
| `room-service/` | WebSocket server |
| `deploy/` | Docker/Podman Compose, configs |

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/AstraDraw/astradraw.git
cd astradraw
```

### 2. Set Up the Deploy Environment

```bash
cd deploy

# Copy environment template
cp env.example .env

# Create secrets directory and required secrets
mkdir -p secrets

# Database credentials
echo "excalidraw" > secrets/postgres_user
openssl rand -base64 32 > secrets/postgres_password
echo "excalidraw" > secrets/postgres_db

# JWT secret
openssl rand -base64 32 > secrets/jwt_secret

# MinIO credentials
echo "minioadmin" > secrets/minio_access_key
openssl rand -base64 32 > secrets/minio_secret_key

# Create self-signed certificates for local HTTPS
mkdir -p certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/server.key -out certs/server.crt \
  -subj "/CN=localhost"

# Enable local builds
cp docker-compose.override.yml.disabled docker-compose.override.yml
```

> **Note:** See [Docker Secrets Documentation](docs/deployment/DOCKER_SECRETS.md) for complete secrets management guide.

### 3. Start Development

**Recommended: Use `just` commands** (from project root):

```bash
cd ..  # Back to astradraw root

# Start all services with hot-reload
just dev

# Check status
just dev-status

# Stop everything
just dev-stop
```

**Alternative: Docker Compose directly:**

```bash
# From the deploy/ folder
docker compose up -d --build

# View logs
docker compose logs -f app   # Frontend logs
docker compose logs -f api   # Backend logs
```

### 4. Access the Application

Open https://localhost in your browser (accept the self-signed certificate warning).

## Development Workflow

### Essential Commands

```bash
# Daily development
just dev              # Start everything with hot-reload
just dev-status       # Check what's running
just dev-stop         # Stop everything

# Code checks (run before commits!)
just check-all        # All checks (frontend + backend + room)
just check-frontend   # TypeScript + Prettier + ESLint
just check-backend    # Build + Prettier + ESLint

# Git status
just status           # Show git status
```

### Working on Frontend

```bash
cd frontend
yarn install
yarn start          # Development server on http://localhost:5173
```

**Before committing:**
```bash
just check-frontend
# Or manually:
yarn test:typecheck    # TypeScript type checking
yarn test:other        # Prettier formatting
yarn test:code         # ESLint code quality
```

### Working on Backend

```bash
cd backend
npm install
npm run start:dev      # Development server with hot reload
```

**Before committing:**
```bash
just check-backend
# Or manually:
npm run build          # Build (includes TypeScript)
npm run format         # Prettier formatting
npm run lint           # ESLint code quality
```

### Working on Room Service

The room service is typically used as-is from upstream. If you need to modify it:

```bash
cd room-service
yarn install
yarn start:dev
```

## Running Tests

### Frontend
```bash
cd frontend
yarn test:all          # Run all checks + unit tests
```

### Backend
```bash
cd backend
npm run test           # Unit tests
npm run test:e2e       # End-to-end tests
```

## Docker Profiles

```bash
cd deploy

# Standard services
docker compose up -d

# With admin tools (pgAdmin, MinIO Console)
docker compose --profile admin up -d

# With OIDC testing (Dex)
docker compose --profile oidc up -d
```

## Making Changes

### 1. Create a Feature Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Your Changes

Follow the patterns documented in:
- [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) - Technical architecture
- [docs/features/](docs/features/) - Feature documentation

### 3. Test Locally

```bash
# Run all checks
just check-all

# Test with Docker
just fresh-dev  # Fresh start with local builds
```

### 4. Commit and Push

Use descriptive commit messages (these will be used for changelog at release). Scope the commit to the part of the monorepo it touches:

```bash
git add -A
git commit -m "feat(workspace): add auto-save functionality

- Added debounced save on canvas changes
- Shows save indicator in toolbar
- Handles offline/online transitions"
git push origin feature/my-feature
```

### 5. Create a Pull Request

Open a single PR against this repository.

## Commit Message Format

We use conventional commits:

```
type(scope): description

[optional body with details]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance

**Examples:**
```
feat(workspace): add auto-save functionality
fix(auth): resolve JWT cookie not being sent
docs: update API documentation
refactor(collab): simplify room key encryption
```

## Code Style

### Frontend (TypeScript/React)
- Use functional components with hooks
- Use Jotai for shared state
- Add translations to both `en.json` and `ru-RU.json`
- Stop keyboard event propagation in input fields: `onKeyDown={(e) => e.stopPropagation()}`

### Backend (TypeScript/NestJS)
- Use Prisma for database operations
- JWT guard is at `auth/jwt.guard.ts`
- Use `@types/multer` for file uploads
- Use `getSecret()` / `getSecretOrThrow()` for Docker secrets

## Getting Help

- Check existing documentation in `docs/`
  - [Architecture](docs/architecture/ARCHITECTURE.md) - System overview
  - [Docker Secrets](docs/deployment/DOCKER_SECRETS.md) - Secure credential management
  - [Workspace & Auth](docs/features/WORKSPACE.md) - Authentication details
  - [Full documentation index](docs/README.md)
- Look at similar features for patterns
- Open an issue for questions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

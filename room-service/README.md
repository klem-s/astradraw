# AstraDraw Room

> **Note:** Please file all issues in the [main AstraDraw repository](https://github.com/AstraDraw/astradraw/issues). This repository is for code contributions only.

WebSocket collaboration server for [AstraDraw](https://github.com/AstraDraw/astradraw), a self-hosted Excalidraw deployment.

This is a fork of [excalidraw/excalidraw-room](https://github.com/excalidraw/excalidraw-room) with modifications for AstraDraw.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Docker](https://img.shields.io/badge/docker-hub.docker.com-blue)](https://hub.docker.com/r/astradraw/rooms)

## Changes from Upstream

- Increased `maxHttpBufferSize` to 200MB (from default 1MB) to support larger file transfers
- Updated Node.js to v18
- Docker Hub publishing
- Multi-platform Docker builds (amd64, arm64)

## Architecture

This is the WebSocket component of the AstraDraw suite:

- **[astradraw-app](https://github.com/AstraDraw/astradraw-app)**: Frontend application
- **[astradraw-api](https://github.com/AstraDraw/astradraw-api)**: Backend API
- **astradraw-room** (this repo): WebSocket collaboration server
- **[astradraw](https://github.com/AstraDraw/astradraw)**: Deployment configuration & documentation

## Quick Start

### Using Docker (Production)

```bash
docker pull astradraw/rooms:latest

docker run -d \
  -p 80:80 \
  -e PORT=80 \
  -e CORS_ORIGIN=* \
  astradraw/rooms:latest
```

### Local Development

```bash
# Install dependencies
yarn install

# Start dev server
yarn start:dev

# Run checks before committing
yarn build    # TypeScript compilation
yarn test     # Prettier + ESLint check
yarn fix      # Auto-fix issues
```

## Environment Variables

| Variable      | Description         | Default                    |
| ------------- | ------------------- | -------------------------- |
| `PORT`        | Server port         | `80` (prod) / `3002` (dev) |
| `CORS_ORIGIN` | Allowed CORS origin | `*`                        |
| `DEBUG`       | Debug logging       | -                          |

## Production with PM2

If you need to use cluster mode with PM2, see: https://socket.io/docs/v4/pm2/

```bash
pm2 start pm2.production.json
```

## Deployment

For complete deployment with frontend, backend API, and Traefik proxy, see the [astradraw deployment repo](https://github.com/AstraDraw/astradraw).

## License

MIT License - Based on [excalidraw-room](https://github.com/excalidraw/excalidraw-room)

## Links

- **Main Repo**: [astradraw](https://github.com/AstraDraw/astradraw)
- **Frontend App**: [astradraw-app](https://github.com/AstraDraw/astradraw-app)
- **Backend API**: [astradraw-api](https://github.com/AstraDraw/astradraw-api)
- **Upstream**: [excalidraw/excalidraw-room](https://github.com/excalidraw/excalidraw-room)
- **Docker Image**: [ghcr.io/AstraDraw/astradraw-room](https://github.com/AstraDraw/astradraw-room/pkgs/container/astradraw-room)

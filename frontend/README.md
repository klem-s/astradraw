# AstraDraw App (Frontend)

> **Note:** Please file all issues in the [main AstraDraw repository](https://github.com/AstraDraw/astradraw/issues). This repository is for code contributions only.

> **Built on [Excalidraw](https://github.com/excalidraw/excalidraw)** - An open source virtual hand-drawn style whiteboard.

Self-hosted Excalidraw frontend with user workspaces, video recordings, presentation mode, custom pens, and real-time collaboration.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Docker](https://img.shields.io/badge/docker-hub.docker.com-blue)](https://hub.docker.com/r/astradraw/app)

## Features

### Core (from Excalidraw)

- 🎨 **Infinite canvas** with hand-drawn style
- 🔒 **End-to-end encryption** for collaboration
- 🤝 **Real-time collaboration** via WebSocket
- 📱 **Responsive design** for desktop and mobile
- 🌙 **Dark mode** support

### AstraDraw Extensions

- 👤 **User Authentication** - Local accounts and OIDC/SSO support
- 📁 **Workspaces** - Personal and shared workspaces with teams and collections
- 💬 **Comments** - Threaded canvas comments with @mentions and real-time sync
- 🔔 **Notifications** - In-app notifications for mentions and comments
- 🎬 **Talktrack** - Record canvas walkthroughs with camera PIP
- 📽️ **Presentation Mode** - Use frames as slides with implicit laser pointer
- 🖊️ **Custom Pens** - Highlighter, fountain, marker presets
- 🎭 **Stickers & GIFs** - GIPHY integration
- 📚 **Pre-bundled Libraries** - Team-wide shape collections
- 🔍 **Quick Search** - Cmd+K to search scenes across workspaces

## Quick Start

### Using Docker (Production)

```bash
docker run -d \
  -p 80:80 \
  -e VITE_APP_WS_SERVER_URL=wss://your-domain.com \
  -e VITE_APP_BACKEND_V2_GET_URL=https://your-domain.com/api/v2/scenes/ \
  -e VITE_APP_BACKEND_V2_POST_URL=https://your-domain.com/api/v2/scenes/ \
  astradraw/app:latest
```

### Local Development

**Recommended:** Use the main repo with `just dev` for full-stack development.

```bash
# From astradraw/ root (recommended)
just dev              # Starts frontend + backend + room-service with hot-reload

# Or standalone frontend development
cd frontend
yarn install
yarn start            # Dev server on http://localhost:5173
```

**Before committing:**

```bash
# From astradraw/ root
just check-frontend

# Or directly
yarn test:typecheck && yarn test:other && yarn test:code
```

## Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `VITE_APP_WS_SERVER_URL` | WebSocket server for collaboration | `wss://draw.example.com` |
| `VITE_APP_BACKEND_V2_GET_URL` | Scene GET endpoint | `https://draw.example.com/api/v2/scenes/` |
| `VITE_APP_BACKEND_V2_POST_URL` | Scene POST endpoint | `https://draw.example.com/api/v2/scenes/` |
| `VITE_APP_GIPHY_API_KEY` | GIPHY API key for stickers | `your_giphy_api_key` |
| `VITE_APP_DISABLE_TRACKING` | Disable analytics | `true` |

## Architecture

This is the frontend component of the AstraDraw suite:

| Repository | Purpose |
| --- | --- |
| **[astradraw](https://github.com/AstraDraw/astradraw)** | Main repo - deployment, docs, orchestration |
| **astradraw-app** (this repo) | Frontend application |
| **[astradraw-api](https://github.com/AstraDraw/astradraw-api)** | Backend API (auth, workspace, storage) |
| **[astradraw-room](https://github.com/AstraDraw/astradraw-room)** | WebSocket collaboration server |

## Documentation

Full documentation is in the main [astradraw](https://github.com/AstraDraw/astradraw) repository:

| Topic | Link |
| --- | --- |
| Getting Started | [docs/getting-started/](https://github.com/AstraDraw/astradraw/tree/main/docs/getting-started) |
| Architecture | [docs/architecture/](https://github.com/AstraDraw/astradraw/tree/main/docs/architecture) |
| Features | [docs/features/](https://github.com/AstraDraw/astradraw/tree/main/docs/features) |
| Deployment | [docs/deployment/](https://github.com/AstraDraw/astradraw/tree/main/docs/deployment) |

## Project Structure

```
frontend/
├── excalidraw-app/           # AstraDraw application
│   ├── components/           # React components
│   │   ├── Workspace/        # Scene management, dashboard, auth
│   │   ├── Comments/         # Threaded comments with markers
│   │   ├── Settings/         # User profile, preferences, Jotai atoms
│   │   ├── Talktrack/        # Video recording
│   │   ├── Presentation/     # Slideshow mode
│   │   └── Stickers/         # GIPHY integration
│   ├── hooks/                # React Query + custom hooks
│   ├── pens/                 # Custom pen presets
│   ├── auth/                 # Auth context and API client
│   ├── collab/               # Real-time collaboration
│   └── data/                 # Storage backends
├── packages/
│   ├── excalidraw/           # Core React component (AstraDraw fork)
│   ├── common/               # Shared utilities
│   ├── element/              # Element types
│   ├── math/                 # Math utilities
│   └── utils/                # General utilities
└── public/                   # Static assets
```

## License

MIT License - Based on [Excalidraw](https://github.com/excalidraw/excalidraw)

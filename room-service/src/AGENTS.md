# Room Service Agent Instructions

WebSocket collaboration server for real-time drawing sync.

## Key Files

- `index.ts` - Main server entry point

## Technology

- Node.js with Socket.io
- Handles real-time element sync between collaborators

## Two Collaboration Modes

| Mode      | Auth         | Use Case           |
| --------- | ------------ | ------------------ |
| Workspace | JWT required | Team collaboration |
| Legacy    | Anonymous    | Quick sharing      |

## Environment Variables

| Variable | Description               |
| -------- | ------------------------- |
| `PORT`   | Server port (default: 80) |

## Build & Run

```bash
yarn build      # TypeScript compilation
yarn start      # Start server
yarn dev        # Development with watch
```

## Checks Before Commit

```bash
yarn build      # TypeScript
yarn test       # Prettier + ESLint
yarn fix        # Auto-fix formatting
```

For collaboration architecture, see @collaboration-system

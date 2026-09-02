# AstraDraw Frontend - AI Context

> This is the frontend component of [AstraDraw](https://github.com/astrateam-net/astradraw), a self-hosted Excalidraw fork.

## Project Structure

This is a **monorepo** forked from Excalidraw with AstraDraw-specific additions:

- **`excalidraw-app/`** - Main application with AstraDraw features
  - `components/Workspace/` - User auth, scene management, profile
  - `components/Talktrack/` - Video recording feature
  - `components/Presentation/` - Slideshow mode
  - `components/Stickers/` - GIPHY integration
  - `styles/` - Shared SCSS (variables, mixins, animations) - see `styles/AGENTS.md`
  - `pens/` - Custom pen presets
  - `auth/` - Authentication context and API
- **`packages/excalidraw/`** - Core React component library
- **`packages/`** - Shared packages: `common`, `element`, `math`, `utils`

## Critical Patterns

### Input Fields

Always stop keyboard event propagation to prevent canvas shortcuts from firing:

```typescript
<input
  onKeyDown={(e) => e.stopPropagation()}
  onKeyUp={(e) => e.stopPropagation()}
/>
```

### Translations

Add keys to BOTH locale files:

- `packages/excalidraw/locales/en.json`
- `packages/excalidraw/locales/ru-RU.json`

### State Management

- Use **React Query** for server state (API data: scenes, workspaces, collections)
- Use **Jotai** for client state (navigation, selection, UI state)
- Use React hooks for component-local state

```typescript
// Server state - use React Query hooks
import { useScenesCache } from "../hooks/useScenesCache";
const { scenes, isLoading } = useScenesCache({ workspaceId, collectionId });

// Client state - use Jotai atoms
import { useAtomValue } from "../app-jotai";
import { currentWorkspaceAtom } from "../components/Settings/settingsState";
const workspace = useAtomValue(currentWorkspaceAtom);

// Invalidate after mutations
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryClient";
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all });
```

### API Calls

Use the modular API client (credentials are automatically included):

```typescript
// Import from specific modules (preferred)
import { listScenes, createScene } from "../auth/api/scenes";
import { listWorkspaces } from "../auth/api/workspaces";

// Or import from workspaceApi (backward compatible)
import { listScenes, getApiBaseUrl } from "../auth/workspaceApi";

// For custom endpoints, use apiRequest helper:
import { apiRequest } from "../auth/api/client";

const data = await apiRequest("/custom-endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
  errorMessage: "Failed to call endpoint",
});
```

### Dark Mode CSS (CSS Modules)

All components use CSS Modules with the `dark-mode` mixin from shared styles:

```scss
// ComponentName.module.scss
@use "../../styles/mixins" as *;

.card {
  background: var(--island-bg-color, #fff);
}

@include dark-mode {
  .card {
    background: var(--island-bg-color, #232329);
  }
}
```

```typescript
// ComponentName.tsx
import styles from "./ComponentName.module.scss";
<div className={styles.card}>
```

## Development Commands

```bash
yarn install           # Install dependencies
yarn start             # Start dev server (http://localhost:5173)

# Before committing (or use `just check-frontend` from main repo):
yarn test:typecheck    # TypeScript type checking
yarn test:other        # Prettier formatting check
yarn test:code         # ESLint code quality
yarn fix               # Auto-fix formatting and linting

# Run tests
yarn test:app          # Run all tests (watch mode)
yarn test:app --run    # Run all tests once
yarn test:app --run excalidraw-app/tests/hooks/  # Run specific tests
```

## Key Files

| File | Purpose |
| --- | --- |
| `excalidraw-app/App.tsx` | Main app orchestrator (uses hooks) |
| `excalidraw-app/hooks/` | Extracted logic hooks |
| `excalidraw-app/lib/queryClient.ts` | React Query client + query key factory |
| `excalidraw-app/components/Settings/settingsState.ts` | Jotai state atoms (client state) |
| `excalidraw-app/router.ts` | URL routing logic |
| `excalidraw-app/auth/api/` | Modular API client (scenes, workspaces, etc.) |
| `excalidraw-app/auth/workspaceApi.ts` | Re-exports from api/ (backward compat) |
| `excalidraw-app/env.ts` | Runtime environment helper |
| `excalidraw-app/styles/` | Shared SCSS (see `styles/AGENTS.md`) |

## App.tsx Hooks

App.tsx uses these extracted hooks for better maintainability:

| Hook | Purpose |
| --- | --- |
| `useAutoSave` | Save state machine, debounce, retry, offline detection |
| `useSceneLoader` | Scene loading from workspace URLs, auto-collab |
| `useUrlRouting` | Popstate handling, URL parsing |
| `useKeyboardShortcuts` | Ctrl+S, Cmd+P, Cmd+[, Cmd+] handlers |

## Data Fetching Hooks

These hooks use React Query for server state management:

| Hook              | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `useScenesCache`  | Fetch scenes with caching (React Query)  |
| `useWorkspaces`   | Workspace loading + Jotai for selection  |
| `useCollections`  | Collection loading + Jotai for selection |
| `useSceneActions` | Scene CRUD with optimistic updates       |

```typescript
// Example: Using data hooks
import { useScenesCache } from "../hooks/useScenesCache";
import { useWorkspaces } from "../hooks/useWorkspaces";
import { useSceneActions } from "../hooks/useSceneActions";

const { scenes, isLoading } = useScenesCache({ workspaceId, collectionId });
const { workspaces, currentWorkspace } = useWorkspaces({ isAuthenticated });

// Scene actions with optimistic updates
const { deleteScene, renameScene, duplicateScene, isDeleting } =
  useSceneActions({
    workspaceId: workspace?.id,
    collectionId: activeCollectionId,
  });
```

## Architecture Notes

### Storage Abstraction

- `excalidraw-app/data/StorageBackend.ts` - Interface for storage providers
- `excalidraw-app/data/httpStorage.ts` - HTTP storage implementation (AstraDraw)

### Runtime Environment

Environment variables are injected at container startup (not build time):

- `excalidraw-app/env.ts` - Uses `window.__ENV__` with `import.meta.env` fallback
- `docker-entrypoint.sh` - Generates `/env-config.js` at startup

## Testing

Tests are located in `excalidraw-app/tests/` and use Vitest + React Testing Library.

### Test Structure

```
excalidraw-app/tests/
├── testUtils.tsx              # Test utilities for React Query
├── api/
│   └── client.test.ts         # API client tests
└── hooks/
    ├── useSceneActions.test.tsx   # Scene CRUD tests
    └── useScenesCache.test.tsx    # Data fetching tests
```

### Testing Hooks with React Query

Use the test utilities from `testUtils.tsx`:

```typescript
import { renderHookWithProviders, createMockScenes } from "../testUtils";
import { useScenesCache } from "../../hooks/useScenesCache";

// Mock the API
vi.mock("../../auth/workspaceApi", () => ({
  listWorkspaceScenes: vi.fn(),
}));

import { listWorkspaceScenes } from "../../auth/workspaceApi";

it("should fetch scenes", async () => {
  const mockScenes = createMockScenes(3);
  (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
    mockScenes,
  );

  const { result } = renderHookWithProviders(() =>
    useScenesCache({ workspaceId: "ws-1", collectionId: "col-1" }),
  );

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.scenes).toEqual(mockScenes);
});
```

### Key Patterns

1. **Mock imports AFTER vi.mock()** - Import mocked modules after the `vi.mock()` call
2. **Use `renderHookWithProviders`** - Wraps hooks with QueryClientProvider
3. **Use `createMockScenes()`** - Creates properly typed mock data
4. **Clear mocks in beforeEach** - Use `vi.clearAllMocks()` to reset between tests

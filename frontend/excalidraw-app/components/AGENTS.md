# Components Agent Instructions

Custom React components for AstraDraw workspace features.

## Key Patterns

### Input Fields

Always stop keyboard event propagation:

```typescript
<input
  onKeyDown={(e) => e.stopPropagation()}
  onKeyUp={(e) => e.stopPropagation()}
/>
```

### Dark Mode

Use BOTH selectors:

```scss
.excalidraw.theme--dark,
.excalidraw-app.theme--dark {
  .my-component { ... }
}
```

### Font Family

Define `--ui-font` locally for components outside `.excalidraw`:

```scss
.my-component {
  --ui-font: Assistant, system-ui, BlinkMacSystemFont, -apple-system, Segoe UI,
    Roboto, Helvetica, Arial, sans-serif;
  font-family: var(--ui-font);
}
```

## Folder Structure

- `Workspace/` - Sidebar, SceneCard, Dashboard, LoginDialog
- `Settings/` - ProfilePage, MembersPage, settingsState.ts (Jotai atoms)
- `Talktrack/` - Video recording feature
- `Presentation/` - Slideshow mode
- `Skeletons/` - Loading skeleton components

## State Management

- **Jotai atoms**: Defined in `Settings/settingsState.ts`
- **useState**: For component-local state only

For detailed patterns, see @frontend-patterns and @frontend-state

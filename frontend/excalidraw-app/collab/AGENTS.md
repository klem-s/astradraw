# Collaboration Agent Instructions

Real-time collaboration system for AstraDraw.

## Two Modes

| Mode      | URL                                          | Auth     |
| --------- | -------------------------------------------- | -------- |
| Workspace | `/workspace/{slug}/scene/{id}#key={roomKey}` | Required |
| Legacy    | `/#room={roomId},{roomKey}`                  | No       |

**Important:** Never mix these modes.

## Key Files

- `Collab.tsx` - Main collaboration component
- `CollabWrapper.tsx` - Context provider
- `Portal.tsx` - WebSocket connection

## Auto-Collaboration

Scenes in shared collections auto-join collaboration:

- Pass `isAutoCollab: true` to prevent scene reset
- Room credentials stored in database

## Permission Check

Always check `access.canCollaborate` before joining:

```typescript
if (access.canCollaborate && scene.roomId) {
  await collabAPI.startCollaboration({
    roomId,
    roomKey,
    isAutoCollab: true,
  });
}
```

For full documentation, see @collaboration-system and `/docs/features/COLLABORATION.md`

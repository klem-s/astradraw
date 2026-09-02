import { getApiBaseUrl } from "../auth/workspaceApi";
import { getAuthStatus } from "../auth/authApi";

export interface SceneAccess {
  canView: boolean;
  canEdit: boolean;
  canCollaborate: boolean;
}

export interface LoadedScene {
  scene: {
    id: string;
    title: string;
    roomId: string | null;
    collectionId: string | null;
  };
  data: string | null; // Base64 encoded
  access: SceneAccess;
  // Room credentials for auto-collaboration (only if canCollaborate)
  roomId?: string | null;
  roomKey?: string | null;
}

export async function loadWorkspaceScene(
  workspaceSlug: string,
  sceneId: string,
): Promise<LoadedScene> {
  const response = await fetch(
    `${getApiBaseUrl()}/workspace/by-slug/${workspaceSlug}/scenes/${sceneId}`,
    { credentials: "include" },
  );

  if (response.status === 401) {
    const status = await getAuthStatus().catch(() => null);
    if (status?.oidcConfigured && !status.localAuthEnabled) {
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `${getApiBaseUrl()}/auth/login?redirect=${returnUrl}`;
    } else {
      // No OIDC configured (or local auth is available) - the backend's
      // /auth/login redirect is OIDC-only and 401s here, so send the
      // visitor to the app home instead, where they can log in via the
      // local-auth dialog and open this link again.
      window.location.href = "/";
    }
    throw new Error("Authentication required");
  }

  if (response.status === 403) {
    throw new Error("Access denied to this scene");
  }

  if (!response.ok) {
    throw new Error("Failed to load scene");
  }

  return response.json();
}

export async function getCollaborationCredentials(
  sceneId: string,
): Promise<{ roomId: string; roomKey: string } | null> {
  const response = await fetch(
    `${getApiBaseUrl()}/workspace/scenes/${sceneId}/collaborate`,
    { credentials: "include" },
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Public, unauthenticated lookup used to join a live collaboration room
 * from a share link, without an AstraDraw account. Only succeeds if the
 * scene owner has already enabled collaboration on that scene.
 */
export async function getRoomInfo(
  sceneId: string,
): Promise<{ roomId: string; title: string }> {
  const response = await fetch(
    `${getApiBaseUrl()}/workspace/scenes/${sceneId}/room-info`,
  );

  if (!response.ok) {
    throw new Error("No active collaboration room for this scene");
  }

  return response.json();
}

export async function startCollaboration(
  sceneId: string,
): Promise<{ roomId: string; roomKey: string }> {
  const response = await fetch(
    `${getApiBaseUrl()}/workspace/scenes/${sceneId}/collaborate`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to start collaboration");
  }

  return response.json();
}

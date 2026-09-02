import { getApiBaseUrl } from "../auth/workspaceApi";

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
    const returnUrl = encodeURIComponent(window.location.href);
    window.location.href = `/api/v2/auth/login?redirect=${returnUrl}`;
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

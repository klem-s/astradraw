/**
 * Scene API - CRUD operations for scenes
 */

import { apiRequest, apiRequestRaw, jsonBody, binaryBody } from "./client";

import type { WorkspaceScene, CreateSceneDto, UpdateSceneDto } from "./types";

/**
 * List all scenes for the current user
 */
export async function listScenes(): Promise<WorkspaceScene[]> {
  return apiRequest("/workspace/scenes", {
    errorMessage: "Failed to list scenes",
  });
}

/**
 * Get a specific scene by ID
 */
export async function getScene(id: string): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}`, {
    errorMessage: "Failed to get scene",
  });
}

/**
 * Get scene data (the actual Excalidraw content)
 */
export async function getSceneData(id: string): Promise<ArrayBuffer> {
  const response = await apiRequestRaw(`/workspace/scenes/${id}/data`, {
    errorMessage: "Failed to get scene data",
  });
  return response.arrayBuffer();
}

/**
 * Create a new scene
 */
export async function createScene(
  dto: CreateSceneDto,
): Promise<WorkspaceScene> {
  return apiRequest("/workspace/scenes", {
    method: "POST",
    ...jsonBody(dto),
    errorMessage: "Failed to create scene",
  });
}

/**
 * Update a scene
 */
export async function updateScene(
  id: string,
  dto: UpdateSceneDto,
): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}`, {
    method: "PUT",
    ...jsonBody(dto),
    errorMessage: "Failed to update scene",
  });
}

/**
 * Update scene data only (for auto-save)
 */
export async function updateSceneData(
  id: string,
  data: Blob | ArrayBuffer,
): Promise<{ success: boolean }> {
  return apiRequest(`/workspace/scenes/${id}/data`, {
    method: "PUT",
    ...binaryBody(data),
    errorMessage: "Failed to update scene data",
  });
}

/**
 * Upload scene thumbnail (PNG image)
 * Called after successful scene save to update the preview image.
 * This is a best-effort operation - failures are logged but don't affect save status.
 */
export async function uploadSceneThumbnail(
  id: string,
  thumbnailBlob: Blob,
): Promise<{ thumbnailUrl: string }> {
  return apiRequest(`/workspace/scenes/${id}/thumbnail`, {
    method: "PUT",
    ...binaryBody(thumbnailBlob),
    errorMessage: "Failed to upload thumbnail",
  });
}

/**
 * Delete a scene
 */
export async function deleteScene(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/workspace/scenes/${id}`, {
    method: "DELETE",
    errorMessage: "Failed to delete scene",
  });
}

/**
 * Start collaboration on a scene
 */
export async function startCollaboration(
  id: string,
): Promise<{ roomId: string; roomKey: string }> {
  return apiRequest(`/workspace/scenes/${id}/collaborate`, {
    method: "POST",
    errorMessage: "Failed to start collaboration",
  });
}

/**
 * Duplicate a scene
 */
export async function duplicateScene(id: string): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}/duplicate`, {
    method: "POST",
    errorMessage: "Failed to duplicate scene",
  });
}

/**
 * Options for listing scenes
 */
export interface ListScenesOptions {
  /**
   * Filter response to include only specified fields.
   * Reduces payload size when you don't need all scene data.
   *
   * Example: ['id', 'title', 'thumbnailUrl', 'updatedAt', 'isPublic', 'canEdit']
   */
  fields?: string[];
}

/**
 * List scenes in a workspace (optionally filtered by collection)
 *
 * @param workspaceId - The workspace to list scenes from
 * @param collectionId - Optional collection filter
 * @param options - Optional settings like field filtering
 */
export async function listWorkspaceScenes(
  workspaceId: string,
  collectionId?: string,
  options?: ListScenesOptions,
): Promise<WorkspaceScene[]> {
  const params = new URLSearchParams({ workspaceId });
  if (collectionId) {
    params.append("collectionId", collectionId);
  }
  if (options?.fields?.length) {
    params.append("fields", options.fields.join(","));
  }

  return apiRequest(`/workspace/scenes?${params.toString()}`, {
    errorMessage: "Failed to list scenes",
  });
}

/**
 * Move a scene to a different collection
 */
export async function moveScene(
  sceneId: string,
  collectionId: string | null,
): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${sceneId}/move`, {
    method: "PUT",
    ...jsonBody({ collectionId }),
    errorMessage: "Failed to move scene",
  });
}

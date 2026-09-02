/**
 * Workspace API - Workspace CRUD operations
 */

import { apiRequest, getApiBaseUrl, jsonBody } from "./client";

import type { Workspace, WorkspaceType } from "./types";

/**
 * List all workspaces the current user is a member of
 */
export async function listWorkspaces(): Promise<Workspace[]> {
  return apiRequest("/workspaces", {
    errorMessage: "Failed to list workspaces",
  });
}

/**
 * Get a single workspace
 */
export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  return apiRequest(`/workspaces/${workspaceId}`, {
    errorMessage: "Failed to get workspace",
  });
}

/**
 * Create a new workspace
 */
export async function createWorkspace(data: {
  name: string;
  slug?: string;
  type?: WorkspaceType;
}): Promise<Workspace> {
  return apiRequest("/workspaces", {
    method: "POST",
    ...jsonBody(data),
    errorMessage: "Failed to create workspace",
  });
}

/**
 * Update workspace settings
 */
export async function updateWorkspace(
  workspaceId: string,
  data: { name?: string; slug?: string },
): Promise<Workspace> {
  return apiRequest(`/workspaces/${workspaceId}`, {
    method: "PUT",
    ...jsonBody(data),
    errorMessage: "Failed to update workspace",
  });
}

/**
 * Upload workspace avatar image
 */
export async function uploadWorkspaceAvatar(
  workspaceId: string,
  file: File,
): Promise<Workspace> {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(
    `${getApiBaseUrl()}/workspaces/${workspaceId}/avatar`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authenticated");
    }
    if (response.status === 403) {
      throw new Error("Admin access required");
    }
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(error.message || "Invalid file");
    }
    if (response.status === 413) {
      throw new Error("Image file is too large");
    }
    throw new Error("Failed to upload workspace avatar");
  }

  return response.json();
}

/**
 * Delete a workspace
 */
export async function deleteWorkspace(
  workspaceId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/workspaces/${workspaceId}`, {
    method: "DELETE",
    errorMessage: "Failed to delete workspace",
  });
}

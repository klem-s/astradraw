/**
 * Teams API - Team CRUD operations
 */

import { apiRequest, jsonBody } from "./client";

import type { Team } from "./types";

/**
 * List all teams in a workspace
 */
export async function listTeams(workspaceId: string): Promise<Team[]> {
  return apiRequest(`/workspaces/${workspaceId}/teams`, {
    errorMessage: "Failed to list teams",
  });
}

/**
 * Create a new team
 */
export async function createTeam(
  workspaceId: string,
  data: {
    name: string;
    color: string;
    memberIds?: string[];
    collectionIds?: string[];
  },
): Promise<Team> {
  return apiRequest(`/workspaces/${workspaceId}/teams`, {
    method: "POST",
    ...jsonBody(data),
    errorMessage: "Failed to create team",
  });
}

/**
 * Get a single team
 */
export async function getTeam(teamId: string): Promise<Team> {
  return apiRequest(`/teams/${teamId}`, {
    errorMessage: "Failed to get team",
  });
}

/**
 * Update a team
 */
export async function updateTeam(
  teamId: string,
  data: {
    name?: string;
    color?: string;
    memberIds?: string[];
    collectionIds?: string[];
  },
): Promise<Team> {
  return apiRequest(`/teams/${teamId}`, {
    method: "PUT",
    ...jsonBody(data),
    errorMessage: "Failed to update team",
  });
}

/**
 * Delete a team
 */
export async function deleteTeam(
  teamId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/teams/${teamId}`, {
    method: "DELETE",
    errorMessage: "Failed to delete team",
  });
}

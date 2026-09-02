/**
 * Talktrack API - Recording management
 */

import { apiRequest, jsonBody } from "./client";

import type {
  TalktrackRecording,
  CreateTalktrackDto,
  UpdateTalktrackDto,
} from "./types";

/**
 * List all talktrack recordings for a scene
 */
export async function listTalktracks(
  sceneId: string,
): Promise<TalktrackRecording[]> {
  return apiRequest(`/workspace/scenes/${sceneId}/talktracks`, {
    errorMessage: "Failed to list recordings",
  });
}

/**
 * Create a new talktrack recording for a scene
 */
export async function createTalktrack(
  sceneId: string,
  dto: CreateTalktrackDto,
): Promise<TalktrackRecording> {
  return apiRequest(`/workspace/scenes/${sceneId}/talktracks`, {
    method: "POST",
    ...jsonBody(dto),
    errorMessage: "Failed to create recording",
  });
}

/**
 * Update a talktrack recording
 */
export async function updateTalktrack(
  sceneId: string,
  recordingId: string,
  dto: UpdateTalktrackDto,
): Promise<TalktrackRecording> {
  return apiRequest(`/workspace/scenes/${sceneId}/talktracks/${recordingId}`, {
    method: "PUT",
    ...jsonBody(dto),
    errorMessage: "Failed to update recording",
  });
}

/**
 * Delete a talktrack recording
 */
export async function deleteTalktrack(
  sceneId: string,
  recordingId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/workspace/scenes/${sceneId}/talktracks/${recordingId}`, {
    method: "DELETE",
    errorMessage: "Failed to delete recording",
  });
}

/**
 * Update talktrack processing status
 */
export async function updateTalktrackStatus(
  sceneId: string,
  recordingId: string,
  status: string,
): Promise<TalktrackRecording> {
  return apiRequest(
    `/workspace/scenes/${sceneId}/talktracks/${recordingId}/status`,
    {
      method: "PUT",
      ...jsonBody({ status }),
      errorMessage: "Failed to update status",
    },
  );
}

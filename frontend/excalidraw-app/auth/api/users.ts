/**
 * User Profile API - User profile and avatar management
 */

import { apiRequest, getApiBaseUrl, jsonBody } from "./client";

import type { UserProfile, UpdateProfileDto } from "./types";

/**
 * Get current user's profile
 */
export async function getUserProfile(): Promise<UserProfile> {
  return apiRequest("/users/me", {
    errorMessage: "Failed to get profile",
  });
}

/**
 * Update current user's profile
 */
export async function updateUserProfile(
  data: UpdateProfileDto,
): Promise<UserProfile> {
  return apiRequest("/users/me", {
    method: "PUT",
    ...jsonBody(data),
    errorMessage: "Failed to update profile",
  });
}

/**
 * Upload avatar image
 */
export async function uploadAvatar(file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(`${getApiBaseUrl()}/users/me/avatar`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Not authenticated");
    }
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(error.message || "Invalid file");
    }
    throw new Error("Failed to upload avatar");
  }

  return response.json();
}

/**
 * Delete avatar (reset to default)
 */
export async function deleteAvatar(): Promise<UserProfile> {
  return apiRequest("/users/me/avatar/delete", {
    method: "PUT",
    errorMessage: "Failed to delete avatar",
  });
}

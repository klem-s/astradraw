/**
 * Thumbnail generation utility for scene previews.
 *
 * This module provides a shared utility function that generates and uploads
 * scene thumbnails after successful saves (both solo autosave and collaboration save).
 *
 * Key features:
 * - Hash-based change detection to skip redundant generation
 * - Concurrency guard to prevent parallel generation for same scene
 * - Best-effort: errors are logged but never block saves
 * - Fire-and-forget: no await needed in calling code
 */

import { exportToBlob } from "@excalidraw/excalidraw";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { uploadSceneThumbnail } from "../auth/workspaceApi";
import { queryClient, queryKeys } from "../lib/queryClient";

// ============================================================================
// Module-level state
// ============================================================================

/**
 * Track the last thumbnail hash per scene to skip redundant generation.
 * Key: sceneId, Value: hash string
 */
const lastThumbnailHashes = new Map<string, string>();

/**
 * Track scenes currently generating thumbnails to prevent parallel generation.
 */
const pendingThumbnails = new Set<string>();

// ============================================================================
// Hash function
// ============================================================================

/**
 * Simple string hash using djb2 algorithm.
 * Fast and produces reasonably distributed hashes for change detection.
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to base36 for shorter string representation
  return (hash >>> 0).toString(36);
}

/**
 * Generate a lightweight hash of the visual state of a scene.
 * Only includes properties that affect the visual output:
 * - Element IDs and versions (captures all drawing changes)
 * - Background color
 * - File IDs (images)
 */
export function generateSceneHash(
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): string {
  // Filter out deleted elements - they don't affect visual output
  const visibleElements = elements.filter((el) => !el.isDeleted);

  const data = {
    // Element ids + versions capture all drawing changes
    elements: visibleElements.map((e) => `${e.id}:${e.version}`).join(","),
    // Background color affects thumbnail
    bgColor: appState.viewBackgroundColor || "#ffffff",
    // File ids (images) affect thumbnail
    fileIds: Object.keys(files || {})
      .sort()
      .join(","),
  };

  return simpleHash(JSON.stringify(data));
}

// ============================================================================
// Thumbnail generation
// ============================================================================

/**
 * Generate a thumbnail blob from scene data.
 * Uses exportToBlob with optimized settings for preview images.
 */
async function generateThumbnail(
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): Promise<Blob> {
  // Filter out deleted elements
  const visibleElements = elements.filter(
    (el) => !el.isDeleted,
  ) as typeof elements;

  // If no visible elements, create a minimal thumbnail
  if (visibleElements.length === 0) {
    // Return a small transparent PNG for empty scenes
    // This prevents errors from exportToBlob with empty elements
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob || new Blob());
      }, "image/png");
    });
  }

  return exportToBlob({
    elements: visibleElements,
    appState: {
      ...appState,
      exportBackground: true,
      exportScale: 1,
      exportWithDarkMode: appState.theme === "dark",
    },
    files: files || {},
    maxWidthOrHeight: 600, // Medium quality, ~30-80KB
    mimeType: "image/png",
  });
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Best-effort thumbnail generation. Called after successful save.
 *
 * This function:
 * 1. Computes a lightweight hash of the visual state
 * 2. Compares with the last thumbnail hash for this scene
 * 3. If different, generates a 600px PNG thumbnail
 * 4. Uploads to backend
 * 5. Updates the hash on success
 *
 * Properties:
 * - Non-blocking: errors are logged and skipped
 * - Idempotent: same scene always overwrites thumbnails/{sceneId}.png
 * - Concurrent-safe: prevents parallel generation for same scene
 *
 * @param sceneId - The scene ID to generate thumbnail for
 * @param elements - Current scene elements
 * @param appState - Current app state (for background color, theme)
 * @param files - Binary files (images) in the scene
 */
export async function maybeGenerateAndUploadThumbnail(
  sceneId: string,
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
): Promise<void> {
  // Skip if already generating for this scene
  if (pendingThumbnails.has(sceneId)) {
    return;
  }

  try {
    // 1. Compute hash of current visual state
    const currentHash = generateSceneHash(elements, appState, files);

    // 2. Compare with last hash - skip if unchanged
    if (lastThumbnailHashes.get(sceneId) === currentHash) {
      return; // No visual changes, skip generation
    }

    // Mark as pending to prevent parallel generation
    pendingThumbnails.add(sceneId);

    // 3. Generate thumbnail
    const thumbnailBlob = await generateThumbnail(elements, appState, files);

    // 4. Upload to backend
    await uploadSceneThumbnail(sceneId, thumbnailBlob);

    // 5. Update hash on success
    lastThumbnailHashes.set(sceneId, currentHash);

    // 6. Invalidate scenes cache so UI updates with new thumbnail
    // Uses React Query's queryClient directly since we're not in a React component
    queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all });
  } catch (error) {
    // Best-effort: log and continue, don't affect save status
    console.warn("[Thumbnail] Generation failed:", error);
  } finally {
    // Always clean up pending state
    pendingThumbnails.delete(sceneId);
  }
}

/**
 * Clear the thumbnail hash for a scene.
 * Call this when a scene is deleted or when you want to force regeneration.
 */
export function clearThumbnailHash(sceneId: string): void {
  lastThumbnailHashes.delete(sceneId);
}

/**
 * Clear all thumbnail hashes.
 * Call this on logout or workspace switch.
 */
export function clearAllThumbnailHashes(): void {
  lastThumbnailHashes.clear();
}

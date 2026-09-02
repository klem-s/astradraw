/**
 * Kinescope API integration for Talktrack
 *
 * Handles video upload and playback via Kinescope service.
 * Note: For security, uploads should be proxied through the storage backend
 * to keep the API key server-side. For personal use, direct upload is also supported.
 */

export interface TalktrackRecording {
  id: string;
  title: string;
  kinescopeVideoId: string;
  duration: number; // in seconds
  createdAt: string;
  thumbnailUrl?: string;
  processingStatus?: "uploading" | "processing" | "ready" | "error";
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

// Get Kinescope API key from runtime env (Docker) or build-time env (local dev)
const getKinescopeApiKey = (): string => {
  // Check runtime environment first (Docker container)
  if (
    typeof window !== "undefined" &&
    (window as any).__ENV__?.VITE_APP_KINESCOPE_API_KEY
  ) {
    return (window as any).__ENV__.VITE_APP_KINESCOPE_API_KEY;
  }
  // Fall back to build-time environment (local development)
  return import.meta.env.VITE_APP_KINESCOPE_API_KEY || "";
};

// Get Kinescope project ID from runtime env (Docker) or build-time env (local dev)
const getKinescopeProjectId = (): string => {
  // Check runtime environment first (Docker container)
  if (
    typeof window !== "undefined" &&
    (window as any).__ENV__?.VITE_APP_KINESCOPE_PROJECT_ID
  ) {
    return (window as any).__ENV__.VITE_APP_KINESCOPE_PROJECT_ID;
  }
  // Fall back to build-time environment (local development)
  return import.meta.env.VITE_APP_KINESCOPE_PROJECT_ID || "";
};

// Get storage backend URL from runtime env (Docker) or build-time env (local dev)
const getStorageBackendUrl = (): string => {
  // Check runtime environment first (Docker container)
  if (
    typeof window !== "undefined" &&
    (window as any).__ENV__?.VITE_APP_HTTP_STORAGE_BACKEND_URL
  ) {
    return (window as any).__ENV__.VITE_APP_HTTP_STORAGE_BACKEND_URL;
  }
  // Fall back to build-time environment (local development)
  return import.meta.env.VITE_APP_HTTP_STORAGE_BACKEND_URL || "";
};

/**
 * Check if Kinescope is configured
 * Returns true if either:
 * - Storage backend proxy is available (secure, recommended)
 * - API keys are available for direct upload (fallback)
 */
export function isKinescopeConfigured(): boolean {
  const hasStorageBackend = Boolean(getStorageBackendUrl());
  const hasApiKeys = Boolean(getKinescopeApiKey() && getKinescopeProjectId());
  return hasStorageBackend || hasApiKeys;
}

/**
 * Generate a unique ID for recordings
 */
function generateRecordingId(): string {
  return `talktrack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Upload a video blob to Kinescope
 * Uses storage backend proxy if available (more secure), otherwise direct upload
 */
export async function uploadToKinescope(
  blob: Blob,
  title: string,
  onProgress?: UploadProgressCallback,
): Promise<string> {
  const storageUrl = getStorageBackendUrl();

  // Use proxy if storage backend is configured (keeps API key server-side)
  if (storageUrl) {
    return uploadViaProxy(blob, title, onProgress);
  }

  // Direct upload (API key exposed in browser, suitable for personal use)
  if (!isKinescopeConfigured()) {
    throw new Error(
      "Kinescope is not configured. Please set KINESCOPE_API_KEY and KINESCOPE_PROJECT_ID.",
    );
  }

  const url = "https://uploader.kinescope.io/v2/video";

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          // Kinescope returns the video ID in the response
          const videoId = response.data?.id || response.id;
          if (videoId) {
            resolve(videoId);
          } else {
            reject(new Error("No video ID in response"));
          }
        } catch (error) {
          reject(new Error("Failed to parse upload response"));
        }
      } else {
        reject(
          new Error(
            `Upload failed with status ${xhr.status}: ${xhr.statusText}`,
          ),
        );
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted"));
    });

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${getKinescopeApiKey()}`);
    xhr.setRequestHeader("X-Parent-ID", getKinescopeProjectId());
    xhr.setRequestHeader("X-Video-Title", title);
    xhr.setRequestHeader(
      "X-File-Name",
      `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.webm`,
    );
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.send(blob);
  });
}

/**
 * Upload via storage backend proxy (more secure for production)
 */
export async function uploadViaProxy(
  blob: Blob,
  title: string,
  onProgress?: UploadProgressCallback,
): Promise<string> {
  const storageUrl = getStorageBackendUrl();
  if (!storageUrl) {
    throw new Error("Storage backend URL is not configured");
  }

  const url = `${storageUrl}/talktrack/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          const videoId = response.videoId || response.data?.videoId;
          if (videoId) {
            resolve(videoId);
          } else {
            reject(new Error("No video ID in response"));
          }
        } catch (error) {
          reject(new Error("Failed to parse upload response"));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.open("POST", url);
    xhr.setRequestHeader("X-Video-Title", title);

    xhr.send(blob);
  });
}

/**
 * Get the embed URL for a Kinescope video
 */
export function getKinescopeEmbedUrl(videoId: string): string {
  return `https://kinescope.io/embed/${videoId}`;
}

/**
 * Get the player URL for a Kinescope video
 */
export function getKinescopePlayerUrl(videoId: string): string {
  return `https://kinescope.io/${videoId}`;
}

/**
 * Check video processing status from Kinescope
 * Kinescope statuses: pending, uploading, pre-processing, processing, aborted, done, error
 */
export async function checkVideoStatus(
  videoId: string,
): Promise<"processing" | "ready" | "error"> {
  const storageUrl = getStorageBackendUrl();

  try {
    if (storageUrl) {
      // Use proxy if available
      // eslint-disable-next-line no-console
      console.log(`[Talktrack] Checking video status via proxy: ${videoId}`);
      const response = await fetch(`${storageUrl}/talktrack/${videoId}/status`);
      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error(`[Talktrack] Status check failed: ${response.status}`);
        return "error";
      }
      const data = await response.json();
      // eslint-disable-next-line no-console
      console.log(`[Talktrack] Video ${videoId} status:`, data.status);
      return data.status === "ready" ? "ready" : "processing";
    }
    // Direct API call (fallback)
    const apiKey = getKinescopeApiKey();
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.error("[Talktrack] No API key available");
      return "error";
    }

    // eslint-disable-next-line no-console
    console.log(`[Talktrack] Checking video status directly: ${videoId}`);
    const response = await fetch(
      `https://api.kinescope.io/v1/videos/${videoId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(`[Talktrack] Status check failed: ${response.status}`);
      return "error";
    }

    const data = await response.json();
    // Kinescope returns status in data.data.status field
    // Status values: pending, uploading, pre-processing, processing, aborted, done, error
    const status = data.data?.status;
    // eslint-disable-next-line no-console
    console.log(`[Talktrack] Video ${videoId} Kinescope status: ${status}`);
    return status === "done" ? "ready" : "processing";
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Talktrack] Failed to check video status:", error);
    return "error";
  }
}

// Local storage key for recordings
const RECORDINGS_STORAGE_KEY = "astradraw_talktrack_recordings";

/**
 * Save a recording to local storage
 */
export function saveRecording(recording: TalktrackRecording): void {
  const recordings = getRecordings();
  recordings.unshift(recording); // Add to beginning
  localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
}

/**
 * Get all recordings from local storage
 */
export function getRecordings(): TalktrackRecording[] {
  try {
    const data = localStorage.getItem(RECORDINGS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Delete a recording from local storage and optionally from Kinescope
 */
export async function deleteRecording(
  id: string,
  alsoDeleteFromKinescope = true,
): Promise<void> {
  const recordings = getRecordings();
  const recording = recordings.find((r) => r.id === id);

  // Delete from Kinescope if requested
  if (recording && alsoDeleteFromKinescope) {
    try {
      await deleteFromKinescope(recording.kinescopeVideoId);
    } catch (err) {
      console.error("Failed to delete from Kinescope:", err);
      // Continue with local deletion even if Kinescope delete fails
    }
  }

  const filtered = recordings.filter((r) => r.id !== id);
  localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Delete a video from Kinescope
 * Uses storage backend proxy if available, otherwise direct API call
 */
export async function deleteFromKinescope(videoId: string): Promise<void> {
  const storageUrl = getStorageBackendUrl();

  // Use proxy if available (keeps API key server-side)
  if (storageUrl) {
    const response = await fetch(`${storageUrl}/talktrack/${videoId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete video: ${response.status}`);
    }
    return;
  }

  // Direct API call (API key exposed in browser)
  if (!isKinescopeConfigured()) {
    throw new Error("Kinescope is not configured");
  }

  const response = await fetch(
    `https://api.kinescope.io/v1/videos/${videoId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${getKinescopeApiKey()}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete video: ${response.status}`);
  }
}

/**
 * Rename a recording in local storage
 */
export function renameRecording(id: string, newTitle: string): void {
  const recordings = getRecordings();
  const recording = recordings.find((r) => r.id === id);
  if (recording) {
    recording.title = newTitle;
    localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
  }
}

/**
 * Update recording processing status in local storage
 */
export function updateRecordingStatus(
  id: string,
  status: "uploading" | "processing" | "ready" | "error",
): void {
  const recordings = getRecordings();
  const recording = recordings.find((r) => r.id === id);
  if (recording) {
    recording.processingStatus = status;
    localStorage.setItem(RECORDINGS_STORAGE_KEY, JSON.stringify(recordings));
  }
}

/**
 * Create a new recording entry
 */
export function createRecordingEntry(
  kinescopeVideoId: string,
  title: string,
  duration: number,
): TalktrackRecording {
  return {
    id: generateRecordingId(),
    title,
    kinescopeVideoId,
    duration,
    createdAt: new Date().toISOString(),
  };
}

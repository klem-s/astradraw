// Storage Backend Configuration
// Codraw is self-hosted and only supports the HTTP storage backend.

import {
  isSavedToHttpStorage,
  loadFilesFromHttpStorage,
  loadFromHttpStorage,
  saveFilesToHttpStorage,
  saveSceneForMigration as saveSceneToHttpStorageForMigration,
  saveToHttpStorage,
} from "./httpStorage";

import type { StorageBackend } from "./StorageBackend";

// HTTP storage adapter
const httpStorage: StorageBackend = {
  isSaved: isSavedToHttpStorage,
  saveToStorageBackend: saveToHttpStorage,
  loadFromStorageBackend: loadFromHttpStorage,
  saveFilesToStorageBackend: async ({ prefix, files }) => {
    const { savedFiles, erroredFiles } = await saveFilesToHttpStorage({
      prefix,
      files,
    });
    return {
      savedFiles: new Map(savedFiles.map((id) => [id, true] as const)),
      erroredFiles: new Map(erroredFiles.map((id) => [id, true] as const)),
    };
  },
  loadFilesFromStorageBackend: loadFilesFromHttpStorage,
  saveSceneForMigration: saveSceneToHttpStorageForMigration,
};

// Cached storage backend instance
export let storageBackend: StorageBackend | null = null;

/**
 * Get the configured storage backend.
 */
export async function getStorageBackend(): Promise<StorageBackend> {
  if (!storageBackend) {
    storageBackend = httpStorage;
  }
  return storageBackend;
}

/**
 * Check if HTTP storage backend is being used
 */
export function isHttpStorageBackend(): boolean {
  return true;
}

// Storage Backend Configuration
// Allows switching between Firebase and HTTP storage backends

import { ENV } from "../env";

import {
  isSavedToFirebase,
  loadFilesFromFirebase,
  loadFromFirebase,
  saveFilesToFirebase,
  saveToFirebase,
} from "./firebase";
import {
  isSavedToHttpStorage,
  loadFilesFromHttpStorage,
  loadFromHttpStorage,
  saveFilesToHttpStorage,
  saveSceneForMigration as saveSceneToHttpStorageForMigration,
  saveToHttpStorage,
} from "./httpStorage";

import type { StorageBackend } from "./StorageBackend";

// Firebase storage adapter
const firebaseStorage: StorageBackend = {
  isSaved: isSavedToFirebase,
  saveToStorageBackend: async (portal, elements, appState) => {
    const res = await saveToFirebase(portal, elements, appState);
    if (!res) {
      return false;
    }
    return { reconciledElements: res };
  },
  loadFromStorageBackend: loadFromFirebase,
  saveFilesToStorageBackend: async ({ prefix, files }) => {
    const { savedFiles, erroredFiles } = await saveFilesToFirebase({
      prefix,
      files,
    });
    return {
      savedFiles: new Map(savedFiles.map((id) => [id, true] as const)),
      erroredFiles: new Map(erroredFiles.map((id) => [id, true] as const)),
    };
  },
  loadFilesFromStorageBackend: loadFilesFromFirebase,
  saveSceneForMigration: async (_id, _name, _data) => {
    // Firebase migration is handled directly in ExportToExcalidrawPlus
    console.warn("Use ExportToExcalidrawPlus component for Firebase migration");
  },
};

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

// Registry of available storage backends
const storageBackends = new Map<string, StorageBackend>()
  .set("firebase", firebaseStorage)
  .set("http", httpStorage);

// Cached storage backend instance
export let storageBackend: StorageBackend | null = null;

/**
 * Get the configured storage backend based on VITE_APP_STORAGE_BACKEND env var.
 * Defaults to Firebase if not specified.
 */
export async function getStorageBackend(): Promise<StorageBackend> {
  if (storageBackend) {
    return storageBackend;
  }

  const storageBackendName = ENV.VITE_APP_STORAGE_BACKEND || "";

  if (storageBackends.has(storageBackendName)) {
    storageBackend = storageBackends.get(storageBackendName) as StorageBackend;
    // eslint-disable-next-line no-console
    console.log(`Using ${storageBackendName} storage backend`);
  } else {
    // eslint-disable-next-line no-console
    console.log("No storage backend specified, defaulting to Firebase");
    storageBackend = firebaseStorage;
  }

  return storageBackend;
}

/**
 * Check if HTTP storage backend is being used
 */
export function isHttpStorageBackend(): boolean {
  return ENV.VITE_APP_STORAGE_BACKEND === "http";
}

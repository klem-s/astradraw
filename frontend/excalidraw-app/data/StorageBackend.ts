import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type { AppState, BinaryFileData } from "@excalidraw/excalidraw/types";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

export interface StorageBackend {
  isSaved: (portal: Portal, elements: readonly ExcalidrawElement[]) => boolean;
  saveToStorageBackend: (
    portal: Portal,
    elements: readonly SyncableExcalidrawElement[],
    appState: AppState,
  ) => Promise<
    | false
    | { reconciledElements: readonly ExcalidrawElement[] }
    | readonly ExcalidrawElement[]
  >;
  loadFromStorageBackend: (
    roomId: string,
    roomKey: string,
    socket: Socket | null,
  ) => Promise<readonly SyncableExcalidrawElement[] | null>;
  saveFilesToStorageBackend: ({
    prefix,
    files,
  }: {
    prefix: string;
    files: {
      id: FileId;
      buffer: Uint8Array;
    }[];
  }) => Promise<{
    savedFiles: Map<FileId, true> | FileId[];
    erroredFiles: Map<FileId, true> | FileId[];
  }>;
  loadFilesFromStorageBackend: (
    prefix: string,
    decryptionKey: string,
    filesIds: readonly FileId[],
  ) => Promise<{
    loadedFiles: BinaryFileData[];
    erroredFiles: Map<FileId, true>;
  }>;
  saveSceneForMigration: (
    id: string,
    name: string,
    data: Blob,
  ) => Promise<void>;
}

export interface StoredScene {
  sceneVersion: number;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}

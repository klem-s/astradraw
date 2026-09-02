// HTTP Storage Backend for self-hosted Excalidraw
// Inspired by https://gitlab.com/kiliandeca/excalidraw-fork and alswl's fork
// MIT License

import { MIME_TYPES } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
  IV_LENGTH_BYTES,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";
import { reconcileElements } from "@excalidraw/excalidraw";

import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";

import { ENV } from "../env";

import { getSyncableElements } from ".";

import type Portal from "../collab/Portal";
import type { StoredScene } from "./StorageBackend";
import type { Socket } from "socket.io-client";

import type { SyncableExcalidrawElement } from ".";

const HTTP_STORAGE_BACKEND_URL = ENV.VITE_APP_HTTP_STORAGE_BACKEND_URL;
const SCENE_VERSION_LENGTH_BYTES = 4;

// Cache to track scene versions per socket connection
const httpStorageSceneVersionCache = new WeakMap<Socket, number>();

export const isSavedToHttpStorage = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);
    return httpStorageSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveToHttpStorage = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
): Promise<false | readonly ExcalidrawElement[]> => {
  const { roomId, roomKey, socket } = portal;
  if (
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToHttpStorage(portal, elements)
  ) {
    return false;
  }

  const sceneVersion = getSceneVersion(elements);
  const getResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
  );

  if (
    !getResponse.ok &&
    getResponse.status !== 404 &&
    getResponse.status !== 204
  ) {
    return false;
  }

  if (getResponse.status === 404 || getResponse.status === 204) {
    // Room doesn't exist yet, create it
    const result = await saveElementsToBackend(
      roomKey,
      roomId,
      [...elements],
      sceneVersion,
    );
    if (result) {
      httpStorageSceneVersionCache.set(socket, sceneVersion);
      return elements;
    }
    return false;
  }

  // Room exists, compare scene versions before saving
  const buffer = await getResponse.arrayBuffer();
  const sceneVersionFromRequest = parseSceneVersionFromRequest(buffer);
  if (sceneVersionFromRequest >= sceneVersion) {
    return false;
  }

  const existingElements = await getElementsFromBuffer(buffer, roomKey);
  const reconciledElements = getSyncableElements(
    reconcileElements(
      elements,
      existingElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
      appState,
    ),
  );

  const result = await saveElementsToBackend(
    roomKey,
    roomId,
    reconciledElements,
    sceneVersion,
  );

  if (result) {
    httpStorageSceneVersionCache.set(socket, sceneVersion);
    return reconciledElements as readonly ExcalidrawElement[];
  }
  return false;
};

export const loadFromHttpStorage = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const getResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
  );

  if (!getResponse.ok || getResponse.status === 204) {
    return null;
  }

  const buffer = await getResponse.arrayBuffer();
  if (!buffer.byteLength) {
    return null;
  }

  const elements = await getElementsFromBuffer(buffer, roomKey);

  if (socket) {
    httpStorageSceneVersionCache.set(socket, getSceneVersion(elements));
  }

  return getSyncableElements(restoreElements(elements, null));
};

const getElementsFromBuffer = async (
  buffer: ArrayBuffer,
  key: string,
): Promise<readonly ExcalidrawElement[]> => {
  // Buffer contains: [sceneVersion (4 bytes)][IV (12 bytes)][encrypted data]
  const iv = new Uint8Array(
    buffer.slice(
      SCENE_VERSION_LENGTH_BYTES,
      IV_LENGTH_BYTES + SCENE_VERSION_LENGTH_BYTES,
    ),
  );
  const encrypted = buffer.slice(
    IV_LENGTH_BYTES + SCENE_VERSION_LENGTH_BYTES,
    buffer.byteLength,
  );

  const sceneVersion = parseSceneVersionFromRequest(buffer);
  return await decryptElements(
    { sceneVersion, ciphertext: encrypted, iv },
    key,
  );
};

export const saveFilesToHttpStorage = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  // prefix is not used for HTTP storage but kept for interface compatibility
  void prefix;

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        // Convert Uint8Array to ArrayBuffer for Blob compatibility
        const arrayBuffer = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer;
        const payloadBlob = new Blob([arrayBuffer]);
        const payload = await new Response(payloadBlob).arrayBuffer();
        await fetch(`${HTTP_STORAGE_BACKEND_URL}/files/${id}`, {
          method: "PUT",
          body: payload,
        });
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const loadFilesFromHttpStorage = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  // prefix is not used for HTTP storage but kept for interface compatibility
  void prefix;

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const response = await fetch(`${HTTP_STORAGE_BACKEND_URL}/files/${id}`);
        if (response.status < 400 && response.status !== 204) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};

export const saveSceneForMigration = async (
  _id: string,
  _name: string,
  _data: Blob,
): Promise<void> => {
  // HTTP storage doesn't support migration to Excalidraw+
  console.warn(
    "Saving scene for migration is not supported with HTTP storage backend",
  );
};

const saveElementsToBackend = async (
  roomKey: string,
  roomId: string,
  elements: SyncableExcalidrawElement[],
  sceneVersion: number,
): Promise<boolean> => {
  const { ciphertext, iv } = await encryptElements(roomKey, elements);

  // Concatenate: [sceneVersion (4 bytes)][IV][encrypted data]
  const numberBuffer = new ArrayBuffer(4);
  const numberView = new DataView(numberBuffer);
  numberView.setUint32(0, sceneVersion, false);

  // Convert iv.buffer to proper ArrayBuffer for Blob compatibility
  const ivArrayBuffer = iv.buffer.slice(
    iv.byteOffset,
    iv.byteOffset + iv.byteLength,
  ) as ArrayBuffer;
  const payloadBlob = await new Response(
    new Blob([numberBuffer, ivArrayBuffer, ciphertext]),
  ).arrayBuffer();

  const putResponse = await fetch(
    `${HTTP_STORAGE_BACKEND_URL}/rooms/${roomId}`,
    {
      method: "PUT",
      body: payloadBlob,
    },
  );

  return putResponse.ok;
};

const parseSceneVersionFromRequest = (buffer: ArrayBuffer): number => {
  const view = new DataView(buffer);
  return view.getUint32(0, false);
};

const decryptElements = async (
  data: StoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = data.ciphertext;
  const iv =
    data.iv instanceof Uint8Array
      ? (data.iv as Uint8Array<ArrayBuffer>)
      : (new Uint8Array(data.iv) as Uint8Array<ArrayBuffer>);

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

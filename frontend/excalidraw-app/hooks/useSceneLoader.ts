/**
 * useSceneLoader Hook
 *
 * Manages scene loading from workspace URLs, including:
 * - Loading scene data from backend
 * - Updating Excalidraw with scene content
 * - Auto-joining collaboration rooms
 * - Managing scene state (id, title, access)
 */

import { useCallback, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";

import {
  loadWorkspaceScene,
  type SceneAccess,
} from "../data/workspaceSceneLoader";

import type { CollabAPI } from "../collab/Collab";

export interface UseSceneLoaderOptions {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  collabAPI: CollabAPI | null;
  isCollabDisabled: boolean;
  /** Callback to set auto-collab scene state */
  setIsAutoCollabScene: (value: boolean) => void;
  /** Callback to navigate to canvas mode */
  navigateToCanvas: () => void;
  /** Callback when error occurs */
  onError: (message: string) => void;
  /** Callback to initialize autosave with loaded data */
  initializeAutoSave?: (dataJson: string) => void;
  /** Callback to set active collection ID when scene is loaded */
  setActiveCollectionId?: (collectionId: string | null) => void;
}

export interface UseSceneLoaderReturn {
  /** Current scene ID (null if no scene loaded) */
  currentSceneId: string | null;
  /** Current scene title */
  currentSceneTitle: string;
  /** Current scene access permissions */
  currentSceneAccess: SceneAccess | null;
  /** Current workspace slug */
  currentWorkspaceSlug: string | null;
  /** Set current scene ID */
  setCurrentSceneId: (id: string | null) => void;
  /** Set current scene title */
  setCurrentSceneTitle: (title: string) => void;
  /** Set current workspace slug */
  setCurrentWorkspaceSlug: (slug: string | null) => void;
  /**
   * Load a scene from workspace URL
   * @param workspaceSlug - Workspace slug
   * @param sceneId - Scene ID to load
   * @param options - Additional options
   */
  loadScene: (
    workspaceSlug: string,
    sceneId: string,
    options?: {
      isInitialLoad?: boolean;
      roomKeyFromHash?: string | null;
      /** Promise to resolve with initial data (for initial load) */
      initialStatePromise?: {
        resolve: (data: any) => void;
      };
    },
  ) => Promise<void>;
  /** Ref to access loadScene in closures */
  loadSceneRef: React.MutableRefObject<
    ((workspaceSlug: string, sceneId: string) => Promise<void>) | null
  >;
  /** Ref to access currentSceneId in closures */
  currentSceneIdRef: React.MutableRefObject<string | null>;
}

export function useSceneLoader({
  excalidrawAPI,
  collabAPI,
  isCollabDisabled,
  setIsAutoCollabScene,
  navigateToCanvas,
  onError,
  initializeAutoSave,
  setActiveCollectionId,
}: UseSceneLoaderOptions): UseSceneLoaderReturn {
  // Scene state
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [currentSceneTitle, setCurrentSceneTitle] =
    useState<string>("Untitled");
  const [currentSceneAccess, setCurrentSceneAccess] =
    useState<SceneAccess | null>(null);
  const [currentWorkspaceSlug, setCurrentWorkspaceSlug] = useState<
    string | null
  >(null);

  // Refs for closure access
  const currentSceneIdRef = useRef<string | null>(null);
  currentSceneIdRef.current = currentSceneId;

  const loadSceneRef = useRef<
    ((workspaceSlug: string, sceneId: string) => Promise<void>) | null
  >(null);

  // Loading lock to prevent multiple simultaneous scene loads
  const isLoadingRef = useRef<boolean>(false);
  const pendingSceneRef = useRef<string | null>(null);

  // Helper to decode base64 to blob
  const decodeBase64ToBlob = useCallback((base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: "application/json" });
  }, []);

  // Main scene loading function
  const loadScene = useCallback(
    async (
      workspaceSlug: string,
      sceneId: string,
      options: {
        isInitialLoad?: boolean;
        roomKeyFromHash?: string | null;
        initialStatePromise?: {
          resolve: (data: any) => void;
        };
      } = {},
    ) => {
      if (!excalidrawAPI) {
        return;
      }

      const {
        isInitialLoad = false,
        roomKeyFromHash = null,
        initialStatePromise,
      } = options;

      // Prevent multiple simultaneous scene loads
      // If already loading, store the pending scene ID and skip this load
      // The pending scene will be loaded after the current one completes
      if (isLoadingRef.current && !isInitialLoad) {
        // eslint-disable-next-line no-console
        console.log(
          "[useSceneLoader] Already loading, queuing scene:",
          sceneId,
        );
        pendingSceneRef.current = sceneId;
        return;
      }

      // Skip if trying to load the same scene that's already loaded
      if (currentSceneIdRef.current === sceneId && !isInitialLoad) {
        // eslint-disable-next-line no-console
        console.log(
          "[useSceneLoader] Scene already loaded, skipping:",
          sceneId,
        );
        return;
      }

      isLoadingRef.current = true;

      // Leave current collaboration room before switching scenes
      // IMPORTANT: Capture elements BEFORE stopping collaboration, as scene may be cleared
      // Don't await - let save happen in background to avoid blocking UI
      // The elements are captured synchronously, so they won't be lost
      if (!isInitialLoad && collabAPI?.isCollaborating()) {
        const elementsToSave = excalidrawAPI.getSceneElementsIncludingDeleted();
        // Fire and forget - save happens in background
        collabAPI.stopCollaboration(false, elementsToSave).catch((err) => {
          console.error("[useSceneLoader] Error stopping collaboration:", err);
        });
      }

      // Show loading state immediately when switching scenes (not on initial load)
      // This prevents user interaction and shows a loading indicator instead of stale content
      // Using isLoading: true disables drawing tools and hides the welcome screen
      if (!isInitialLoad) {
        excalidrawAPI.updateScene({
          elements: [], // Clear elements to prevent stale content
          appState: { isLoading: true },
        });
      }

      try {
        const loaded = await loadWorkspaceScene(workspaceSlug, sceneId);
        // eslint-disable-next-line no-console
        console.log("[useSceneLoader] Scene loaded:", {
          sceneId: loaded.scene.id,
          title: loaded.scene.title,
          collectionId: loaded.scene.collectionId,
        });

        setCurrentWorkspaceSlug(workspaceSlug);
        setCurrentSceneId(loaded.scene.id);
        setCurrentSceneTitle(loaded.scene.title || "Untitled");
        setCurrentSceneAccess(loaded.access);

        // Set the active collection from the scene's collection
        // This ensures the sidebar shows the correct collection when navigating to a scene URL
        if (setActiveCollectionId) {
          // eslint-disable-next-line no-console
          console.log(
            "[useSceneLoader] Setting activeCollectionId to:",
            loaded.scene.collectionId,
          );
          setActiveCollectionId(loaded.scene.collectionId);
        } else {
          // eslint-disable-next-line no-console
          console.log(
            "[useSceneLoader] WARNING: setActiveCollectionId is not provided!",
          );
        }

        // Check if this is a collaboration scene (shared collection)
        const isCollabScene =
          collabAPI &&
          !isCollabDisabled &&
          loaded.access.canCollaborate &&
          loaded.roomId &&
          loaded.roomKey;

        // For collaboration scenes, data should be loaded from room storage (httpStorage),
        // NOT from backend API (scene.data). Room storage is the source of truth.
        // For non-collab scenes, load from backend API as usual.
        if (isCollabScene) {
          // Use room key from hash if provided (for shared links)
          const roomKey = roomKeyFromHash || loaded.roomKey!;

          // Start collaboration - this will load data from room storage
          // and return the scene data
          const sceneData = await collabAPI.startCollaboration({
            roomId: loaded.roomId!,
            roomKey,
            isAutoCollab: true,
          });

          // IMPORTANT: Apply the loaded scene data to the canvas!
          // startCollaboration returns elements from room storage, but doesn't update the canvas
          if (sceneData?.elements) {
            excalidrawAPI.updateScene({
              elements: sceneData.elements,
              appState: { isLoading: false }, // Re-enable drawing after load
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
            // Scroll to content if requested
            if (sceneData.scrollToContent) {
              excalidrawAPI.scrollToContent();
            }
          } else {
            // No elements returned, but still need to clear loading state
            excalidrawAPI.updateScene({
              appState: { isLoading: false },
            });
          }

          // Set scene ID for thumbnail generation during collaboration saves
          collabAPI.setSceneId(sceneId);

          // Mark this scene as auto-collab (collaboration can't be stopped)
          setIsAutoCollabScene(true);

          // If startCollaboration returned scene data, resolve the initial promise
          if (isInitialLoad && initialStatePromise) {
            if (sceneData) {
              initialStatePromise.resolve(sceneData);
            } else {
              initialStatePromise.resolve(null);
            }
          }
        } else {
          // Non-collaboration scene - load from backend API (scene.data)
          let restored: RestoredDataState | null = null;
          if (loaded.data) {
            const blob = decodeBase64ToBlob(loaded.data);
            const sceneData = await loadFromBlob(blob, null, null);
            restored = sceneData;
          }

          if (restored) {
            const sceneWithCollaborators = {
              ...restored,
              appState: {
                ...restored.appState,
                collaborators: new Map(),
                isLoading: false, // Re-enable drawing after load
              },
            };

            excalidrawAPI.updateScene({
              elements: sceneWithCollaborators.elements || [],
              appState: sceneWithCollaborators.appState,
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });

            // Load files separately
            if (sceneWithCollaborators.files) {
              excalidrawAPI.addFiles(
                Object.values(sceneWithCollaborators.files),
              );
            }

            // Initialize autosave with loaded data to prevent false "unsaved" status
            if (initializeAutoSave) {
              const loadedSceneData = JSON.stringify({
                type: "excalidraw",
                version: 2,
                source: window.location.href,
                elements: sceneWithCollaborators.elements || [],
                appState: {
                  viewBackgroundColor:
                    sceneWithCollaborators.appState?.viewBackgroundColor,
                  gridSize: sceneWithCollaborators.appState?.gridSize,
                },
                files: sceneWithCollaborators.files || {},
              });
              initializeAutoSave(loadedSceneData);
            }

            if (isInitialLoad && initialStatePromise) {
              initialStatePromise.resolve({
                elements: sceneWithCollaborators.elements || [],
                appState: sceneWithCollaborators.appState,
                files: sceneWithCollaborators.files || {},
              });
            }
          } else {
            // No scene data to restore (empty scene), but still need to clear loading state
            excalidrawAPI.updateScene({
              elements: [],
              appState: { isLoading: false },
            });
            if (isInitialLoad && initialStatePromise) {
              initialStatePromise.resolve(null);
            }
          }

          // Not an auto-collab scene - clear any previous scene ID
          if (collabAPI) {
            collabAPI.setSceneId(null);
          }
          setIsAutoCollabScene(false);
        }

        navigateToCanvas();
      } catch (error) {
        console.error("Failed to load workspace scene:", error);
        onError(
          error instanceof Error ? error.message : "Failed to load scene",
        );
        // Clear loading state on error so user can interact with canvas
        excalidrawAPI.updateScene({
          appState: { isLoading: false },
        });
        if (isInitialLoad && initialStatePromise) {
          initialStatePromise.resolve(null);
        }
      } finally {
        // Release loading lock
        isLoadingRef.current = false;

        // If there's a pending scene that was queued during loading, load it now
        const pendingScene = pendingSceneRef.current;
        if (pendingScene && pendingScene !== sceneId) {
          pendingSceneRef.current = null;
          // eslint-disable-next-line no-console
          console.log("[useSceneLoader] Loading pending scene:", pendingScene);
          // Use setTimeout to avoid stack overflow and allow UI to update
          setTimeout(() => {
            loadSceneRef.current?.(workspaceSlug, pendingScene);
          }, 0);
        }
      }
    },
    [
      excalidrawAPI,
      collabAPI,
      isCollabDisabled,
      decodeBase64ToBlob,
      setIsAutoCollabScene,
      navigateToCanvas,
      onError,
      initializeAutoSave,
      setActiveCollectionId,
    ],
  );

  // Update ref when loadScene changes
  loadSceneRef.current = loadScene;

  return {
    currentSceneId,
    currentSceneTitle,
    currentSceneAccess,
    currentWorkspaceSlug,
    setCurrentSceneId,
    setCurrentSceneTitle,
    setCurrentWorkspaceSlug,
    loadScene,
    loadSceneRef,
    currentSceneIdRef,
  };
}

import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  useEditorInterface,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  THEME,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useCallbackRefState } from "@excalidraw/excalidraw/hooks/useCallbackRefState";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  GithubIcon,
  usersIcon,
  share,
} from "@excalidraw/excalidraw/components/icons";
import { isElementLink } from "@excalidraw/element";
import { restore, restoreAppState } from "@excalidraw/excalidraw/data/restore";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import { Toaster } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import { queryKeys } from "./lib/queryClient";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useAtomValue,
  useSetAtom,
  useAtomWithInitialValue,
  appJotaiStore,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
  ASTRADRAW_GITHUB_URL,
} from "./app_constants";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import { ExportToExcalidrawPlus } from "./components/ExportToExcalidrawPlus";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  isCollaborationLink,
  loadScene,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import { getStorageBackend } from "./data/config";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { ExcalidrawPlusIframeExport } from "./ExcalidrawPlusIframeExport";

import "./index.scss";

// AstraDraw: ExcalidrawPlusPromoBanner removed
import { AppSidebar } from "./components/AppSidebar";
import { PresentationMode } from "./components/Presentation";
import { PenToolbar, getDefaultPenPresets } from "./pens";
import { getBundledLibraries } from "./env";
import { AuthProvider, useAuth } from "./auth";
import {
  WorkspaceSidebar,
  WorkspaceSidebarTrigger,
  InviteAcceptPage,
  QuickSearchModal,
} from "./components/Workspace";

import { SaveStatusIndicator } from "./components/SaveStatusIndicator";

import {
  appModeAtom,
  navigateToCanvasAtom,
  navigateToDashboardAtom,
  activeCollectionIdAtom,
  currentWorkspaceSlugAtom,
  currentSceneIdAtom,
  currentSceneTitleAtom,
  dashboardViewAtom,
  isPrivateCollectionAtom,
  isAutoCollabSceneAtom,
  logoutSignalAtom,
  isLoggingOutAtom,
  quickSearchOpenAtom,
  workspaceSidebarOpenAtom,
  openWorkspaceSidebarAtom,
  closeWorkspaceSidebarAtom,
  toggleWorkspaceSidebarAtom,
  // Workspace data atoms
  currentWorkspaceAtom,
  privateCollectionAtom,
  type WorkspaceData,
} from "./components/Settings";

import {
  toggleCommentModeAtom,
  selectedThreadIdAtom,
  ThreadMarkersLayer,
  CommentCreationOverlay,
  ThreadPopup,
  NewThreadPopup,
  CommentSyncProvider,
} from "./components/Comments";
import { useCommentSync } from "./hooks/useCommentSync";

import { buildSceneUrl } from "./router";

import { WorkspaceMainContent } from "./components/Workspace";
import {
  ErrorBoundary,
  SidebarErrorFallback,
  ContentErrorFallback,
} from "./components/ErrorBoundary";

import {
  createScene,
  updateSceneData,
  updateWorkspace,
  uploadWorkspaceAvatar,
  deleteWorkspace,
  listWorkspaces,
  startCollaboration,
} from "./auth/workspaceApi";
import { loadWorkspaceScene } from "./data/workspaceSceneLoader";

// Import extracted hooks
import { useAutoSave } from "./hooks/useAutoSave";
import { useSceneLoader } from "./hooks/useSceneLoader";
import { useUrlRouting } from "./hooks/useUrlRouting";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  useUIDebugLogger,
  useVisibilityDebugLogger,
} from "./hooks/useUIDebugLogger";

import type { CollabAPI } from "./collab/Collab";

import type { Workspace } from "./auth/workspaceApi";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const SCENE_URL_PATTERN = /^\/workspace\/([^/]+)\/scene\/([^/#]+)/;
const LEGACY_ROOM_PATTERN = /^#room=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/;
const INVITE_URL_PATTERN = /^\/invite\/([a-zA-Z0-9_-]+)$/;

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();

  let scene: RestoredDataState & {
    scrollToContent?: boolean;
  } = await loadScene(null, null, localDataState);

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        scene = await loadScene(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
          localDataState,
        );
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  // Add default pen presets to scene
  const defaultPenPresets = getDefaultPenPresets();
  const addPenPresets = (sceneData: typeof scene | null) => {
    if (!sceneData) {
      return null;
    }
    return {
      ...sceneData,
      appState: {
        ...sceneData.appState,
        customPens: sceneData.appState?.customPens ?? defaultPenPresets,
      },
    };
  };

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
          customPens: defaultPenPresets,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene: addPenPresets(scene),
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene: addPenPresets(scene), isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const ExcalidrawWrapper = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const isCollabDisabled = isRunningInIframe();

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  const editorInterface = useEditorInterface();

  // App mode state (canvas, settings, or dashboard)
  const appMode = useAtomValue(appModeAtom);
  const setAppMode = useSetAtom(appModeAtom);
  const navigateToCanvas = useSetAtom(navigateToCanvasAtom);
  const navigateToDashboard = useSetAtom(navigateToDashboardAtom);
  const setActiveCollectionId = useSetAtom(activeCollectionIdAtom);
  const queryClient = useQueryClient();

  // Helper to invalidate scenes cache (replaces triggerScenesRefresh)
  const invalidateScenesCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all });
  }, [queryClient]);

  // URL-based navigation atoms
  const setCurrentWorkspaceSlugAtom = useSetAtom(currentWorkspaceSlugAtom);
  const setCurrentSceneIdAtom = useSetAtom(currentSceneIdAtom);
  const setCurrentSceneTitleAtom = useSetAtom(currentSceneTitleAtom);
  const setDashboardView = useSetAtom(dashboardViewAtom);
  const setIsPrivateCollection = useSetAtom(isPrivateCollectionAtom);
  const setIsAutoCollabScene = useSetAtom(isAutoCollabSceneAtom);
  const isAutoCollabScene = useAtomValue(isAutoCollabSceneAtom);

  // Logout signal - used to reset the canvas when user logs out
  const logoutSignal = useAtomValue(logoutSignalAtom);
  // Logout in progress flag - prevents autosave from saving empty canvas
  const isLoggingOut = useAtomValue(isLoggingOutAtom);

  // Quick Search modal state
  const setQuickSearchOpen = useSetAtom(quickSearchOpenAtom);

  // Comment mode state
  const toggleCommentMode = useSetAtom(toggleCommentModeAtom);

  // Workspace data from Jotai atoms
  const currentWorkspace = useAtomValue(currentWorkspaceAtom);
  const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom);
  const privateCollection = useAtomValue(privateCollectionAtom);
  const privateCollectionId = privateCollection?.id || null;

  // Auth state for auto-open on login
  const { isAuthenticated } = useAuth();
  const wasAuthenticated = useRef(false);

  // Workspace sidebar state - from Jotai atom (persisted to localStorage)
  const workspaceSidebarOpen = useAtomValue(workspaceSidebarOpenAtom);
  const openWorkspaceSidebar = useSetAtom(openWorkspaceSidebarAtom);
  const closeWorkspaceSidebar = useSetAtom(closeWorkspaceSidebarAtom);
  const toggleWorkspaceSidebar = useSetAtom(toggleWorkspaceSidebarAtom);

  const [isLegacyMode, setIsLegacyMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("mode") === "anonymous" ||
      !!window.location.hash.match(LEGACY_ROOM_PATTERN)
    );
  });

  // Invite link handling - check URL on initial load
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(
    () => {
      const match = window.location.pathname.match(INVITE_URL_PATTERN);
      return match ? match[1] : null;
    },
  );

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [excalidrawAPI, excalidrawRefCallback] =
    useCallbackRefState<ExcalidrawImperativeAPI>();

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  // =========================================================================
  // Use extracted hooks
  // =========================================================================

  // Scene loader hook
  const {
    currentSceneId,
    currentSceneTitle,
    currentSceneAccess,
    currentWorkspaceSlug,
    setCurrentSceneId,
    setCurrentSceneTitle,
    setCurrentWorkspaceSlug,
    loadSceneRef,
    currentSceneIdRef,
  } = useSceneLoader({
    excalidrawAPI,
    collabAPI,
    isCollabDisabled,
    setIsAutoCollabScene,
    navigateToCanvas,
    onError: setErrorMessage,
    initializeAutoSave: undefined, // Will be connected after autoSave hook
    setActiveCollectionId,
  });

  // Autosave hook
  const {
    saveStatus,
    lastSavedTime,
    handleSaveRetry,
    markUnsaved,
    initializeWithLoadedData,
    // saveImmediately - available but not currently used
  } = useAutoSave({
    currentSceneId,
    excalidrawAPI,
    isCollaborating,
    isLoggingOut,
  });

  // Setter for selected thread (for deep links)
  const setSelectedThreadId = useSetAtom(selectedThreadIdAtom);

  // Open comments sidebar via excalidrawAPI
  const openCommentsSidebar = useCallback(() => {
    if (excalidrawAPI) {
      excalidrawAPI.toggleSidebar({ name: "default", tab: "comments" });
    }
  }, [excalidrawAPI]);

  // Comment real-time sync hook
  // Listens for comment events from collaborators and updates React Query cache
  const collabSocket = collabAPI?.getSocket() ?? null;
  const collabRoomId = collabAPI?.getRoomId() ?? null;
  useCommentSync(currentSceneId, collabSocket, collabRoomId, isCollaborating);

  // URL routing hook
  useUrlRouting({
    loadSceneFromUrl: async (slug, id) => {
      if (loadSceneRef.current) {
        await loadSceneRef.current(slug, id);
      }
    },
    currentSceneIdRef,
    setAppMode,
    setActiveCollectionId,
    setCurrentWorkspaceSlug: setCurrentWorkspaceSlugAtom,
    setDashboardView,
    setIsPrivateCollection,
    setSelectedThreadId,
    openCommentsSidebar,
  });

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    isAuthenticated,
    currentSceneId,
    excalidrawAPI,
    onSave: () => {
      if (currentSceneId && excalidrawAPI) {
        handleSaveToWorkspace();
      }
    },
    toggleWorkspaceSidebar,
    setQuickSearchOpen,
    toggleCommentMode,
  });

  // Debug logging for UI state (enable with: window.__ASTRADRAW_DEBUG_UI__ = true)
  useUIDebugLogger(excalidrawAPI);
  useVisibilityDebugLogger();

  // =========================================================================
  // Prevent browser zoom on pinch gestures over UI elements
  // =========================================================================
  // When pinch-to-zoom happens over toolbar/sidebar (not canvas),
  // the browser's native zoom kicks in. This prevents that.
  useEffect(() => {
    const preventBrowserZoom = (event: WheelEvent) => {
      // ctrlKey is set during trackpad pinch-to-zoom on macOS
      if (event.ctrlKey || event.metaKey) {
        const target = event.target as HTMLElement;
        const isOnCanvas = target instanceof HTMLCanvasElement;

        // Check if target is inside any AstraDraw UI element
        const isInsideExcalidraw = target.closest(".excalidraw");
        const isInsideExcalidrawApp = target.closest(".excalidraw-app");
        const isInsideSidebar = target.closest(
          "[data-testid='workspace-sidebar']",
        );
        const isInsideDashboard = target.closest(".excalidraw-app__dashboard");
        const isInsideModal = target.closest("[role='dialog']");

        // If we're over any UI elements (not canvas), prevent browser zoom
        const isOverUI =
          isInsideExcalidraw ||
          isInsideExcalidrawApp ||
          isInsideSidebar ||
          isInsideDashboard ||
          isInsideModal;

        if (isOverUI && !isOnCanvas) {
          event.preventDefault();

          // Forward zoom to canvas if excalidrawAPI is available and we're in canvas mode
          if (excalidrawAPI && isInsideExcalidraw) {
            const appState = excalidrawAPI.getAppState();
            const delta = event.deltaY;
            const sign = Math.sign(delta);
            const ZOOM_STEP = 0.1;
            const MAX_STEP = ZOOM_STEP * 100;
            const absDelta = Math.abs(delta);
            const clampedDelta = absDelta > MAX_STEP ? MAX_STEP * sign : delta;

            let newZoom = appState.zoom.value - clampedDelta / 100;
            newZoom = Math.max(0.1, Math.min(10, newZoom)); // Clamp zoom

            excalidrawAPI.updateScene({
              appState: {
                zoom: { value: newZoom as typeof appState.zoom.value },
              },
            });
          }
        }
      }
    };

    // Use capture phase to intercept before any other handlers
    document.addEventListener("wheel", preventBrowserZoom, {
      passive: false,
      capture: true,
    });

    return () => {
      document.removeEventListener("wheel", preventBrowserZoom, {
        capture: true,
      });
    };
  }, [excalidrawAPI]);

  // =========================================================================
  // Sync Jotai atoms with local state
  // =========================================================================

  // Sync scene state with Jotai atoms
  useEffect(() => {
    setCurrentWorkspaceSlugAtom(currentWorkspaceSlug);
  }, [currentWorkspaceSlug, setCurrentWorkspaceSlugAtom]);

  useEffect(() => {
    setCurrentSceneIdAtom(currentSceneId);
  }, [currentSceneId, setCurrentSceneIdAtom]);

  useEffect(() => {
    setCurrentSceneTitleAtom(currentSceneTitle);
  }, [currentSceneTitle, setCurrentSceneTitleAtom]);

  // Auto-open sidebar when user logs in
  useEffect(() => {
    if (isAuthenticated && !wasAuthenticated.current) {
      openWorkspaceSidebar();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated, openWorkspaceSidebar]);

  // Clear canvas visually when user logs out
  // This prevents private scene content from being visible on the anonymous screen
  // IMPORTANT: We use updateScene() NOT resetScene() to avoid triggering saves
  const logoutSignalRef = useRef(logoutSignal);
  useEffect(() => {
    // Skip initial render (logoutSignal starts at 0)
    if (logoutSignal > 0 && logoutSignal !== logoutSignalRef.current) {
      logoutSignalRef.current = logoutSignal;

      // Stop any active collaboration FIRST (without saving - user is logging out)
      if (collabAPI?.isCollaborating()) {
        // Pass empty array to prevent saving current elements
        collabAPI.stopCollaboration(false, []);
      }

      // Clear the canvas visually without triggering autosave
      // updateScene with empty elements just clears the display
      // resetScene() would trigger onChange which could save empty data
      if (excalidrawAPI) {
        excalidrawAPI.updateScene({
          elements: [],
          appState: {
            // Reset to default state for anonymous user
            collaborators: new Map(),
          },
          captureUpdate: CaptureUpdateAction.NEVER, // Don't capture this as a change
        });
        // Navigate to root URL
        window.history.pushState({}, "", "/");
      }

      // Clear logout flag after canvas is cleared
      // Use setTimeout to ensure it happens after any pending onChange handlers
      setTimeout(() => {
        appJotaiStore.set(isLoggingOutAtom, false);
      }, 0);
    }
  }, [logoutSignal, excalidrawAPI, collabAPI]);

  // Close sidebar in legacy mode
  useEffect(() => {
    if (isLegacyMode) {
      closeWorkspaceSidebar();
    }
  }, [isLegacyMode, closeWorkspaceSidebar]);

  // Block Excalidraw keyboard shortcuts when in dashboard mode
  useEffect(() => {
    if (appMode === "dashboard") {
      document.body.classList.add("excalidraw-disabled");
    } else {
      document.body.classList.remove("excalidraw-disabled");
    }
    return () => {
      document.body.classList.remove("excalidraw-disabled");
    };
  }, [appMode]);

  // Auto-open sidebar when switching to dashboard mode
  useEffect(() => {
    if (appMode === "dashboard" && !isLegacyMode) {
      openWorkspaceSidebar();
    }
  }, [appMode, isLegacyMode, openWorkspaceSidebar]);

  // Update legacy mode on hash changes
  useEffect(() => {
    const updateLegacyMode = () => {
      const params = new URLSearchParams(window.location.search);
      setIsLegacyMode(
        params.get("mode") === "anonymous" ||
          !!window.location.hash.match(LEGACY_ROOM_PATTERN),
      );
    };

    window.addEventListener("hashchange", updateLegacyMode);
    window.addEventListener("popstate", updateLegacyMode);
    return () => {
      window.removeEventListener("hashchange", updateLegacyMode);
      window.removeEventListener("popstate", updateLegacyMode);
    };
  }, []);

  // =========================================================================
  // Library handling
  // =========================================================================

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
    validateLibraryUrl: (url: string) => {
      try {
        const { hostname } = new URL(url);
        const allowedDomains = [
          "astrateam.net",
          "excalidraw.com",
          "raw.githubusercontent.com",
        ];
        return allowedDomains.some((domain) => {
          return hostname === domain || hostname.endsWith(`.${domain}`);
        });
      } catch {
        return false;
      }
    },
  });

  // Load pre-bundled libraries from Docker volume mount
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const bundledLibraries = getBundledLibraries();
    if (bundledLibraries.length > 0) {
      excalidrawAPI
        .updateLibrary({
          libraryItems: bundledLibraries,
          merge: true,
          defaultStatus: "published",
        })
        .catch((error) => {
          console.error("AstraDraw: Failed to load bundled libraries:", error);
        });
    }
  }, [excalidrawAPI]);

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  // =========================================================================
  // Scene initialization and sync
  // =========================================================================

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }

    const decodeBase64ToBlob = (base64: string) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: "application/json" });
    };

    const loadImages = (
      data: ResolutionType<typeof initializeScene>,
      isInitialLoad = false,
    ) => {
      if (!data.scene) {
        return;
      }
      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromStorage({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          getStorageBackend().then((storageBackend) =>
            storageBackend
              .loadFilesFromStorageBackend(
                `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
                data.key,
                fileIds,
              )
              .then(({ loadedFiles, erroredFiles }) => {
                excalidrawAPI.addFiles(loadedFiles);
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              }),
          );
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          LocalData.fileStorage.clearObsoleteFiles({ currentFileIds: fileIds });
        }
      }
    };

    // Scene loading function for workspace URLs
    const loadSceneFromWorkspaceUrl = async (
      workspaceSlug: string,
      sceneId: string,
      options: {
        isInitialLoad?: boolean;
        roomKeyFromHash?: string | null;
      } = {},
    ) => {
      const { isInitialLoad = false, roomKeyFromHash = null } = options;

      if (!isInitialLoad && collabAPI?.isCollaborating()) {
        collabAPI.stopCollaboration(false);
      }

      try {
        const loaded = await loadWorkspaceScene(workspaceSlug, sceneId);

        setCurrentWorkspaceSlug(workspaceSlug);
        setCurrentSceneId(loaded.scene.id);
        setCurrentSceneTitle(loaded.scene.title || "Untitled");

        // Set the active collection from the scene's collection
        // This ensures the sidebar shows the correct collection on page refresh
        if (loaded.scene.collectionId) {
          setActiveCollectionId(loaded.scene.collectionId);
        }

        // Check if this is a collaboration scene
        const isCollabScene =
          collabAPI &&
          !isCollabDisabled &&
          loaded.access.canCollaborate &&
          loaded.roomId &&
          loaded.roomKey;

        if (isCollabScene) {
          // For collaboration scenes, data should be loaded from room storage
          // NOT from backend API. Room storage is the source of truth.
          const roomKey = roomKeyFromHash || loaded.roomKey!;

          const sceneData = await collabAPI.startCollaboration({
            roomId: loaded.roomId!,
            roomKey,
            isAutoCollab: true,
          });

          // Apply loaded scene data to canvas
          if (sceneData?.elements) {
            excalidrawAPI.updateScene({
              elements: sceneData.elements,
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
            if (sceneData.scrollToContent) {
              excalidrawAPI.scrollToContent();
            }
          }

          collabAPI.setSceneId(sceneId);
          setIsAutoCollabScene(true);

          if (isInitialLoad) {
            initialStatePromiseRef.current.promise.resolve(
              sceneData || { elements: [], appState: {}, files: {} },
            );
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
              },
            };

            excalidrawAPI.updateScene({
              elements: sceneWithCollaborators.elements || [],
              appState: sceneWithCollaborators.appState,
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });

            if (sceneWithCollaborators.files) {
              excalidrawAPI.addFiles(
                Object.values(sceneWithCollaborators.files),
              );
            }

            // Initialize autosave with loaded data
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
            initializeWithLoadedData(loadedSceneData);

            loadImages(
              {
                scene: sceneWithCollaborators as any,
                isExternalScene: false,
              } as any,
              isInitialLoad,
            );

            if (isInitialLoad) {
              initialStatePromiseRef.current.promise.resolve({
                elements: sceneWithCollaborators.elements || [],
                appState: sceneWithCollaborators.appState,
                files: sceneWithCollaborators.files || {},
              });
            }
          } else if (isInitialLoad) {
            initialStatePromiseRef.current.promise.resolve(null);
          }

          if (collabAPI) {
            collabAPI.setSceneId(null);
          }
          setIsAutoCollabScene(false);
        }

        navigateToCanvas();
      } catch (error) {
        console.error("Failed to load workspace scene:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load scene",
        );
        if (isInitialLoad) {
          initialStatePromiseRef.current.promise.resolve(null);
        }
      }
    };

    // Expose scene loader via ref
    loadSceneRef.current = loadSceneFromWorkspaceUrl;

    const handleWorkspaceUrl = async () => {
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      const sceneMatch = pathname.match(SCENE_URL_PATTERN);
      if (!sceneMatch) {
        return false;
      }

      const [, workspaceSlug, sceneId] = sceneMatch;
      const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
      const roomKeyFromHash = hashParams.get("key");

      await loadSceneFromWorkspaceUrl(workspaceSlug, sceneId, {
        isInitialLoad: true,
        roomKeyFromHash,
      });

      return true;
    };

    const initialize = async () => {
      const handledWorkspace = await handleWorkspaceUrl();
      if (handledWorkspace) {
        return;
      }

      initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
        loadImages(data, true);
        initialStatePromiseRef.current.promise.resolve(data.scene);
      });
    };

    initialize();

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const pathname = window.location.pathname;
      if (pathname.match(SCENE_URL_PATTERN)) {
        return;
      }
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              ...data.scene,
              ...restore(data.scene, null, null, { repairBindings: true }),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }

      // Skip localStorage sync when working on a workspace scene
      if (currentSceneIdRef.current) {
        return;
      }

      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onPageHide = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.PAGEHIDE, onPageHide, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.PAGEHIDE, onPageHide, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
    };
  }, [
    isCollabDisabled,
    collabAPI,
    excalidrawAPI,
    setLangCode,
    navigateToCanvas,
    setCurrentWorkspaceSlug,
    setCurrentSceneId,
    setCurrentSceneTitle,
    setIsAutoCollabScene,
    initializeWithLoadedData,
    loadSceneRef,
    currentSceneIdRef,
    setActiveCollectionId,
  ]);

  // =========================================================================
  // Before unload handler
  // =========================================================================

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      // Don't show "unsaved changes" warning during logout or when in dashboard mode
      // - During logout: we're intentionally clearing the canvas
      // - In dashboard mode: canvas is hidden, user isn't actively editing
      const currentIsLoggingOut = appJotaiStore.get(isLoggingOutAtom);
      if (currentIsLoggingOut || appMode === "dashboard") {
        return;
      }

      if (
        currentSceneId &&
        (saveStatus === "pending" || saveStatus === "saving")
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        }
      }

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI, currentSceneId, saveStatus, appMode]);

  // =========================================================================
  // onChange handler
  // =========================================================================

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    // Mark as having unsaved changes for auto-save
    // Skip during logout to prevent saving empty canvas data
    const isLoggingOut = appJotaiStore.get(isLoggingOutAtom);
    if (currentSceneId && !collabAPI?.isCollaborating() && !isLoggingOut) {
      const currentFiles = excalidrawAPI?.getFiles() || {};
      const currentData = JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: window.location.href,
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files: currentFiles,
      });
      markUnsaved(currentData);
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  // =========================================================================
  // Export and share handlers
  // =========================================================================

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);
  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // =========================================================================
  // Workspace handlers
  // =========================================================================

  const [isCreatingScene, setIsCreatingScene] = useState(false);

  const handleNewScene = useCallback(
    async (collectionId?: string) => {
      if (!excalidrawAPI) {
        return;
      }

      if (isCreatingScene) {
        return;
      }
      setIsCreatingScene(true);

      try {
        const title = `${t(
          "workspace.untitled",
        )} ${new Date().toLocaleTimeString()}`;

        const targetCollectionId =
          collectionId || privateCollectionId || undefined;

        const scene = await createScene({
          title,
          collectionId: targetCollectionId,
        });

        excalidrawAPI.resetScene();
        setCurrentSceneId(scene.id);
        setCurrentSceneTitle(title);

        if (targetCollectionId) {
          setActiveCollectionId(targetCollectionId);
        }

        openWorkspaceSidebar();

        // Switch to canvas mode directly (don't use navigateToCanvas which would
        // dispatch a popstate event and try to reload the scene we just created)
        setAppMode("canvas");

        const workspaceSlug = currentWorkspace?.slug || currentWorkspaceSlug;
        if (workspaceSlug) {
          const newUrl = buildSceneUrl(workspaceSlug, scene.id);
          window.history.pushState({ sceneId: scene.id }, "", newUrl);
        }

        const emptySceneData = {
          type: "excalidraw",
          version: 2,
          source: window.location.href,
          elements: [],
          appState: {
            viewBackgroundColor: "#ffffff",
          },
          files: {},
        };
        const blob = new Blob([JSON.stringify(emptySceneData)], {
          type: "application/json",
        });
        await updateSceneData(scene.id, blob);

        invalidateScenesCache();

        // Initialize collaboration for scenes in shared workspaces
        // The scene already has roomId/roomKey created by backend, we just need to join
        if (collabAPI && currentWorkspace?.type === "SHARED" && scene.roomId) {
          try {
            // Stop existing collaboration session first (if any)
            // This is necessary because startCollaboration() returns early if socket exists
            if (collabAPI.isCollaborating()) {
              // Pass empty elements since we're switching to a new empty scene
              await collabAPI.stopCollaboration(false, []);
            }

            // Get room credentials from backend
            const { roomId, roomKey } = await startCollaboration(scene.id);

            await collabAPI.startCollaboration({
              roomId,
              roomKey,
              isAutoCollab: true,
            });
            collabAPI.setSceneId(scene.id);
            setIsAutoCollabScene(true);
          } catch (collabError) {
            console.error(
              "Failed to start collaboration for new scene:",
              collabError,
            );
            // Scene is still created, just without collaboration
          }
        }

        excalidrawAPI.setToast({
          message: t("workspace.newSceneCreated") || "New scene created",
        });
        setIsCreatingScene(false);
      } catch (error) {
        console.error("Failed to create new scene:", error);
        excalidrawAPI.resetScene();
        setCurrentSceneId(null);
        setCurrentSceneTitle("Untitled");
        navigateToCanvas();
        setIsCreatingScene(false);
      }
    },
    [
      excalidrawAPI,
      collabAPI,
      privateCollectionId,
      navigateToCanvas,
      setActiveCollectionId,
      invalidateScenesCache,
      currentWorkspace?.slug,
      currentWorkspace?.type,
      currentWorkspaceSlug,
      setCurrentSceneId,
      setCurrentSceneTitle,
      setIsAutoCollabScene,
      openWorkspaceSidebar,
      isCreatingScene,
      setAppMode,
    ],
  );

  const handleUpdateWorkspace = useCallback(
    async (data: { name?: string }) => {
      if (!currentWorkspace) {
        throw new Error("No workspace selected");
      }

      const updated = await updateWorkspace(currentWorkspace.id, data);
      setCurrentWorkspace(updated as WorkspaceData);

      if (updated.slug !== currentWorkspace.slug) {
        setCurrentWorkspaceSlug(updated.slug);
      }
    },
    [currentWorkspace, setCurrentWorkspace, setCurrentWorkspaceSlug],
  );

  const handleUploadWorkspaceAvatar = useCallback(
    async (file: File) => {
      if (!currentWorkspace) {
        throw new Error("No workspace selected");
      }

      const updated = await uploadWorkspaceAvatar(currentWorkspace.id, file);
      setCurrentWorkspace(updated as WorkspaceData);
    },
    [currentWorkspace, setCurrentWorkspace],
  );

  const handleDeleteWorkspace = useCallback(async () => {
    if (!currentWorkspace) {
      throw new Error("No workspace selected");
    }

    await deleteWorkspace(currentWorkspace.id);

    // Invalidate and refetch workspaces list
    await queryClient.invalidateQueries({
      queryKey: queryKeys.workspaces.all,
    });

    // Get updated workspaces and switch to first remaining one
    const updatedWorkspaces = await listWorkspaces();

    if (updatedWorkspaces.length > 0) {
      setCurrentWorkspace(updatedWorkspaces[0] as WorkspaceData);
      setCurrentWorkspaceSlug(updatedWorkspaces[0].slug);
      // Navigate to dashboard of new workspace
      setDashboardView("home");
    } else {
      setCurrentWorkspace(null);
    }
  }, [
    currentWorkspace,
    queryClient,
    setCurrentWorkspace,
    setCurrentWorkspaceSlug,
    setDashboardView,
  ]);

  const handleSaveToWorkspace = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      const sceneData = {
        type: "excalidraw",
        version: 2,
        source: window.location.href,
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files: files || {},
      };

      const blob = new Blob([JSON.stringify(sceneData)], {
        type: "application/json",
      });

      if (currentSceneId) {
        await updateSceneData(currentSceneId, blob);
        excalidrawAPI.setToast({ message: `${t("workspace.saveScene")} ✓` });
      } else {
        const title =
          currentSceneTitle ||
          `${t("workspace.untitled")} ${new Date().toLocaleString()}`;

        const scene = await createScene({
          title,
          collectionId: privateCollectionId || undefined,
        });

        await updateSceneData(scene.id, blob);

        setCurrentSceneId(scene.id);
        setCurrentSceneTitle(title);
        excalidrawAPI.setToast({ message: `${t("workspace.saveScene")} ✓` });
      }
    } catch (error) {
      console.error("Failed to save scene:", error);
      setErrorMessage("Failed to save scene to workspace");
    }
  }, [
    excalidrawAPI,
    currentSceneId,
    currentSceneTitle,
    privateCollectionId,
    setCurrentSceneId,
    setCurrentSceneTitle,
  ]);

  const handleSceneTitleChange = useCallback(
    async (newTitle: string) => {
      if (!currentSceneId) {
        return;
      }

      const { updateScene: updateSceneApi } = await import(
        "./auth/workspaceApi"
      );
      await updateSceneApi(currentSceneId, { title: newTitle });
      setCurrentSceneTitle(newTitle);
      invalidateScenesCache();
    },
    [currentSceneId, setCurrentSceneTitle, invalidateScenesCache],
  );

  // =========================================================================
  // Invite handling
  // =========================================================================

  const handleInviteSuccess = useCallback(
    (workspace: Workspace) => {
      setCurrentWorkspace(workspace as WorkspaceData);
      setCurrentWorkspaceSlug(workspace.slug);
      setPendingInviteCode(null);
      navigateToDashboard();
    },
    [navigateToDashboard, setCurrentWorkspace, setCurrentWorkspaceSlug],
  );

  const handleInviteCancel = useCallback(() => {
    setPendingInviteCode(null);
    window.history.replaceState({}, document.title, "/");
  }, []);

  // =========================================================================
  // Render
  // =========================================================================

  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  if (pendingInviteCode) {
    return (
      <InviteAcceptPage
        inviteCode={pendingInviteCode}
        onSuccess={handleInviteSuccess}
        onCancel={handleInviteCancel}
      />
    );
  }

  const isWorkspaceAdmin = currentWorkspace?.role === "ADMIN";

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
        "workspace-sidebar-open": workspaceSidebarOpen,
        "theme--dark": editorTheme === THEME.DARK,
      })}
    >
      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: editorTheme === THEME.DARK ? "#232329" : "#fff",
            color: editorTheme === THEME.DARK ? "#e1e1e1" : "#1b1b1f",
          },
        }}
      />

      {/* Workspace Sidebar (Left) */}
      {!isLegacyMode && (
        <ErrorBoundary
          fallback={(props) => <SidebarErrorFallback {...props} />}
          onError={(error) => {
            console.error("[WorkspaceSidebar] Error:", error);
          }}
        >
          <WorkspaceSidebar
            onNewScene={handleNewScene}
            currentSceneId={currentSceneId}
            workspace={currentWorkspace}
            onWorkspaceChange={(workspace) => {
              setCurrentWorkspace(workspace as WorkspaceData);
              setCurrentWorkspaceSlug(workspace.slug);
            }}
            onCurrentSceneTitleChange={(newTitle) => {
              setCurrentSceneTitle(newTitle);
            }}
          />
        </ErrorBoundary>
      )}

      {/* Quick Search Modal */}
      {!isLegacyMode && isAuthenticated && <QuickSearchModal />}

      {/* Dashboard Content */}
      {!isLegacyMode && (
        <div
          className="excalidraw-app__main excalidraw-app__dashboard"
          style={{ display: appMode === "dashboard" ? "block" : "none" }}
          aria-hidden={appMode !== "dashboard"}
          inert={appMode !== "dashboard" ? true : undefined}
        >
          <ErrorBoundary
            fallback={(props) => (
              <ContentErrorFallback
                {...props}
                onGoHome={() => navigateToDashboard()}
              />
            )}
            onError={(error) => {
              console.error("[WorkspaceMainContent] Error:", error);
            }}
          >
            <WorkspaceMainContent
              isAdmin={isWorkspaceAdmin}
              onNewScene={handleNewScene}
              onUpdateWorkspace={handleUpdateWorkspace}
              onUploadWorkspaceAvatar={handleUploadWorkspaceAvatar}
              onDeleteWorkspace={handleDeleteWorkspace}
              theme={appTheme}
              setTheme={setAppTheme}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Canvas Content */}
      <div
        className="excalidraw-app__main excalidraw-app__canvas"
        style={{
          display: appMode === "canvas" || isLegacyMode ? "block" : "none",
        }}
        aria-hidden={appMode !== "canvas" && !isLegacyMode}
        inert={appMode !== "canvas" && !isLegacyMode ? true : undefined}
      >
        <Excalidraw
          excalidrawAPI={excalidrawRefCallback}
          onChange={onChange}
          initialData={initialStatePromiseRef.current.promise}
          isCollaborating={isCollaborating}
          onPointerUpdate={collabAPI?.onPointerUpdate}
          validateEmbeddable={true}
          UIOptions={{
            canvasActions: {
              toggleTheme: true,
              export: {
                saveFileToDisk: isAuthenticated,
                onExportToBackend,
                renderCustomUI: excalidrawAPI
                  ? (elements, appState, files) => {
                      return (
                        <ExportToExcalidrawPlus
                          elements={elements}
                          appState={appState}
                          files={files}
                          name={excalidrawAPI.getName()}
                          onError={(error) => {
                            excalidrawAPI?.updateScene({
                              appState: {
                                errorMessage: error.message,
                              },
                            });
                          }}
                          onSuccess={() => {
                            excalidrawAPI.updateScene({
                              appState: { openDialog: null },
                            });
                          }}
                        />
                      );
                    }
                  : undefined,
              },
            },
          }}
          langCode={langCode}
          renderCustomStats={renderCustomStats}
          detectScroll={false}
          handleKeyboardGlobally={appMode === "canvas"}
          autoFocus={appMode === "canvas"}
          theme={editorTheme}
          renderTopRightUI={(isMobile) => {
            // Hide save status for:
            // - Unauthenticated users
            // - No scene loaded
            // - Legacy mode (anonymous collaboration)
            // - Active collaboration session
            // - Auto-collab scenes (shared collection scenes that are always in collab mode)
            const showSaveStatus =
              isAuthenticated &&
              currentSceneId &&
              !isLegacyMode &&
              !isCollaborating &&
              !isAutoCollabScene;

            if (isMobile) {
              if (!showSaveStatus) {
                return null;
              }
              return (
                <div className="excalidraw-ui-top-right">
                  <SaveStatusIndicator
                    status={saveStatus}
                    lastSavedTime={lastSavedTime}
                    sceneTitle={currentSceneTitle}
                    onTitleChange={handleSceneTitleChange}
                    onRetry={handleSaveRetry}
                    isMobile={true}
                  />
                </div>
              );
            }

            return (
              <div className="excalidraw-ui-top-right">
                {showSaveStatus && (
                  <SaveStatusIndicator
                    status={saveStatus}
                    lastSavedTime={lastSavedTime}
                    sceneTitle={currentSceneTitle}
                    onTitleChange={handleSceneTitleChange}
                    onRetry={handleSaveRetry}
                    isMobile={false}
                  />
                )}
                {collabError.message && (
                  <CollabError collabError={collabError} />
                )}
                {collabAPI && !isCollabDisabled && (
                  <LiveCollaborationTrigger
                    isCollaborating={isCollaborating}
                    onSelect={() =>
                      setShareDialogState({ isOpen: true, type: "share" })
                    }
                    editorInterface={editorInterface}
                  />
                )}
              </div>
            );
          }}
          onLinkOpen={(element, event) => {
            if (element.link && isElementLink(element.link)) {
              event.preventDefault();
              excalidrawAPI?.scrollToContent(element.link, { animate: true });
            }
          }}
        >
          {!isLegacyMode && <WorkspaceSidebarTrigger />}
          <AppMainMenu
            onCollabDialogOpen={onCollabDialogOpen}
            isCollaborating={isCollaborating}
            isCollabEnabled={!isCollabDisabled}
            isAutoCollabScene={isAutoCollabScene}
            theme={appTheme}
            setTheme={(theme) => setAppTheme(theme)}
            refresh={() => forceRefresh((prev) => !prev)}
            onSaveToWorkspace={handleSaveToWorkspace}
          />
          <AppWelcomeScreen
            onCollabDialogOpen={onCollabDialogOpen}
            isCollabEnabled={!isCollabDisabled}
          />
          <OverwriteConfirmDialog>
            <OverwriteConfirmDialog.Actions.ExportToImage />
            <OverwriteConfirmDialog.Actions.SaveToDisk />
          </OverwriteConfirmDialog>
          <AppFooter
            onChange={() => excalidrawAPI?.refresh()}
            excalidrawAPI={excalidrawAPI}
          />
          {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

          <TTDDialogTrigger />
          {isCollaborating && isOffline && (
            <div className="alertalert--warning">
              {t("alerts.collabOfflineWarning")}
            </div>
          )}
          {localStorageQuotaExceeded && (
            <div className="alert alert--danger">
              {t("alerts.localStorageQuotaExceeded")}
            </div>
          )}
          {latestShareableLink && (
            <ShareableLinkDialog
              link={latestShareableLink}
              onCloseRequest={() => setLatestShareableLink(null)}
              setErrorMessage={setErrorMessage}
            />
          )}
          {excalidrawAPI && !isCollabDisabled && (
            <Collab excalidrawAPI={excalidrawAPI} />
          )}

          <ShareDialog
            collabAPI={collabAPI}
            onExportToBackend={async () => {
              if (excalidrawAPI) {
                try {
                  await onExportToBackend(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                  );
                } catch (error: any) {
                  setErrorMessage(error.message);
                }
              }
            }}
            workspaceSceneContext={
              currentSceneId && currentWorkspace?.slug
                ? {
                    sceneId: currentSceneId,
                    workspaceSlug: currentWorkspace.slug,
                    access: currentSceneAccess || undefined,
                    roomId: null,
                  }
                : undefined
            }
          />

          {/* Comment Sync Provider wraps all comment-related UI */}
          <CommentSyncProvider
            socket={collabSocket}
            roomId={collabRoomId}
            isCollaborating={isCollaborating}
          >
            {!isLegacyMode && (
              <AppSidebar
                excalidrawAPI={excalidrawAPI}
                sceneId={currentSceneId}
              />
            )}

            {excalidrawAPI && <PenToolbar excalidrawAPI={excalidrawAPI} />}
            {excalidrawAPI && (
              <PresentationMode excalidrawAPI={excalidrawAPI} />
            )}

            {/* Comment Thread Markers and Popup */}
            {currentSceneId && !isLegacyMode && (
              <>
                <ThreadMarkersLayer
                  sceneId={currentSceneId}
                  excalidrawAPI={excalidrawAPI}
                />
                <CommentCreationOverlay excalidrawAPI={excalidrawAPI} />
                <ThreadPopup
                  sceneId={currentSceneId}
                  workspaceId={currentWorkspace?.id}
                  excalidrawAPI={excalidrawAPI}
                />
                <NewThreadPopup
                  sceneId={currentSceneId}
                  workspaceId={currentWorkspace?.id}
                  excalidrawAPI={excalidrawAPI}
                />
              </>
            )}
          </CommentSyncProvider>

          {errorMessage && (
            <ErrorDialog onClose={() => setErrorMessage("")}>
              {errorMessage}
            </ErrorDialog>
          )}

          <CommandPalette
            customCommandPaletteItems={[
              {
                label: t("labels.liveCollaboration"),
                category: DEFAULT_CATEGORIES.app,
                keywords: [
                  "team",
                  "multiplayer",
                  "share",
                  "public",
                  "session",
                  "invite",
                ],
                icon: usersIcon,
                perform: () => {
                  setShareDialogState({
                    isOpen: true,
                    type: "collaborationOnly",
                  });
                },
              },
              {
                label: t("roomDialog.button_stopSession"),
                category: DEFAULT_CATEGORIES.app,
                predicate: () => !!collabAPI?.isCollaborating(),
                keywords: [
                  "stop",
                  "session",
                  "end",
                  "leave",
                  "close",
                  "exit",
                  "collaboration",
                ],
                perform: () => {
                  if (collabAPI) {
                    collabAPI.stopCollaboration();
                    if (!collabAPI.isCollaborating()) {
                      setShareDialogState({ isOpen: false });
                    }
                  }
                },
              },
              {
                label: t("labels.share"),
                category: DEFAULT_CATEGORIES.app,
                predicate: true,
                icon: share,
                keywords: [
                  "link",
                  "shareable",
                  "readonly",
                  "export",
                  "publish",
                  "snapshot",
                  "url",
                  "collaborate",
                  "invite",
                ],
                perform: async () => {
                  setShareDialogState({ isOpen: true, type: "share" });
                },
              },
              {
                label: "GitHub",
                icon: GithubIcon,
                category: DEFAULT_CATEGORIES.links,
                predicate: true,
                keywords: [
                  "issues",
                  "bugs",
                  "requests",
                  "report",
                  "features",
                  "social",
                  "community",
                ],
                perform: () => {
                  window.open(
                    ASTRADRAW_GITHUB_URL,
                    "_blank",
                    "noopener noreferrer",
                  );
                },
              },
              {
                ...CommandPalette.defaultItems.toggleTheme,
                perform: () => {
                  setAppTheme(
                    editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                  );
                },
              },
              {
                label: t("labels.installPWA"),
                category: DEFAULT_CATEGORIES.app,
                predicate: () => !!pwaEvent,
                perform: () => {
                  if (pwaEvent) {
                    pwaEvent.prompt();
                    pwaEvent.userChoice.then(() => {
                      pwaEvent = null;
                    });
                  }
                },
              },
            ]}
          />
          {isVisualDebuggerEnabled() && excalidrawAPI && (
            <DebugCanvas
              appState={excalidrawAPI.getAppState()}
              scale={window.devicePixelRatio}
              ref={debugCanvasRef}
            />
          )}
        </Excalidraw>
      </div>
    </div>
  );
};

const ExcalidrawApp = () => {
  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return <ExcalidrawPlusIframeExport />;
  }

  return (
    <TopErrorBoundary>
      <AuthProvider>
        <Provider store={appJotaiStore}>
          <ExcalidrawWrapper />
        </Provider>
      </AuthProvider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;

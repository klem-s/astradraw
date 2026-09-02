/**
 * useUrlRouting Hook
 *
 * Handles URL-based navigation for the app:
 * - Parses initial URL on mount
 * - Handles browser back/forward navigation (popstate)
 * - Coordinates with scene loader for scene URLs
 *
 * Note: This hook sets state directly without pushing URLs to prevent
 * infinite loops. Navigation atoms (navigateToDashboard, etc.) push URLs.
 */

import { useEffect, useRef } from "react";

import { parseUrl, type RouteType } from "../router";

export interface UseUrlRoutingOptions {
  /** Function to load a scene by workspace slug and scene ID */
  loadSceneFromUrl: (workspaceSlug: string, sceneId: string) => Promise<void>;
  /** Ref to current scene ID for comparison */
  currentSceneIdRef: React.MutableRefObject<string | null>;
  /** Set app mode (canvas/dashboard) */
  setAppMode: (mode: "canvas" | "dashboard") => void;
  /** Set active collection ID */
  setActiveCollectionId: (id: string | null) => void;
  /** Set current workspace slug in Jotai */
  setCurrentWorkspaceSlug: (slug: string | null) => void;
  /** Set dashboard view type */
  setDashboardView: (
    view:
      | "home"
      | "collection"
      | "workspace"
      | "members"
      | "teams-collections"
      | "notifications"
      | "profile"
      | "preferences",
  ) => void;
  /** Set whether viewing private collection */
  setIsPrivateCollection: (value: boolean) => void;
  /** Set selected comment thread (for deep links) */
  setSelectedThreadId?: (threadId: string | null) => void;
  /** Open the comments sidebar */
  openCommentsSidebar?: () => void;
}

/**
 * Hook that handles URL routing and browser navigation.
 * Sets up popstate listener and parses initial URL on mount.
 */
export function useUrlRouting({
  loadSceneFromUrl,
  currentSceneIdRef,
  setAppMode,
  setActiveCollectionId,
  setCurrentWorkspaceSlug,
  setDashboardView,
  setIsPrivateCollection,
  setSelectedThreadId,
  openCommentsSidebar,
}: UseUrlRoutingOptions): void {
  // Ref to hold route handler for use in popstate
  const handleUrlRouteRef = useRef<((route: RouteType) => void) | null>(null);

  useEffect(() => {
    // Define the route handler - this is called from popstate, so we should NOT
    // call navigation atoms that push URLs (that would cause infinite loop).
    // Instead, we directly set the state atoms.
    const handleUrlRoute = (route: RouteType) => {
      // Skip if in legacy mode (anonymous or legacy collab)
      if (route.type === "anonymous" || route.type === "legacy-collab") {
        return;
      }

      // Handle workspace routes - set state directly without pushing URLs
      switch (route.type) {
        case "dashboard":
          setCurrentWorkspaceSlug(route.workspaceSlug);
          setDashboardView("home");
          setAppMode("dashboard");
          break;

        case "collection":
          setCurrentWorkspaceSlug(route.workspaceSlug);
          setActiveCollectionId(route.collectionId);
          setIsPrivateCollection(false);
          setDashboardView("collection");
          setAppMode("dashboard");
          break;

        case "private":
          setCurrentWorkspaceSlug(route.workspaceSlug);
          setIsPrivateCollection(true);
          setDashboardView("collection");
          setAppMode("dashboard");
          break;

        case "settings":
          setCurrentWorkspaceSlug(route.workspaceSlug);
          setDashboardView("workspace");
          setAppMode("dashboard");
          break;

        case "members":
          setCurrentWorkspaceSlug(route.workspaceSlug);
          setDashboardView("members");
          setAppMode("dashboard");
          break;

        case "teams":
          setCurrentWorkspaceSlug(route.workspaceSlug);
          setDashboardView("teams-collections");
          setAppMode("dashboard");
          break;

        case "notifications":
          setCurrentWorkspaceSlug(route.workspaceSlug);
          setDashboardView("notifications");
          setAppMode("dashboard");
          break;

        case "profile":
          setDashboardView("profile");
          setAppMode("dashboard");
          break;

        case "preferences":
          setDashboardView("preferences");
          setAppMode("dashboard");
          break;

        case "scene":
          // Scene loading is handled separately by loadSceneFromUrl
          // This just ensures the app mode is correct
          setCurrentWorkspaceSlug(route.workspaceSlug);
          setAppMode("canvas");

          // Handle comment deep link (thread and comment params)
          if (route.threadId && setSelectedThreadId && openCommentsSidebar) {
            // Open comments sidebar and select the thread
            openCommentsSidebar();
            setSelectedThreadId(route.threadId);
            // TODO: If commentId is present, scroll to that specific comment
          }
          break;

        case "home":
          // Root URL - check if authenticated and redirect to dashboard or stay on canvas
          // This is handled by the main app logic
          break;

        default:
          break;
      }
    };

    handleUrlRouteRef.current = handleUrlRoute;

    // Handle popstate for browser back/forward navigation
    const handlePopState = async (_event: PopStateEvent) => {
      const route = parseUrl();

      // If navigating to a scene URL, we need to load the scene
      if (route.type === "scene") {
        // Check if this is a different scene than currently loaded
        if (currentSceneIdRef.current !== route.sceneId) {
          // First, switch to canvas mode so the UI updates immediately
          setAppMode("canvas");
          setCurrentWorkspaceSlug(route.workspaceSlug);

          // Load the scene
          await loadSceneFromUrl(route.workspaceSlug, route.sceneId);
        }

        // Handle comment deep link (thread and comment params)
        if (route.threadId && setSelectedThreadId && openCommentsSidebar) {
          openCommentsSidebar();
          setSelectedThreadId(route.threadId);
        }
      } else {
        handleUrlRoute(route);
      }
    };

    window.addEventListener("popstate", handlePopState);

    // Parse initial URL on mount and set the correct app state
    const initialRoute = parseUrl();
    if (
      initialRoute.type !== "anonymous" &&
      initialRoute.type !== "legacy-collab" &&
      initialRoute.type !== "home"
    ) {
      // For dashboard routes, set state immediately (scene loading is handled separately)
      if (initialRoute.type !== "scene") {
        handleUrlRoute(initialRoute);
      } else {
        // For scene routes, just set the workspace slug - scene loading happens in the initialization effect
        setCurrentWorkspaceSlug(initialRoute.workspaceSlug);
      }
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [
    loadSceneFromUrl,
    currentSceneIdRef,
    setAppMode,
    setActiveCollectionId,
    setCurrentWorkspaceSlug,
    setDashboardView,
    setIsPrivateCollection,
    setSelectedThreadId,
    openCommentsSidebar,
  ]);
}

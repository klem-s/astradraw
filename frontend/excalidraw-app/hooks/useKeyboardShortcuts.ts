/**
 * useKeyboardShortcuts Hook
 *
 * Manages global keyboard shortcuts for the app:
 * - Ctrl+S / Cmd+S: Save scene to workspace
 * - Cmd+P / Ctrl+P: Open quick search
 * - Cmd+[ / Ctrl+[: Toggle left sidebar (workspace)
 * - Cmd+] / Ctrl+]: Toggle right sidebar (library)
 * - C: Toggle comment mode (when authenticated and on a scene)
 */

import { useEffect } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export interface UseKeyboardShortcutsOptions {
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Current scene ID (null if no scene) */
  currentSceneId: string | null;
  /** Excalidraw API reference */
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  /** Callback to save scene */
  onSave: () => void;
  /** Callback to toggle workspace sidebar */
  toggleWorkspaceSidebar: () => void;
  /** Callback to open quick search */
  setQuickSearchOpen: (open: boolean) => void;
  /** Callback to toggle comment mode */
  toggleCommentMode?: () => void;
}

/**
 * Hook that sets up global keyboard shortcuts.
 * All shortcuts use capture phase to intercept before Excalidraw.
 */
export function useKeyboardShortcuts({
  isAuthenticated,
  currentSceneId,
  excalidrawAPI,
  onSave,
  toggleWorkspaceSidebar,
  setQuickSearchOpen,
  toggleCommentMode,
}: UseKeyboardShortcutsOptions): void {
  // Ctrl+S / Cmd+S: Save scene
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        // Only intercept if we have a workspace scene open
        if (currentSceneId && excalidrawAPI) {
          e.preventDefault();
          e.stopPropagation();
          onSave();
        }
      }
    };

    // Use capture phase to intercept before Excalidraw
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [currentSceneId, excalidrawAPI, onSave]);

  // Cmd+P / Ctrl+P: Quick Search
  useEffect(() => {
    if (!isAuthenticated) {
      return; // Don't register hotkey for unauthenticated users
    }

    const handleQuickSearchHotkey = (e: KeyboardEvent) => {
      // Cmd+P (Mac) or Ctrl+P (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault(); // Prevent browser print dialog
        e.stopPropagation();
        setQuickSearchOpen(true);
      }
    };

    // Use capture phase to intercept before other handlers
    window.addEventListener("keydown", handleQuickSearchHotkey, {
      capture: true,
    });
    return () => {
      window.removeEventListener("keydown", handleQuickSearchHotkey, {
        capture: true,
      });
    };
  }, [isAuthenticated, setQuickSearchOpen]);

  // Cmd+[ / Ctrl+[: Toggle left sidebar
  // Cmd+] / Ctrl+]: Toggle right sidebar
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const handleSidebarHotkeys = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd+[ (Mac) or Ctrl+[ (Windows/Linux) to toggle LEFT sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "[" && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleWorkspaceSidebar();
        return;
      }

      // Cmd+] (Mac) or Ctrl+] (Windows/Linux) to toggle RIGHT sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "]" && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();

        if (!excalidrawAPI) {
          return;
        }

        const appState = excalidrawAPI.getAppState();
        const sidebarIsOpen = appState.openSidebar?.name === "default";

        if (sidebarIsOpen) {
          // Sidebar is open - close it
          excalidrawAPI.updateScene({
            appState: { openSidebar: null },
          });
        } else {
          // Sidebar is closed - open to library tab
          excalidrawAPI.updateScene({
            appState: { openSidebar: { name: "default", tab: "library" } },
          });
        }
      }
    };

    window.addEventListener("keydown", handleSidebarHotkeys, {
      capture: true,
    });
    return () => {
      window.removeEventListener("keydown", handleSidebarHotkeys, {
        capture: true,
      });
    };
  }, [isAuthenticated, excalidrawAPI, toggleWorkspaceSidebar]);

  // C key: Toggle comment mode
  useEffect(() => {
    if (!isAuthenticated || !currentSceneId || !toggleCommentMode) {
      return;
    }

    const handleCommentHotkey = (e: KeyboardEvent) => {
      // Only trigger on 'c' key without modifiers
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
        return;
      }

      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      toggleCommentMode();
    };

    window.addEventListener("keydown", handleCommentHotkey, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleCommentHotkey, {
        capture: true,
      });
    };
  }, [isAuthenticated, currentSceneId, toggleCommentMode]);
}

/**
 * useAutoSave Hook
 *
 * Manages autosave state machine and effects for workspace scenes.
 * Handles debounced saves, retry logic, offline detection, and backup intervals.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { updateSceneData } from "../auth/workspaceApi";
import { maybeGenerateAndUploadThumbnail } from "../utils/thumbnailGenerator";

import type { SaveStatus } from "../components/SaveStatusIndicator";

// Autosave timing constants
const AUTOSAVE_DEBOUNCE_MS = 2000; // 2 seconds after last change
const AUTOSAVE_RETRY_DELAY_MS = 5000; // 5 seconds on error (single retry)
const BACKUP_SAVE_INTERVAL_MS = 30000; // 30 seconds safety net

export interface UseAutoSaveOptions {
  currentSceneId: string | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  isCollaborating: boolean;
  /** Flag to indicate logout is in progress - prevents saving empty canvas */
  isLoggingOut?: boolean;
}

export interface UseAutoSaveReturn {
  /** Current save status for UI display */
  saveStatus: SaveStatus;
  /** Last successful save timestamp */
  lastSavedTime: Date | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Perform save immediately (bypasses debounce) */
  saveImmediately: () => Promise<boolean>;
  /** Retry save after error */
  handleSaveRetry: () => Promise<void>;
  /** Mark scene as having unsaved changes (call from onChange) */
  markUnsaved: (currentDataJson: string) => void;
  /** Reset save state (call when scene changes) */
  resetSaveState: () => void;
  /** Initialize with loaded data (prevents false "unsaved" on load) */
  initializeWithLoadedData: (dataJson: string) => void;
}

export function useAutoSave({
  currentSceneId,
  excalidrawAPI,
  isCollaborating,
  isLoggingOut = false,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  // Save status state machine
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Refs for timers and state tracking
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const retryCountRef = useRef<number>(0);
  const lastSavedDataRef = useRef<string | null>(null);

  // Refs to access current values in intervals without adding to dependencies
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;

  // Core save function
  const performSave = useCallback(async (): Promise<boolean> => {
    // Skip save during logout to prevent saving empty canvas
    if (!currentSceneId || !excalidrawAPI || isLoggingOut) {
      return false;
    }

    // Check if offline
    if (!navigator.onLine) {
      setSaveStatus("offline");
      return false;
    }

    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      // Create scene data for comparison
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

      const dataString = JSON.stringify(sceneData);

      // Skip if data hasn't changed
      if (lastSavedDataRef.current === dataString) {
        setHasUnsavedChanges(false);
        setSaveStatus("saved");
        return true;
      }

      setSaveStatus("saving");

      const blob = new Blob([dataString], {
        type: "application/json",
      });

      await updateSceneData(currentSceneId, blob);
      lastSavedDataRef.current = dataString;
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
      setLastSavedTime(new Date());
      retryCountRef.current = 0; // Reset retry count on success

      // Fire-and-forget thumbnail generation
      // This is best-effort and won't affect save status
      maybeGenerateAndUploadThumbnail(
        currentSceneId,
        elements,
        appState,
        files,
      );

      return true;
    } catch (error) {
      console.error("Auto-save failed:", error);
      setSaveStatus("error");
      return false;
    }
  }, [currentSceneId, excalidrawAPI, isLoggingOut]);

  // Immediate save function - bypasses debounce, used before navigation
  const saveImmediately = useCallback(async (): Promise<boolean> => {
    // Clear any pending debounced save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    return performSave();
  }, [performSave]);

  // Manual retry function - called when user clicks on error status
  const handleSaveRetry = useCallback(async () => {
    retryCountRef.current = 0; // Reset retry count for manual retry
    await performSave();
  }, [performSave]);

  // Mark scene as having unsaved changes
  const markUnsaved = useCallback((currentDataJson: string) => {
    // Only set unsaved if data actually changed from last save
    if (lastSavedDataRef.current !== currentDataJson) {
      setHasUnsavedChanges(true);
    }
  }, []);

  // Reset save state (call when scene changes)
  const resetSaveState = useCallback(() => {
    lastSavedDataRef.current = null;
    setHasUnsavedChanges(false);
    setSaveStatus("saved");
    retryCountRef.current = 0;
    // Clear any pending timeouts
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Initialize with loaded data (prevents false "unsaved" on load)
  const initializeWithLoadedData = useCallback((dataJson: string) => {
    lastSavedDataRef.current = dataJson;
    setHasUnsavedChanges(false);
    setSaveStatus("saved");
  }, []);

  // Auto-save effect - triggers after debounce period
  useEffect(() => {
    // Skip autosave during collaboration (collab has its own save mechanism)
    if (
      !hasUnsavedChanges ||
      !currentSceneId ||
      !excalidrawAPI ||
      isCollaborating
    ) {
      return;
    }

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set pending status when changes are detected (only if currently saved)
    setSaveStatus((current) => (current === "saved" ? "pending" : current));

    // Schedule auto-save after debounce period
    autoSaveTimeoutRef.current = setTimeout(async () => {
      const success = await performSave();

      // If save failed and we haven't retried yet, schedule a retry
      if (!success && retryCountRef.current < 1) {
        retryCountRef.current++;
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        retryTimeoutRef.current = setTimeout(() => {
          performSave();
        }, AUTOSAVE_RETRY_DELAY_MS);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [
    hasUnsavedChanges,
    currentSceneId,
    excalidrawAPI,
    isCollaborating,
    performSave,
  ]);

  // Backup save interval - safety net every 30 seconds
  useEffect(() => {
    if (!currentSceneId || !excalidrawAPI || isCollaborating) {
      return;
    }

    backupSaveIntervalRef.current = setInterval(() => {
      if (hasUnsavedChangesRef.current && saveStatusRef.current !== "saving") {
        performSave();
      }
    }, BACKUP_SAVE_INTERVAL_MS);

    return () => {
      if (backupSaveIntervalRef.current) {
        clearInterval(backupSaveIntervalRef.current);
      }
    };
  }, [currentSceneId, excalidrawAPI, isCollaborating, performSave]);

  // Offline detection - update save status based on network state
  useEffect(() => {
    const handleOnline = () => {
      // If we were offline with pending changes, trigger save
      if (saveStatusRef.current === "offline" && hasUnsavedChangesRef.current) {
        performSave();
      }
    };

    const handleOffline = () => {
      setSaveStatus((current) => {
        if (current === "pending" || current === "saving") {
          return "offline";
        }
        return current;
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [performSave]);

  // Reset save state when scene changes
  useEffect(() => {
    resetSaveState();
  }, [currentSceneId, resetSaveState]);

  return {
    saveStatus,
    lastSavedTime,
    hasUnsavedChanges,
    saveImmediately,
    handleSaveRetry,
    markUnsaved,
    resetSaveState,
    initializeWithLoadedData,
  };
}

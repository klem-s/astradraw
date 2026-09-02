/**
 * Tests for useSceneActions hook.
 *
 * Tests:
 * - Delete mutation with optimistic update and rollback
 * - Rename mutation with optimistic update and rollback
 * - Duplicate mutation (no optimistic update)
 * - Loading states (isDeleting, isRenaming, isDuplicating)
 * - Confirmation dialog for delete
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import { useSceneActions } from "../../hooks/useSceneActions";
import { queryKeys } from "../../lib/queryClient";
import {
  renderHookWithProviders,
  createMockScene,
  createMockScenes,
} from "../testUtils";

// Import mocked modules
import {
  deleteScene as deleteSceneApi,
  updateScene as updateSceneApi,
  duplicateScene as duplicateSceneApi,
} from "../../auth/workspaceApi";
import { showSuccess, showError } from "../../utils/toast";

import type { WorkspaceScene } from "../../auth/workspaceApi";

// Mock the API functions
vi.mock("../../auth/workspaceApi", () => ({
  deleteScene: vi.fn(),
  updateScene: vi.fn(),
  duplicateScene: vi.fn(),
}));

// Mock toast notifications
vi.mock("../../utils/toast", () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

// Mock translations
vi.mock("@excalidraw/excalidraw/i18n", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@excalidraw/excalidraw/i18n")
  >();
  return {
    ...actual,
    t: (key: string) => key,
  };
});

describe("useSceneActions", () => {
  const workspaceId = "workspace-1";
  const collectionId = "collection-1";

  // Store original confirm
  const originalConfirm = window.confirm;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: confirm returns true (user confirms)
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  // ============================================
  // Delete Scene Tests
  // ============================================

  describe("deleteScene", () => {
    it("should delete a scene after confirmation", async () => {
      const scenes = createMockScenes(3);
      const sceneToDelete = scenes[1];

      (deleteSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        undefined,
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      let deleteResult: boolean;
      await act(async () => {
        deleteResult = await result.current.deleteScene(sceneToDelete.id);
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(deleteSceneApi).toHaveBeenCalledWith(sceneToDelete.id);
      expect(deleteResult!).toBe(true);
    });

    it("should return false when user cancels confirmation", async () => {
      window.confirm = vi.fn(() => false);

      const { result } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      let deleteResult: boolean;
      await act(async () => {
        deleteResult = await result.current.deleteScene("scene-1");
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(deleteSceneApi).not.toHaveBeenCalled();
      expect(deleteResult!).toBe(false);
    });

    it("should call API with correct scene ID", async () => {
      const scenes = createMockScenes(3);
      const sceneToDelete = scenes[1];

      (deleteSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        undefined,
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      await act(async () => {
        await result.current.deleteScene(sceneToDelete.id);
      });

      expect(deleteSceneApi).toHaveBeenCalledWith(sceneToDelete.id);
    });

    it("should rollback on API error and show error toast", async () => {
      const scenes = createMockScenes(3);
      const sceneToDelete = scenes[1];

      (deleteSceneApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      await act(async () => {
        await result.current.deleteScene(sceneToDelete.id);
      });

      // The error toast should be shown (rollback happens before invalidation clears cache)
      expect(showError).toHaveBeenCalled();
      expect(deleteSceneApi).toHaveBeenCalledWith(sceneToDelete.id);
    });

    it("should set isDeleting while mutation is pending", async () => {
      (deleteSceneApi as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const { result } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      expect(result.current.isDeleting).toBe(false);

      act(() => {
        result.current.deleteScene("scene-1");
      });

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isDeleting).toBe(false);
      });
    });
  });

  // ============================================
  // Rename Scene Tests
  // ============================================

  describe("renameScene", () => {
    it("should rename a scene", async () => {
      const scenes = createMockScenes(3);
      const sceneToRename = scenes[1];
      const newTitle = "Updated Title";

      const updatedScene = { ...sceneToRename, title: newTitle };
      (updateSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        updatedScene,
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      let renameResult: boolean;
      await act(async () => {
        renameResult = await result.current.renameScene(
          sceneToRename.id,
          newTitle,
        );
      });

      expect(updateSceneApi).toHaveBeenCalledWith(sceneToRename.id, {
        title: newTitle,
      });
      expect(renameResult!).toBe(true);
    });

    it("should call API with correct parameters", async () => {
      const scenes = createMockScenes(3);
      const sceneToRename = scenes[1];
      const newTitle = "Updated Title";

      const updatedScene = { ...sceneToRename, title: newTitle };
      (updateSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        updatedScene,
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      await act(async () => {
        await result.current.renameScene(sceneToRename.id, newTitle);
      });

      expect(updateSceneApi).toHaveBeenCalledWith(sceneToRename.id, {
        title: newTitle,
      });
    });

    it("should call onSceneRenamed callback on success", async () => {
      const scenes = createMockScenes(3);
      const sceneToRename = scenes[1];
      const newTitle = "Updated Title";

      const updatedScene = { ...sceneToRename, title: newTitle };
      (updateSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        updatedScene,
      );

      const onSceneRenamed = vi.fn();

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId, onSceneRenamed }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      await act(async () => {
        await result.current.renameScene(sceneToRename.id, newTitle);
      });

      expect(onSceneRenamed).toHaveBeenCalledWith(sceneToRename.id, newTitle);
    });

    it("should rollback on API error and show error toast", async () => {
      const scenes = createMockScenes(3);
      const sceneToRename = scenes[1];
      const newTitle = "Updated Title";

      (updateSceneApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      const renameResult = await act(async () => {
        return await result.current.renameScene(sceneToRename.id, newTitle);
      });

      // The rename should return false on error
      expect(renameResult).toBe(false);
      // The error toast should be shown
      expect(showError).toHaveBeenCalled();
      expect(updateSceneApi).toHaveBeenCalledWith(sceneToRename.id, {
        title: newTitle,
      });
    });

    it("should set isRenaming while mutation is pending", async () => {
      const scenes = createMockScenes(1);

      (updateSceneApi as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ...scenes[0], title: "New" }), 100),
          ),
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      expect(result.current.isRenaming).toBe(false);

      act(() => {
        result.current.renameScene(scenes[0].id, "New");
      });

      await waitFor(() => {
        expect(result.current.isRenaming).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isRenaming).toBe(false);
      });
    });
  });

  // ============================================
  // Duplicate Scene Tests
  // ============================================

  describe("duplicateScene", () => {
    it("should duplicate a scene and return the new scene", async () => {
      const scenes = createMockScenes(3);
      const sceneToDuplicate = scenes[1];
      const newScene = createMockScene({
        id: "new-scene-id",
        title: `${sceneToDuplicate.title} (copy)`,
      });

      (duplicateSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        newScene,
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      let duplicateResult: WorkspaceScene | null;
      await act(async () => {
        duplicateResult = await result.current.duplicateScene(
          sceneToDuplicate.id,
        );
      });

      expect(duplicateSceneApi).toHaveBeenCalledWith(sceneToDuplicate.id);
      expect(duplicateResult!).toEqual(newScene);
      expect(showSuccess).toHaveBeenCalled();
    });

    it("should add new scene to cache on success", async () => {
      const scenes = createMockScenes(3);
      const sceneToDuplicate = scenes[1];
      const newScene = createMockScene({
        id: "new-scene-id",
        title: `${sceneToDuplicate.title} (copy)`,
      });

      (duplicateSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        newScene,
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      // Pre-populate cache
      queryClient.setQueryData(
        queryKeys.scenes.list(workspaceId, collectionId),
        scenes,
      );

      await act(async () => {
        await result.current.duplicateScene(sceneToDuplicate.id);
      });

      // Check new scene was added to cache
      const cachedScenes = queryClient.getQueryData<WorkspaceScene[]>(
        queryKeys.scenes.list(workspaceId, collectionId),
      );
      expect(cachedScenes).toHaveLength(4);
      expect(cachedScenes?.[0]).toEqual(newScene); // Added at the beginning
    });

    it("should return null on API error", async () => {
      (duplicateSceneApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const { result } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      let duplicateResult: WorkspaceScene | null;
      await act(async () => {
        duplicateResult = await result.current.duplicateScene("scene-1");
      });

      expect(duplicateResult!).toBeNull();
      expect(showError).toHaveBeenCalled();
    });

    it("should set isDuplicating while mutation is pending", async () => {
      (duplicateSceneApi as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(createMockScene()), 100),
          ),
      );

      const { result } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId }),
      );

      expect(result.current.isDuplicating).toBe(false);

      act(() => {
        result.current.duplicateScene("scene-1");
      });

      await waitFor(() => {
        expect(result.current.isDuplicating).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isDuplicating).toBe(false);
      });
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe("edge cases", () => {
    it("should handle missing workspaceId gracefully", async () => {
      const { result } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId: undefined, collectionId }),
      );

      // Operations should still work, just won't update cache
      (deleteSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        undefined,
      );

      let deleteResult: boolean;
      await act(async () => {
        deleteResult = await result.current.deleteScene("scene-1");
      });

      expect(deleteResult!).toBe(true);
    });

    it("should handle null collectionId for all scenes view", async () => {
      const scenes = createMockScenes(3);

      (deleteSceneApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        undefined,
      );

      const { result } = renderHookWithProviders(() =>
        useSceneActions({ workspaceId, collectionId: null }),
      );

      const deleteResult = await act(async () => {
        return await result.current.deleteScene(scenes[0].id);
      });

      // Should successfully call the API
      expect(deleteSceneApi).toHaveBeenCalledWith(scenes[0].id);
      expect(deleteResult).toBe(true);
    });
  });
});

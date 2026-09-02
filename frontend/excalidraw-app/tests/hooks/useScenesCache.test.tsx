/**
 * Tests for useScenesCache hook.
 *
 * Tests:
 * - Initial loading state
 * - Successful data fetch
 * - updateScenes for optimistic updates
 * - refetch functionality
 * - Disabled state when workspaceId is undefined
 * - Cache invalidation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

import {
  useScenesCache,
  useInvalidateScenesCache,
} from "../../hooks/useScenesCache";
import { queryKeys } from "../../lib/queryClient";
import { renderHookWithProviders, createMockScenes } from "../testUtils";

import { listWorkspaceScenes } from "../../auth/workspaceApi";

import type { WorkspaceScene } from "../../auth/workspaceApi";

// Mock the API function
vi.mock("../../auth/workspaceApi", () => ({
  listWorkspaceScenes: vi.fn(),
}));

describe("useScenesCache", () => {
  const workspaceId = "workspace-1";
  const collectionId = "collection-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Basic Fetching Tests
  // ============================================

  describe("fetching", () => {
    it("should return loading state initially", async () => {
      const mockScenes = createMockScenes(3);

      // Delay the response
      (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve(mockScenes), 100)),
      );

      const { result } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId }),
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.scenes).toEqual([]);

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should fetch scenes successfully", async () => {
      const mockScenes = createMockScenes(3);

      (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockScenes,
      );

      const { result } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.scenes).toEqual(mockScenes);
      expect(result.current.error).toBeNull();
      expect(listWorkspaceScenes).toHaveBeenCalledWith(
        workspaceId,
        collectionId,
      );
    });

    it("should pass undefined for collectionId when not provided", async () => {
      const mockScenes = createMockScenes(3);

      (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockScenes,
      );

      const { result } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(listWorkspaceScenes).toHaveBeenCalledWith(workspaceId, undefined);
    });

    it("should handle API errors", async () => {
      const error = new Error("Network error");

      (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        error,
      );

      const { result } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.scenes).toEqual([]);
    });
  });

  // ============================================
  // Disabled State Tests
  // ============================================

  describe("disabled state", () => {
    it("should not fetch when workspaceId is undefined", async () => {
      const { result } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId: undefined, collectionId }),
      );

      // Should not be loading and should have empty scenes
      expect(result.current.isLoading).toBe(false);
      expect(result.current.scenes).toEqual([]);
      expect(listWorkspaceScenes).not.toHaveBeenCalled();
    });

    it("should not fetch when enabled is false", async () => {
      const { result } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId, enabled: false }),
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.scenes).toEqual([]);
      expect(listWorkspaceScenes).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // updateScenes Tests
  // ============================================

  describe("updateScenes", () => {
    it("should update scenes in cache", async () => {
      const mockScenes = createMockScenes(3);

      (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockScenes,
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update scenes by removing first scene
      act(() => {
        result.current.updateScenes((prev) => prev.slice(1));
      });

      // Check the cache was updated
      const cachedScenes = queryClient.getQueryData<WorkspaceScene[]>(
        queryKeys.scenes.list(workspaceId, collectionId),
      );
      expect(cachedScenes).toHaveLength(2);
    });

    it("should not update when workspaceId is undefined", async () => {
      const { result, queryClient } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId: undefined, collectionId }),
      );

      // Try to update scenes (should be a no-op)
      act(() => {
        result.current.updateScenes((prev) => [
          ...prev,
          createMockScenes(1)[0],
        ]);
      });

      // Cache should remain empty
      const cachedScenes = queryClient.getQueryData<WorkspaceScene[]>(
        queryKeys.scenes.list("undefined", collectionId),
      );
      expect(cachedScenes).toBeUndefined();
    });
  });

  // ============================================
  // Refetch Tests
  // ============================================

  describe("refetch", () => {
    it("should refetch scenes", async () => {
      const initialScenes = createMockScenes(2);
      const updatedScenes = createMockScenes(3);

      (listWorkspaceScenes as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(initialScenes)
        .mockResolvedValueOnce(updatedScenes);

      const { result } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId }),
      );

      await waitFor(() => {
        expect(result.current.scenes).toHaveLength(2);
      });

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.scenes).toHaveLength(3);
      });

      expect(listWorkspaceScenes).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // Cache Key Tests
  // ============================================

  describe("cache keys", () => {
    it("should use different cache keys for different collections", async () => {
      const collection1Scenes = createMockScenes(2, {
        collectionId: "collection-1",
      });
      const collection2Scenes = createMockScenes(3, {
        collectionId: "collection-2",
      });

      (listWorkspaceScenes as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(collection1Scenes)
        .mockResolvedValueOnce(collection2Scenes);

      const { result: result1 } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId: "collection-1" }),
      );

      const { result: result2 } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId: "collection-2" }),
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      expect(result1.current.scenes).toHaveLength(2);
      expect(result2.current.scenes).toHaveLength(3);
    });

    it("should use 'all' key when collectionId is null", async () => {
      const mockScenes = createMockScenes(3);

      (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockScenes,
      );

      const { result, queryClient } = renderHookWithProviders(() =>
        useScenesCache({ workspaceId, collectionId: null }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check the cache key used
      const cachedScenes = queryClient.getQueryData<WorkspaceScene[]>(
        queryKeys.scenes.list(workspaceId, null),
      );
      expect(cachedScenes).toEqual(mockScenes);
    });
  });
});

// ============================================
// useInvalidateScenesCache Tests
// ============================================

describe("useInvalidateScenesCache", () => {
  const workspaceId = "workspace-1";
  const collectionId = "collection-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should invalidate specific collection cache", async () => {
    const mockScenes = createMockScenes(3);

    (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockScenes,
    );

    const { result: cacheResult, queryClient } = renderHookWithProviders(() =>
      useScenesCache({ workspaceId, collectionId }),
    );

    await waitFor(() => {
      expect(cacheResult.current.isLoading).toBe(false);
    });

    // Get the invalidate function
    const { result: invalidateResult } = renderHookWithProviders(
      () => useInvalidateScenesCache(),
      { queryClient },
    );

    // Invalidate specific collection
    act(() => {
      invalidateResult.current(workspaceId, collectionId);
    });

    // The query should be marked as stale (will refetch)
    const queryState = queryClient.getQueryState(
      queryKeys.scenes.list(workspaceId, collectionId),
    );
    expect(queryState?.isInvalidated).toBe(true);
  });

  it("should invalidate all workspace scenes when no collectionId", async () => {
    const mockScenes = createMockScenes(3);

    (listWorkspaceScenes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockScenes,
    );

    const { result: cacheResult, queryClient } = renderHookWithProviders(() =>
      useScenesCache({ workspaceId, collectionId }),
    );

    await waitFor(() => {
      expect(cacheResult.current.isLoading).toBe(false);
    });

    // Get the invalidate function
    const { result: invalidateResult } = renderHookWithProviders(
      () => useInvalidateScenesCache(),
      { queryClient },
    );

    // Invalidate all scenes for workspace
    act(() => {
      invalidateResult.current(workspaceId);
    });

    // The query should be marked as stale
    const queryState = queryClient.getQueryState(
      queryKeys.scenes.list(workspaceId, collectionId),
    );
    expect(queryState?.isInvalidated).toBe(true);
  });
});

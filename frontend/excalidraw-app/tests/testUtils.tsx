/**
 * Test utilities for AstraDraw custom components and hooks.
 *
 * Provides:
 * - React Query test setup with fresh QueryClient per test
 * - Provider wrapper for hooks testing
 * - renderExcalidrawApp for full app tests
 * - Mock API helpers
 */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { render as rtlRender } from "@excalidraw/excalidraw/tests/test-utils";

import ExcalidrawApp from "../App";

import type {
  RenderHookOptions,
  RenderHookResult,
} from "@testing-library/react";
import type { WorkspaceScene } from "../auth/workspaceApi";

/**
 * Create a fresh QueryClient for testing.
 *
 * Configuration:
 * - retry: false - Don't retry failed requests in tests
 * - gcTime: 0 - Garbage collect immediately for test isolation
 * - staleTime: 0 - Always consider data stale
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Props for TestWrapper component
 */
interface TestWrapperProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

/**
 * Provider wrapper for testing hooks that use React Query.
 *
 * @example
 * ```tsx
 * const queryClient = createTestQueryClient();
 * const { result } = renderHook(() => useSomeHook(), {
 *   wrapper: ({ children }) => (
 *     <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
 *   ),
 * });
 * ```
 */
export function TestWrapper({
  children,
  queryClient,
}: TestWrapperProps): React.ReactElement {
  const client = queryClient ?? createTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * Render a hook with React Query provider.
 *
 * @example
 * ```tsx
 * const { result, queryClient } = renderHookWithProviders(() =>
 *   useScenesCache({ workspaceId: "ws-1" })
 * );
 * ```
 */
export function renderHookWithProviders<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, "wrapper"> & {
    queryClient?: QueryClient;
  },
): RenderHookResult<TResult, TProps> & { queryClient: QueryClient } {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
  );

  const result = renderHook(hook, {
    ...options,
    wrapper,
  });

  return { ...result, queryClient };
}

// ============================================
// Mock Data Factories
// ============================================

/**
 * Create a mock WorkspaceScene for testing.
 */
export function createMockScene(
  overrides: Partial<WorkspaceScene> = {},
): WorkspaceScene {
  const id = overrides.id ?? `scene-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    title: `Test Scene ${id}`,
    thumbnailUrl: null,
    storageKey: `storage-${id}`,
    roomId: null,
    collectionId: null,
    isPublic: false,
    lastOpenedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create multiple mock scenes for testing.
 */
export function createMockScenes(
  count: number,
  overrides: Partial<WorkspaceScene> = {},
): WorkspaceScene[] {
  return Array.from({ length: count }, (_, i) =>
    createMockScene({
      id: `scene-${i + 1}`,
      title: `Scene ${i + 1}`,
      ...overrides,
    }),
  );
}

// ============================================
// Mock API Helpers
// ============================================

/**
 * Create a mock fetch response.
 */
export function createMockResponse<T>(
  data: T,
  options: { status?: number; ok?: boolean } = {},
): Response {
  const { status = 200, ok = true } = options;
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response;
}

/**
 * Create a mock error response.
 */
export function createMockErrorResponse(
  status: number,
  message?: string,
): Response {
  return {
    ok: false,
    status,
    json: async () => ({ message: message ?? `Error ${status}` }),
    text: async () => JSON.stringify({ message: message ?? `Error ${status}` }),
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response;
}

/**
 * Mock global fetch for testing.
 *
 * @example
 * ```ts
 * const mockFetch = mockGlobalFetch();
 * mockFetch.mockResolvedValueOnce(createMockResponse({ id: "1" }));
 *
 * // ... run test ...
 *
 * restoreGlobalFetch(mockFetch);
 * ```
 */
export function mockGlobalFetch(): ReturnType<typeof vi.fn> {
  const mockFn = vi.fn();
  (global as any).fetch = mockFn;
  return mockFn;
}

/**
 * Restore original fetch after mocking.
 */
export function restoreGlobalFetch(_mockFn: ReturnType<typeof vi.fn>): void {
  // In vitest with jsdom, fetch is automatically restored between tests
  // This is a no-op but kept for explicit cleanup in tests
}

// ============================================
// Wait Utilities
// ============================================

/**
 * Wait for a condition to be true.
 * Useful for waiting on async state updates.
 */
export async function waitForCondition(
  condition: () => boolean,
  { timeout = 1000, interval = 50 } = {},
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// ============================================
// Full App Rendering
// ============================================

/**
 * Render ExcalidrawApp with all required providers for testing.
 *
 * This wraps ExcalidrawApp with QueryClientProvider which is required
 * since the app uses React Query for data fetching.
 *
 * @example
 * ```tsx
 * describe("Test Feature", () => {
 *   beforeEach(async () => {
 *     await renderExcalidrawApp();
 *   });
 *
 *   it("should do something", () => {
 *     // test code
 *   });
 * });
 * ```
 */
export async function renderExcalidrawApp() {
  const queryClient = createTestQueryClient();

  const result = await rtlRender(
    <QueryClientProvider client={queryClient}>
      <ExcalidrawApp />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

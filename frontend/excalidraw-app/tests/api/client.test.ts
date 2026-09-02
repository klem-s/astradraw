/**
 * Tests for the base API client.
 *
 * Tests:
 * - ApiError class construction
 * - apiRequest success and error handling
 * - apiRequestRaw for binary data
 * - Helper functions (jsonBody, binaryBody)
 * - getApiBaseUrl environment fallbacks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  ApiError,
  apiRequest,
  apiRequestRaw,
  jsonBody,
  binaryBody,
  getApiBaseUrl,
} from "../../auth/api/client";

describe("API Client", () => {
  // Store original fetch and window properties
  const originalFetch = global.fetch;
  let originalWindowEnv: Record<string, string> | undefined;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();

    // Store original window env values
    originalWindowEnv = (
      window as unknown as { __ENV__?: Record<string, string> }
    ).__ENV__;

    // Clear environment variables
    (window as unknown as { __ENV__?: Record<string, string> }).__ENV__ =
      undefined;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Restore environment
    (window as unknown as { __ENV__?: Record<string, string> }).__ENV__ =
      originalWindowEnv;
  });

  // ============================================
  // ApiError Tests
  // ============================================

  describe("ApiError", () => {
    it("should create an error with status and message", () => {
      const error = new ApiError(404, "Not found");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
      expect(error.message).toBe("Not found");
      expect(error.name).toBe("ApiError");
    });

    it("should preserve stack trace", () => {
      const error = new ApiError(500, "Server error");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ApiError");
    });
  });

  // ============================================
  // getApiBaseUrl Tests
  // ============================================

  describe("getApiBaseUrl", () => {
    it("should use window.__ENV__ if available", () => {
      (window as unknown as { __ENV__?: Record<string, string> }).__ENV__ = {
        VITE_APP_HTTP_STORAGE_BACKEND_URL: "https://api.example.com",
      };

      expect(getApiBaseUrl()).toBe("https://api.example.com");
    });

    it("should fallback to window.location.origin when no env is set", () => {
      // Both __ENV__ and import.meta.env are undefined/empty
      (window as unknown as { __ENV__?: Record<string, string> }).__ENV__ =
        undefined;

      // In jsdom, window.location.origin is typically "http://localhost"
      const expected = `${window.location.origin}/api/v2`;
      expect(getApiBaseUrl()).toBe(expected);
    });
  });

  // ============================================
  // apiRequest Tests
  // ============================================

  describe("apiRequest", () => {
    it("should make a successful GET request", async () => {
      const mockData = { id: "123", name: "Test" };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await apiRequest<typeof mockData>("/test");

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test"),
        expect.objectContaining({
          credentials: "include",
        }),
      );
    });

    it("should include credentials by default", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await apiRequest("/test");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: "include",
        }),
      );
    });

    it("should pass through additional fetch options", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await apiRequest("/test", {
        method: "POST",
        headers: { "X-Custom": "header" },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          headers: { "X-Custom": "header" },
          credentials: "include",
        }),
      );
    });

    it("should throw ApiError on 401 response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      await expect(apiRequest("/test")).rejects.toThrow(ApiError);

      // Test the error details with a fresh mock
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      await expect(apiRequest("/test")).rejects.toMatchObject({
        status: 401,
        message: "Not authenticated",
      });
    });

    it("should throw ApiError on 403 response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({}),
      });

      await expect(apiRequest("/test")).rejects.toMatchObject({
        status: 403,
        message: "Access denied",
      });
    });

    it("should throw ApiError on 404 response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(apiRequest("/test")).rejects.toMatchObject({
        status: 404,
        message: "Not found",
      });
    });

    it("should throw ApiError on 409 response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({}),
      });

      await expect(apiRequest("/test")).rejects.toMatchObject({
        status: 409,
        message: "Conflict",
      });
    });

    it("should throw ApiError on 413 response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: async () => ({}),
      });

      await expect(apiRequest("/test")).rejects.toMatchObject({
        status: 413,
        message: "Request too large",
      });
    });

    it("should use custom error message from response JSON", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: "Custom error from server" }),
      });

      await expect(apiRequest("/test")).rejects.toMatchObject({
        status: 400,
        message: "Custom error from server",
      });
    });

    it("should use default error message when JSON parsing fails", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(
        apiRequest("/test", { errorMessage: "Server error" }),
      ).rejects.toMatchObject({
        status: 500,
        message: "Server error",
      });
    });

    it("should use 'Request failed' as default error message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(apiRequest("/test")).rejects.toMatchObject({
        status: 500,
        message: "Request failed",
      });
    });
  });

  // ============================================
  // apiRequestRaw Tests
  // ============================================

  describe("apiRequestRaw", () => {
    it("should return raw Response on success", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockResponse,
      );

      const result = await apiRequestRaw("/binary");

      expect(result).toBe(mockResponse);
    });

    it("should throw ApiError on error response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(apiRequestRaw("/binary")).rejects.toThrow(ApiError);
    });
  });

  // ============================================
  // Helper Function Tests
  // ============================================

  describe("jsonBody", () => {
    it("should create JSON request options", () => {
      const data = { name: "Test", value: 42 };
      const result = jsonBody(data);

      expect(result).toEqual({
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    });

    it("should handle nested objects", () => {
      const data = { nested: { deep: { value: true } } };
      const result = jsonBody(data);

      expect(result.body).toBe('{"nested":{"deep":{"value":true}}}');
    });

    it("should handle arrays", () => {
      const data = [1, 2, 3];
      const result = jsonBody(data);

      expect(result.body).toBe("[1,2,3]");
    });
  });

  describe("binaryBody", () => {
    it("should create binary request options from ArrayBuffer", () => {
      const buffer = new ArrayBuffer(8);
      const result = binaryBody(buffer);

      expect(result).toEqual({
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: buffer,
      });
    });

    it("should create binary request options from Blob", () => {
      const blob = new Blob(["test"], { type: "text/plain" });
      const result = binaryBody(blob);

      expect(result).toEqual({
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: blob,
      });
    });
  });
});

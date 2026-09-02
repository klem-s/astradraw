/**
 * Runtime environment configuration helper.
 *
 * In production Docker builds, environment variables are injected at runtime
 * via window.__ENV__. This module provides a unified way to access env vars
 * that works both in development (import.meta.env) and production (window.__ENV__).
 *
 * Pre-bundled libraries are injected via window.__BUNDLED_LIBRARIES__ from
 * .excalidrawlib files mounted in /app/libraries/ directory.
 */

import type { LibraryItem } from "@excalidraw/excalidraw/types";

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
    __BUNDLED_LIBRARIES__?: LibraryItem[];
  }
}

/**
 * Get bundled libraries injected at container startup.
 * These are pre-installed libraries from /app/libraries/*.excalidrawlib files.
 */
export function getBundledLibraries(): LibraryItem[] {
  if (typeof window !== "undefined" && window.__BUNDLED_LIBRARIES__) {
    return window.__BUNDLED_LIBRARIES__;
  }
  return [];
}

/**
 * Get an environment variable value.
 * Checks window.__ENV__ first (for Docker runtime injection),
 * then falls back to import.meta.env (for build-time values).
 */
export function getEnv(key: string): string {
  // Check runtime injection first
  if (typeof window !== "undefined" && window.__ENV__ && window.__ENV__[key]) {
    return window.__ENV__[key];
  }
  // Fall back to build-time env vars
  return (import.meta.env as Record<string, string>)[key] || "";
}

// Pre-defined accessors for commonly used env vars
export const ENV = {
  get VITE_APP_WS_SERVER_URL() {
    return getEnv("VITE_APP_WS_SERVER_URL");
  },
  get VITE_APP_BACKEND_V2_GET_URL() {
    return getEnv("VITE_APP_BACKEND_V2_GET_URL");
  },
  get VITE_APP_BACKEND_V2_POST_URL() {
    return getEnv("VITE_APP_BACKEND_V2_POST_URL");
  },
  get VITE_APP_STORAGE_BACKEND() {
    return getEnv("VITE_APP_STORAGE_BACKEND");
  },
  get VITE_APP_HTTP_STORAGE_BACKEND_URL() {
    return getEnv("VITE_APP_HTTP_STORAGE_BACKEND_URL");
  },
  get VITE_APP_FIREBASE_CONFIG() {
    return getEnv("VITE_APP_FIREBASE_CONFIG");
  },
  get VITE_APP_DISABLE_TRACKING() {
    return getEnv("VITE_APP_DISABLE_TRACKING");
  },
};

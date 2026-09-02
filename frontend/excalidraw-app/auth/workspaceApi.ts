/**
 * Workspace API client for scene management
 *
 * This file re-exports all API functions from the modular api/ directory
 * for backward compatibility. New code should import from specific modules:
 *
 * @example
 * // Preferred - import from specific module
 * import { listScenes, createScene } from "../auth/api/scenes";
 *
 * // Also works - import from this file (backward compatible)
 * import { listScenes, createScene } from "../auth/workspaceApi";
 */

export * from "./api";

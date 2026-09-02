/* eslint-disable no-console */
/**
 * useUIDebugLogger - Debug hook to track UI state changes
 *
 * Logs changes to important UI state properties to help diagnose
 * issues where UI elements disappear unexpectedly.
 *
 * To enable: set window.__ASTRADRAW_DEBUG_UI__ = true in browser console
 */

import { useEffect, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

interface UIDebugState {
  zenModeEnabled: boolean;
  viewModeEnabled: boolean;
  zoom: number;
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  openSidebar: string | null;
  openDialog: string | null;
}

declare global {
  interface Window {
    __ASTRADRAW_DEBUG_UI__?: boolean;
  }
}

function isDebugEnabled(): boolean {
  return (
    typeof window !== "undefined" && window.__ASTRADRAW_DEBUG_UI__ === true
  );
}

export function useUIDebugLogger(
  excalidrawAPI: ExcalidrawImperativeAPI | null,
): void {
  const lastStateRef = useRef<UIDebugState | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const checkState = () => {
      if (!isDebugEnabled()) {
        return;
      }

      const appState = excalidrawAPI.getAppState();

      const currentState: UIDebugState = {
        zenModeEnabled: appState.zenModeEnabled,
        viewModeEnabled: appState.viewModeEnabled,
        zoom: appState.zoom.value,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        width: appState.width,
        height: appState.height,
        offsetLeft: appState.offsetLeft,
        offsetTop: appState.offsetTop,
        openSidebar: appState.openSidebar?.name ?? null,
        openDialog: appState.openDialog?.name ?? null,
      };

      // Also check DOM state
      const excalidrawContainer = document.querySelector(
        ".excalidraw",
      ) as HTMLElement;
      const excalidrawApp = document.querySelector(
        ".excalidraw-app",
      ) as HTMLElement;

      if (excalidrawContainer) {
        const containerRect = excalidrawContainer.getBoundingClientRect();
        const containerStyle = window.getComputedStyle(excalidrawContainer);

        // Log if container is shifted off-screen
        if (containerRect.left < -10 || containerRect.top < -10) {
          console.log(
            `%c[AstraDraw UI Debug] Container shifted off-screen!`,
            "color: #e74c3c; font-weight: bold",
            {
              containerRect: {
                left: containerRect.left,
                top: containerRect.top,
                width: containerRect.width,
                height: containerRect.height,
              },
              transform: containerStyle.transform,
              overflow: containerStyle.overflow,
            },
          );
        }
      }

      if (excalidrawApp) {
        const appRect = excalidrawApp.getBoundingClientRect();
        const appStyle = window.getComputedStyle(excalidrawApp);

        if (appRect.left < -10 || appRect.top < -10) {
          console.log(
            `%c[AstraDraw UI Debug] App container shifted!`,
            "color: #e74c3c; font-weight: bold",
            {
              appRect: {
                left: appRect.left,
                top: appRect.top,
                width: appRect.width,
                height: appRect.height,
              },
              transform: appStyle.transform,
            },
          );
        }
      }

      const lastState = lastStateRef.current;

      if (lastState) {
        const changes: string[] = [];

        if (lastState.zenModeEnabled !== currentState.zenModeEnabled) {
          changes.push(
            `zenModeEnabled: ${lastState.zenModeEnabled} → ${currentState.zenModeEnabled}`,
          );
        }
        if (lastState.viewModeEnabled !== currentState.viewModeEnabled) {
          changes.push(
            `viewModeEnabled: ${lastState.viewModeEnabled} → ${currentState.viewModeEnabled}`,
          );
        }
        if (Math.abs(lastState.zoom - currentState.zoom) > 0.01) {
          changes.push(
            `zoom: ${lastState.zoom.toFixed(2)} → ${currentState.zoom.toFixed(
              2,
            )}`,
          );
        }
        if (
          Math.abs(lastState.scrollX - currentState.scrollX) > 10 ||
          Math.abs(lastState.scrollY - currentState.scrollY) > 10
        ) {
          changes.push(
            `scroll: (${lastState.scrollX.toFixed(
              0,
            )},${lastState.scrollY.toFixed(
              0,
            )}) → (${currentState.scrollX.toFixed(
              0,
            )},${currentState.scrollY.toFixed(0)})`,
          );
        }
        if (
          lastState.width !== currentState.width ||
          lastState.height !== currentState.height
        ) {
          changes.push(
            `dimensions: ${lastState.width}x${lastState.height} → ${currentState.width}x${currentState.height}`,
          );
        }
        if (
          lastState.offsetLeft !== currentState.offsetLeft ||
          lastState.offsetTop !== currentState.offsetTop
        ) {
          changes.push(
            `offset: (${lastState.offsetLeft},${lastState.offsetTop}) → (${currentState.offsetLeft},${currentState.offsetTop})`,
          );
        }
        if (lastState.openSidebar !== currentState.openSidebar) {
          changes.push(
            `openSidebar: ${lastState.openSidebar} → ${currentState.openSidebar}`,
          );
        }
        if (lastState.openDialog !== currentState.openDialog) {
          changes.push(
            `openDialog: ${lastState.openDialog} → ${currentState.openDialog}`,
          );
        }

        if (changes.length > 0) {
          console.log(
            `%c[AstraDraw UI Debug] State changed:`,
            "color: #6965db; font-weight: bold",
          );
          changes.forEach((change) => {
            console.log(`  • ${change}`);
          });

          // Log full state on significant changes
          if (
            currentState.zenModeEnabled !== lastState.zenModeEnabled ||
            currentState.viewModeEnabled !== lastState.viewModeEnabled ||
            currentState.width === 0 ||
            currentState.height === 0
          ) {
            console.log(
              `%c[AstraDraw UI Debug] Full state:`,
              "color: #e74c3c; font-weight: bold",
              currentState,
            );
            console.trace("State change stack trace:");
          }
        }
      } else {
        console.log(
          `%c[AstraDraw UI Debug] Initial state:`,
          "color: #27ae60; font-weight: bold",
          currentState,
        );
      }

      lastStateRef.current = currentState;
    };

    // Check immediately
    checkState();

    // Check periodically (every 100ms during active use)
    intervalRef.current = window.setInterval(checkState, 100);

    // Also check on scroll changes (zoom/pan)
    const unsubscribe = excalidrawAPI.onScrollChange(() => {
      checkState();
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      unsubscribe();
    };
  }, [excalidrawAPI]);
}

// Also log DOM visibility changes
export function useVisibilityDebugLogger(): void {
  useEffect(() => {
    if (!isDebugEnabled()) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          const target = mutation.target as HTMLElement;

          // Check for important UI elements
          if (
            target.classList.contains("layer-ui__wrapper") ||
            target.classList.contains("App-toolbar") ||
            target.classList.contains("excalidraw") ||
            target.classList.contains("Island")
          ) {
            const display = window.getComputedStyle(target).display;
            const visibility = window.getComputedStyle(target).visibility;
            const opacity = window.getComputedStyle(target).opacity;

            if (
              display === "none" ||
              visibility === "hidden" ||
              opacity === "0"
            ) {
              console.log(
                `%c[AstraDraw UI Debug] Element hidden:`,
                "color: #e74c3c; font-weight: bold",
                {
                  element: target.className,
                  display,
                  visibility,
                  opacity,
                  attributeName: mutation.attributeName,
                },
              );
              console.trace("Element hidden stack trace:");
            }
          }
        }
      });
    });

    // Start observing after a short delay to let the UI render
    const timeoutId = setTimeout(() => {
      const excalidrawContainer = document.querySelector(".excalidraw");
      if (excalidrawContainer) {
        observer.observe(excalidrawContainer, {
          attributes: true,
          subtree: true,
          attributeFilter: ["style", "class"],
        });
        console.log(
          `%c[AstraDraw UI Debug] DOM observer started`,
          "color: #27ae60; font-weight: bold",
        );
      }
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);
}

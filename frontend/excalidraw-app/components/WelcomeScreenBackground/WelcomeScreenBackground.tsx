/**
 * Animated Welcome Screen Background Component
 *
 * This component renders a layer of animated blobs (nebula clouds) that float
 * slowly across the screen. It works together with the CSS pseudo-element
 * background in WelcomeScreen.scss to create a multi-layered galaxy effect.
 *
 * LAYERING (back to front):
 * 1. WelcomeScreen.scss ::before (z-index: -2) - Deep space nebula gradients
 * 2. WelcomeScreen.scss ::after (z-index: -1) - Star field with twinkling
 * 3. This component (z-index: 1) - Floating blob nebula clouds
 * 4. Welcome screen content (z-index: auto) - Logo, menu, etc.
 *
 * FEATURE FLAG:
 * Set ENABLE_WELCOME_ANIMATION to false to disable this component.
 * Note: This only disables the blob layer, not the CSS pseudo-element layer.
 * To disable all background effects, also set $enable-galaxy-background: false
 * in WelcomeScreen.scss.
 *
 * DARK MODE ONLY:
 * This background only renders in dark mode. Light mode uses a clean white canvas.
 */
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { THEME } from "@excalidraw/excalidraw";

import styles from "./WelcomeScreenBackground.module.scss";

/**
 * Feature flag for the blob layer of the animated background.
 * Set to true to enable the floating blob nebula effect.
 * Set to false to disable (code remains for easy re-enabling).
 */
export const ENABLE_WELCOME_ANIMATION = true;

export const WelcomeScreenBackground = () => {
  const appState = useUIAppState();
  const isDarkMode = appState.theme === THEME.DARK;

  // Only show in dark mode and when feature is enabled
  if (!ENABLE_WELCOME_ANIMATION || !isDarkMode) {
    return null;
  }

  return (
    <div className={styles.background}>
      <div className={styles.nebula}>
        <div className={`${styles.blob} ${styles.blob1}`} />
        <div className={`${styles.blob} ${styles.blob2}`} />
        <div className={`${styles.blob} ${styles.blob3}`} />
        <div className={`${styles.blob} ${styles.blob4}`} />
      </div>
      <div className={styles.stars} />
    </div>
  );
};

import React from "react";
import { t } from "@excalidraw/excalidraw/i18n";
import { THEME } from "@excalidraw/excalidraw";

import type { Theme } from "@excalidraw/element/types";

import styles from "./PreferencesPage.module.scss";

// Stop keyboard events from propagating to Excalidraw canvas
const stopPropagation = (e: React.KeyboardEvent) => {
  e.stopPropagation();
};

// Icons
const sunIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const moonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const monitorIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export interface PreferencesPageProps {
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
}

export const PreferencesPage: React.FC<PreferencesPageProps> = ({
  theme,
  setTheme,
}) => {
  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{t("settings.myPreferences")}</h1>

        {/* Separator after title */}
        <div className={styles.separator} />

        {/* Theme Section */}
        <section className={styles.row}>
          <div className={styles.rowLabel}>
            <h2>{t("labels.theme")}</h2>
            <p className={styles.shortcutHint}>⌥ + ⇧ + D</p>
          </div>
          <div className={styles.rowContent}>
            <div className={styles.themeSelector}>
              <select
                className={styles.themeDropdown}
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme | "system")}
                onKeyDown={stopPropagation}
                onKeyUp={stopPropagation}
              >
                <option value={THEME.DARK}>{t("buttons.darkMode")}</option>
                <option value={THEME.LIGHT}>{t("buttons.lightMode")}</option>
                <option value="system">{t("buttons.systemMode")}</option>
              </select>
              <span className={styles.themeIcon}>
                {theme === THEME.DARK
                  ? moonIcon
                  : theme === THEME.LIGHT
                  ? sunIcon
                  : monitorIcon}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PreferencesPage;

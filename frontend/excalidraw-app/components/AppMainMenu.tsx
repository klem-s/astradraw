import {
  loginIcon,
  eyeIcon,
  GithubIcon,
  save,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import { t } from "@excalidraw/excalidraw/i18n";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { useSetAtom } from "../app-jotai";
import { LanguageList } from "../app-language/LanguageList";
import { ASTRADRAW_GITHUB_URL } from "../app_constants";
import { useAuth } from "../auth";

import { openWorkspaceSidebarAtom } from "./Settings/settingsState";

import { saveDebugState } from "./DebugCanvas";

// Folder icon for workspace
const folderIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  isAutoCollabScene?: boolean;
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  refresh: () => void;
  onSaveToWorkspace?: () => void;
}> = React.memo((props) => {
  const { user, isAuthenticated, oidcConfigured, localAuthEnabled, logout } =
    useAuth();
  const openWorkspaceSidebar = useSetAtom(openWorkspaceSidebarAtom);

  // Show workspace features if OIDC or local auth is available
  const authAvailable = oidcConfigured || localAuthEnabled;

  return (
    <MainMenu>
      {/* Workspace button at the top */}
      {authAvailable && (
        <MainMenu.Item icon={folderIcon} onClick={openWorkspaceSidebar}>
          {t("workspace.title")}
        </MainMenu.Item>
      )}
      {isAuthenticated && (
        <MainMenu.Item icon={save} onClick={props.onSaveToWorkspace}>
          {t("workspace.saveScene")}
        </MainMenu.Item>
      )}
      {authAvailable && <MainMenu.Separator />}

      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.ItemLink
        icon={GithubIcon}
        href={ASTRADRAW_GITHUB_URL}
        aria-label="GitHub"
      >
        GitHub
      </MainMenu.ItemLink>

      {/* Auth section */}
      {authAvailable &&
        (isAuthenticated ? (
          <MainMenu.Item icon={loginIcon} onClick={logout}>
            {t("workspace.logout")} ({user?.name || user?.email})
          </MainMenu.Item>
        ) : (
          <MainMenu.Item
            icon={loginIcon}
            onClick={() => {
              // Always open workspace sidebar which shows the login dialog
              // The dialog allows choosing between local auth and SSO
              openWorkspaceSidebar();
            }}
            className="highlighted"
          >
            {t("workspace.login")}
          </MainMenu.Item>
        ))}

      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onClick={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme
        allowSystemTheme
        theme={props.theme}
        onSelect={props.setTheme}
      />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});

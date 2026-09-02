import { loginIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import { useAuth } from "../auth";

import { AstradrawLogo } from "./AstradrawLogo";
import { WelcomeScreenBackground } from "./WelcomeScreenBackground";
import { LoginDialog } from "./Workspace/LoginDialog";

export const AppWelcomeScreen: React.FC<{
  onCollabDialogOpen: () => any;
  isCollabEnabled: boolean;
  onSignIn?: () => void;
}> = React.memo((props) => {
  const { t } = useI18n();
  const { isAuthenticated, oidcConfigured, localAuthEnabled } = useAuth();
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const headingContent = t("welcomeScreen.app.center_heading");

  // Show sign in button only if auth is available and user is not authenticated
  const showSignIn = !isAuthenticated && (oidcConfigured || localAuthEnabled);

  const handleLoginSuccess = () => {
    setShowLoginDialog(false);
    // Optionally open workspace sidebar after login
    props.onSignIn?.();
  };

  return (
    <>
      <WelcomeScreenBackground />
      <WelcomeScreen>
        <WelcomeScreen.Hints.MenuHint>
          {t("welcomeScreen.app.menuHint")}
        </WelcomeScreen.Hints.MenuHint>
        <WelcomeScreen.Hints.ToolbarHint />
        <WelcomeScreen.Hints.HelpHint />
        <WelcomeScreen.Center>
          <WelcomeScreen.Center.Logo>
            <AstradrawLogo size="large" withText />
          </WelcomeScreen.Center.Logo>
          <WelcomeScreen.Center.Heading>
            {headingContent}
          </WelcomeScreen.Center.Heading>
          <WelcomeScreen.Center.Menu>
            <WelcomeScreen.Center.MenuItemLoadScene />
            <WelcomeScreen.Center.MenuItemHelp />
            {props.isCollabEnabled && (
              <WelcomeScreen.Center.MenuItemLiveCollaborationTrigger
                onSelect={() => props.onCollabDialogOpen()}
              />
            )}
            {showSignIn && (
              <WelcomeScreen.Center.MenuItem
                onSelect={() => setShowLoginDialog(true)}
                shortcut={null}
                icon={loginIcon}
              >
                {t("workspace.login")}
              </WelcomeScreen.Center.MenuItem>
            )}
          </WelcomeScreen.Center.Menu>
        </WelcomeScreen.Center>
      </WelcomeScreen>

      {/* Login Dialog - opens as modal when Sign in is clicked */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onSuccess={handleLoginSuccess}
      />
    </>
  );
});

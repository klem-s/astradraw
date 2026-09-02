import React from "react";

import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { useI18n } from "@excalidraw/excalidraw/i18n";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { CodrawLogo } from "./CodrawLogo";

// Codraw: Export functionality disabled until user accounts are implemented
export const exportToExcalidrawPlus = async (
  _elements: readonly NonDeletedExcalidrawElement[],
  _appState: Partial<AppState>,
  _files: BinaryFiles,
  _name: string,
) => {
  // To be implemented when Codraw+ user functionality is ready
  // eslint-disable-next-line no-console
  console.log("Codraw+ export: Coming soon");
};

export const ExportToExcalidrawPlus: React.FC<{
  elements: readonly NonDeletedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  name: string;
  onError: (error: Error) => void;
  onSuccess: () => void;
}> = () => {
  const { t } = useI18n();
  return (
    <Card color="primary">
      <div className="Card-icon">
        <CodrawLogo
          size="xs"
          style={{
            [`--color-logo-icon` as any]: "#fff",
          }}
        />
      </div>
      <h2>Codraw+</h2>
      <div className="Card-details">
        {t("exportDialog.excalidrawplus_description")}
      </div>
      <ToolButton
        className="Card-button"
        type="button"
        title={t("exportDialog.excalidrawplus_button")}
        aria-label={t("exportDialog.excalidrawplus_button")}
        showAriaLabel={true}
        onClick={() => {
          // Disabled - to be implemented later
        }}
        style={{
          opacity: 0.5,
          cursor: "not-allowed",
          pointerEvents: "none",
        }}
      />
    </Card>
  );
};

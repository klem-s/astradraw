import { defaultLang } from "@excalidraw/excalidraw/i18n";
import { UI } from "@excalidraw/excalidraw/tests/helpers/ui";
import {
  screen,
  fireEvent,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import { renderExcalidrawApp } from "./testUtils";

describe("Test LanguageList", () => {
  it("rerenders UI on language change", async () => {
    await renderExcalidrawApp();

    // select rectangle tool to show properties menu
    UI.clickTool("rectangle");
    // english lang should display `Thin` label for stroke width
    // Use data-testid to avoid matching custom pen buttons that also contain "thin"
    expect(screen.queryByTestId("strokeWidth-thin")).not.toBeNull();
    fireEvent.click(document.querySelector(".dropdown-menu-button")!);

    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: "de-DE" },
    });

    // Wait for language to change - check the html lang attribute
    await waitFor(() => {
      expect(document.documentElement.getAttribute("lang")).toBe("de-DE");
    });

    // reset language
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: defaultLang.code },
    });

    // Wait for language to change back
    await waitFor(() => {
      expect(document.documentElement.getAttribute("lang")).toBe(
        defaultLang.code,
      );
    });
  });
});

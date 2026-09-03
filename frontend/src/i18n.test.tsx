import { fireEvent, render, screen } from "@testing-library/react";
import { PreferencesProvider, usePreferences } from "./i18n";

function Probe() {
  const { language, setLanguage, setFontSize, t } = usePreferences();
  return <>
    <output>{language}:{t("Settings")}</output>
    <button onClick={() => setLanguage("ja")}>Japanese</button>
    <button onClick={() => setLanguage("en")}>English</button>
    <button onClick={() => setFontSize("large")}>Large</button>
  </>;
}

test("preferences switch language and font size and persist both", () => {
  localStorage.setItem("dataset-studio-language", "en");
  render(<PreferencesProvider><Probe /></PreferencesProvider>);
  expect(screen.getByText("en:Settings")).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("en");
  fireEvent.click(screen.getByText("Japanese"));
  fireEvent.click(screen.getByText("Large"));
  expect(screen.getByText("ja:設定")).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("ja");
  expect(document.documentElement.dataset.fontSize).toBe("large");
  expect(localStorage.getItem("dataset-studio-language")).toBe("ja");
  expect(localStorage.getItem("dataset-studio-font-size")).toBe("large");
  fireEvent.click(screen.getByText("English"));
  expect(screen.getByText("en:Settings")).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("en");
  expect(localStorage.getItem("dataset-studio-language")).toBe("en");
});

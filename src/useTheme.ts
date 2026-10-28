import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const value = localStorage.getItem("msmr-theme");
      return value === "light" || value === "dark" ? value : "system";
    } catch {
      return "system";
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const theme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    onChange();
    return () => media.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#181b20" : "#f8f9f6");
  }, [theme]);
  function changePreference(value: ThemePreference) {
    setPreference(value);
    try {
      if (value === "system") localStorage.removeItem("msmr-theme");
      else localStorage.setItem("msmr-theme", value);
    } catch {
      /* theme still changes for this visit */
    }
  }
  return { preference, theme, changePreference };
}

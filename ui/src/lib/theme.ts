/**
 * Light, dark and system themes.
 *
 * The resolved value lives on `document.documentElement.dataset.theme` and is
 * written by the inline script in index.html before first paint, so switching
 * or reloading never flashes. This module keeps that attribute in step with the
 * person's choice and with the operating system while the choice is "system".
 */

import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "superdev.theme";

export const THEME_LABELS: Record<ThemeChoice, string> = {
  light: "Light",
  dark: "Dark",
  system: "Match System",
};

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readChoice(): ThemeChoice {
  const stored = document.documentElement.dataset.themeChoice;
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // Storage can be unavailable in a locked-down browser profile. System is a
    // safe default and the interface still works, it just will not remember.
  }
  return "system";
}

function apply(choice: ThemeChoice): ResolvedTheme {
  const resolved: ResolvedTheme =
    choice === "system" ? (prefersDark() ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeChoice = choice;
  return resolved;
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  const [resolved, setResolved] = useState<ResolvedTheme>(
    () => (document.documentElement.dataset.theme as ResolvedTheme) ?? "dark",
  );

  useEffect(() => {
    setResolved(apply(choice));
    if (choice !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(apply("system"));
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [choice]);

  const set = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembering the choice is acceptable; failing to apply it is not.
    }
    setChoice(next);
  }, []);

  return { choice, resolved, setTheme: set };
}

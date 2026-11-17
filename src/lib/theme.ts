export const applyThemeSettings = (mode: string, accent: string) => {
  const root = document.documentElement;

  // Apply Mode
  const isDark = 
    mode === "dark" || 
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Apply Accent
  root.classList.remove("theme-accent-green", "theme-accent-purple", "theme-accent-rose", "theme-accent-amber", "theme-accent-amber_modern");
  if (accent && accent !== "default") {
    root.classList.add(`theme-accent-${accent}`);
  }
};

export const THEME_PALETTES: Record<string, string[]> = {
  amber_modern: [
    "hsl(48 96% 48%)",
    "hsl(38 92% 50%)",
    "hsl(25 95% 53%)",
    "hsl(42 85% 65%)",
    "hsl(18 80% 48%)",
  ],
  amber: [
    "hsl(38 92% 50%)",
    "hsl(48 96% 48%)",
    "hsl(25 95% 53%)",
    "hsl(32 98% 60%)",
    "hsl(15 85% 50%)",
  ],
  green: [
    "hsl(150 60% 40%)",
    "hsl(165 70% 42%)",
    "hsl(135 65% 45%)",
    "hsl(180 60% 40%)",
    "hsl(110 55% 45%)",
  ],
  purple: [
    "hsl(270 70% 60%)",
    "hsl(285 75% 58%)",
    "hsl(250 70% 65%)",
    "hsl(310 65% 55%)",
    "hsl(230 65% 60%)",
  ],
  rose: [
    "hsl(340 75% 55%)",
    "hsl(355 80% 60%)",
    "hsl(325 70% 55%)",
    "hsl(15 85% 58%)",
    "hsl(300 60% 50%)",
  ],
  default: [
    "hsl(220 65% 50%)",
    "hsl(195 75% 45%)",
    "hsl(240 65% 60%)",
    "hsl(175 65% 40%)",
    "hsl(260 60% 58%)",
  ],
};

export const getThemeChartPalette = (accent?: string): string[] => {
  if (accent && THEME_PALETTES[accent]) {
    return THEME_PALETTES[accent];
  }
  return THEME_PALETTES.amber_modern;
};

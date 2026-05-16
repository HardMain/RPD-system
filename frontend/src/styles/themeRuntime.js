import { THEME_LIGHT, THEME_DARK } from "./theme.js";

export const THEMES = [
  { id: "light", label: "Светлая" },
  { id: "dark", label: "Тёмная" },
];

function block(selector, palette) {
  const vars = Object.entries(palette)
    .map(([k, v]) => `--c-${k}:${v};`)
    .join("");
  return `${selector}{${vars}}`;
}

export function injectThemeStyles() {
  if (document.getElementById("theme-vars")) return;
  const el = document.createElement("style");
  el.id = "theme-vars";
  el.textContent =
    block(':root, :root[data-theme="light"]', THEME_LIGHT)
    + block(':root[data-theme="dark"]', THEME_DARK);
  document.head.appendChild(el);
}

export function normalizeTheme(name) {
  return name === "dark" ? "dark" : "light";
}

export function applyTheme(name) {
  const theme = normalizeTheme(name);
  document.documentElement.dataset.theme = theme;
  return theme;
}

export type ThemePref = "system" | "light" | "dark";
export const THEME_KEY = "reflective-theme";

/** Inline script run before paint so the saved theme never flashes. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

let mql: MediaQueryList | null = null;
function onSystem() { if (currentTheme() === "system") paint("system"); }

function paint(t: ThemePref) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function currentTheme(): ThemePref {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem(THEME_KEY);
  return t === "light" || t === "dark" ? t : "system";
}

export function applyTheme(t: ThemePref) {
  localStorage.setItem(THEME_KEY, t);
  paint(t);
  if (!mql) { mql = window.matchMedia("(prefers-color-scheme: dark)"); mql.addEventListener("change", onSystem); }
}

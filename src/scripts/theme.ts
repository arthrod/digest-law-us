const THEME_KEY = "theme";
const LIGHT = "light";
const DARK = "dark";

function getPreferredTheme(): string {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
<<<<<<< HEAD
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? DARK
    : LIGHT;
=======
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
}

// Reuse the value already set by the inline FOUC-prevention script if available.
let themeValue: string =
<<<<<<< HEAD
  (window as unknown as { __theme?: { value: string } }).__theme?.value ??
  getPreferredTheme();
=======
  (window as unknown as { __theme?: { value: string } }).__theme?.value ?? getPreferredTheme();
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)

function persist(): void {
  localStorage.setItem(THEME_KEY, themeValue);
  reflect();
}

function reflect(): void {
  const root = document.firstElementChild;
  root?.setAttribute("data-theme", themeValue);
  root?.classList.toggle("dark", themeValue === DARK);
  document.querySelector("#theme-btn")?.setAttribute("aria-label", themeValue);

  // Fill <meta name="theme-color"> with the computed background colour so
  // Android's browser chrome matches the page background.
  const bg = window.getComputedStyle(document.body).backgroundColor;
<<<<<<< HEAD
  document
    .querySelector("meta[name='theme-color']")
    ?.setAttribute("content", bg);
=======
  document.querySelector("meta[name='theme-color']")?.setAttribute("content", bg);
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
}

function setup(): void {
  reflect();
  document.querySelector("#theme-btn")?.addEventListener("click", () => {
    themeValue = themeValue === LIGHT ? DARK : LIGHT;
    persist();
  });
}

setup();

// Re-run after View Transitions navigation.
document.addEventListener("astro:after-swap", setup);

// Carry the theme-color value across View Transitions to prevent the
// Android navigation bar from flashing during page transitions.
<<<<<<< HEAD
document.addEventListener("astro:before-swap", event => {
  const color = document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute("content");
=======
document.addEventListener("astro:before-swap", (event) => {
  const color = document.querySelector("meta[name='theme-color']")?.getAttribute("content");
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)
  if (color) {
    (event as { newDocument: Document }).newDocument
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", color);
  }
});

// Sync with OS-level dark/light preference changes.
<<<<<<< HEAD
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches }) => {
    themeValue = matches ? DARK : LIGHT;
    persist();
  });
=======
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ({ matches }) => {
  themeValue = matches ? DARK : LIGHT;
  persist();
});
>>>>>>> 6005d978 (After purge for sources with 1 or less items.)

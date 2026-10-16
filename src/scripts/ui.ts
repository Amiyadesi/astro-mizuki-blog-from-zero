export {};
const menu = document.querySelector<HTMLDetailsElement>("#menu")!;
const themeButton = document.querySelector<HTMLButtonElement>("#theme")!;
const themes = ["system", "light", "dark"];
const labels = ["跟随系统", "浅色", "深色"];
function themeLabel() {
  themeButton.textContent = `主题：${labels[themes.indexOf(document.documentElement.dataset.theme || "system")]}`;
}
themeLabel();
themeButton.addEventListener("click", () => {
  const theme = themes[(themes.indexOf(document.documentElement.dataset.theme || "system") + 1) % themes.length];
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("theme", theme); } catch { /* Theme still works for this page. */ }
  themeLabel();
});
document.addEventListener("click", event => {
  if (event.target instanceof Element && (!menu.contains(event.target) || event.target.closest("a"))) menu.open = false;
});
document.addEventListener("keydown", event => { if (event.key === "Escape") menu.open = false; });
const header = document.querySelector<HTMLElement>(".site-header")!;
new ResizeObserver(() => document.documentElement.style.setProperty("--header-height", `${header.offsetHeight}px`)).observe(header);

const toc = document.querySelector<HTMLDetailsElement>("#toc");
if (toc) {
  const desktop = matchMedia("(min-width: 1100px)");
  toc.open = desktop.matches;
  desktop.addEventListener("change", () => { toc.open = desktop.matches; });
  toc.addEventListener("click", event => { if (!desktop.matches && event.target instanceof Element && event.target.closest("a")) toc.open = false; });
  toc.addEventListener("toggle", () => { if (toc.open) menu.open = false; });
  menu.addEventListener("toggle", () => { if (menu.open && !desktop.matches) toc.open = false; });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !desktop.matches) toc.open = false; });
}

const imageDialog = document.querySelector<HTMLDialogElement>("#image-dialog")!;
const enlarged = imageDialog.querySelector("img")!;
for (const image of document.querySelectorAll<HTMLImageElement>(".prose img")) {
  if (image.closest("a")) continue;
  image.tabIndex = 0;
  image.setAttribute("role", "button");
  image.setAttribute("aria-label", `放大图片：${image.alt}`);
  const open = () => { enlarged.src = image.src; enlarged.alt = image.alt; imageDialog.showModal(); };
  image.addEventListener("click", open);
  image.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
}
imageDialog.addEventListener("close", () => enlarged.removeAttribute("src"));
imageDialog.addEventListener("click", event => { if (event.target === imageDialog) imageDialog.close(); });

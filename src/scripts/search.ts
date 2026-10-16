export {};
const dialog = document.querySelector<HTMLDialogElement>("#search-dialog")!;
const input = document.querySelector<HTMLInputElement>("#search-input")!;
const status = document.querySelector<HTMLElement>("#search-status")!;
const results = document.querySelector<HTMLOListElement>("#search-results")!;
const retry = document.querySelector<HTMLButtonElement>("#search-retry")!;
const pagefindURL = "/pagefind/pagefind.js";
interface SearchResult { url: string; meta: { title: string }; excerpt: string; }
interface Pagefind {
  init(): Promise<void>;
  search(term: string): Promise<{ results: { data(): Promise<SearchResult> }[] }>;
}
let pagefind: Promise<Pagefind> | undefined;
let generation = 0;
let timer: ReturnType<typeof setTimeout>;
function load() {
  return pagefind ||= import(/* @vite-ignore */ pagefindURL).then(async (module: Pagefind) => {
    await module.init();
    return module;
  }).catch(error => { pagefind = undefined; throw error; });
}
async function search() {
  const current = ++generation;
  const term = input.value.trim();
  results.replaceChildren();
  retry.hidden = true;
  if (!term) { status.textContent = "输入关键词开始搜索。"; return; }
  status.textContent = "正在搜索…";
  try {
    const engine = await load();
    const response = await engine.search(term);
    const data = await Promise.all(response.results.slice(0, 20).map(result => result.data()));
    if (current !== generation || !dialog.open) return;
    for (const result of data) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = result.url;
      link.textContent = result.meta.title;
      const excerpt = document.createElement("p");
      // Pagefind escapes indexed text and adds only its own highlight markup.
      excerpt.innerHTML = result.excerpt;
      item.append(link, excerpt);
      results.append(item);
    }
    status.textContent = response.results.length ? `找到 ${response.results.length} 篇，最多显示 20 篇。` : "没有找到，换个关键词试试。";
  } catch {
    if (current !== generation || !dialog.open) return;
    status.textContent = "搜索加载失败。请重试；本地需先构建再预览。";
    retry.hidden = false;
  }
}
document.querySelector("#search-open")!.addEventListener("click", () => {
  document.querySelector<HTMLDetailsElement>("#menu")!.open = false;
  dialog.showModal();
  input.focus();
  void warm();
});
input.addEventListener("input", () => { ++generation; clearTimeout(timer); timer = setTimeout(search, 180); });
async function warm() {
  const current = ++generation;
  retry.hidden = true;
  try {
    await load();
    if (current === generation && dialog.open) {
      status.textContent = "输入关键词开始搜索。";
      if (input.value.trim()) void search();
    }
  } catch {
    if (current === generation && dialog.open) { status.textContent = "搜索加载失败，请重试。"; retry.hidden = false; }
  }
}
retry.addEventListener("click", () => { void warm(); });
dialog.addEventListener("close", () => { ++generation; clearTimeout(timer); });
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const read = file => readFileSync(path.join(root, file), "utf8");
for (const file of ["index.html", "archive/index.html", "about/index.html", "friends/index.html", "404.html", "rss.xml", "robots.txt", "sitemap-index.xml", "pagefind/pagefind.js"]) {
  assert.ok(existsSync(path.join(root, file)), `Missing build output: ${file}`);
}
const files = readdirSync(root, { recursive: true }).filter(file => file.endsWith(".html"));
for (const file of files) {
  const html = read(file);
  assert.match(html, /<link rel="canonical" href="https?:\/\//, `Missing canonical: ${file}`);
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const target = path.resolve(root, `.${decodeURIComponent(match[1])}`);
    assert.ok(target === root || target.startsWith(root + path.sep), `Escaping asset path: ${match[1]}`);
    assert.ok(existsSync(target), `Broken local URL in ${file}: ${match[1]}`);
    if (statSync(target).isDirectory()) assert.ok(existsSync(path.join(target, "index.html")), `Missing page: ${match[1]}`);
  }
}
const draftSource = new URL("../articles/posts/draft-example/index.md", import.meta.url);
if (existsSync(draftSource) && /^draft: true$/m.test(readFileSync(draftSource, "utf8"))) {
  assert.ok(!existsSync(path.join(root, "posts/draft-example/index.html")), "Draft page leaked");
  assert.ok(!read("rss.xml").includes("/draft-example/"), "Draft leaked into RSS");
  for (const file of readdirSync(root).filter(file => /^sitemap.*\.xml$/.test(file))) assert.ok(!read(file).includes("/draft-example/"), "Draft leaked into sitemap");
}
assert.ok(!/<(?:link|script)[^>]+(?:src|href)="\/pagefind\//.test(read("index.html")), "Search must load on demand");
console.log(`Verified ${files.length} pages, local assets, discovery files and draft exclusion.`);

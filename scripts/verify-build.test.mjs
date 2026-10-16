import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

for (const [url, valid] of [
  ["https://writer.pages.dev", true], ["https://writer.example/", true],
  ["https://writer.example/path", false], ["https://user:pass@writer.example", false],
  ["javascript:alert(1)", false], ["https://writer.example/?query=1", false],
]) {
  test(`SITE_URL boundary: ${url}`, () => {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", "await import('./src/site.mjs')"], {
      cwd: new URL("../", import.meta.url), env: { ...process.env, SITE_URL: url }, encoding: "utf8",
    });
    assert.equal(result.status === 0, valid, result.stderr);
  });
}

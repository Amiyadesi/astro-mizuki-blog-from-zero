import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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

test("local .env works without overriding deployment variables", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "sayori-site-"));
  try {
    mkdirSync(path.join(directory, "src"));
    copyFileSync(new URL("../src/site.mjs", import.meta.url), path.join(directory, "src/site.mjs"));
    copyFileSync(new URL("../site.config.mjs", import.meta.url), path.join(directory, "site.config.mjs"));
    writeFileSync(path.join(directory, ".env"), "SITE_URL=https://local.pages.dev\n");
    const env = { ...process.env };
    delete env.SITE_URL;
    const run = variables => spawnSync(process.execPath, ["--input-type=module", "-e", "const {site} = await import('./src/site.mjs'); console.log(site.url)"], { cwd: directory, env: variables, encoding: "utf8" });
    const local = run(env);
    assert.equal(local.status, 0, local.stderr);
    assert.equal(local.stdout.trim(), "https://local.pages.dev");
    const deployment = run({ ...env, SITE_URL: "https://production.pages.dev" });
    assert.equal(deployment.status, 0, deployment.stderr);
    assert.equal(deployment.stdout.trim(), "https://production.pages.dev");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

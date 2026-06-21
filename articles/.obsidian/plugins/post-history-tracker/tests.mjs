import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  getPostContentFingerprint,
  isPostMarkdown,
  parseGitStatusPostPaths,
  updatePostHistory,
  updatePostHistoryForCommit,
} = require("./history-core.js");
const {
  buildLocalPreviewCommand,
  buildPublishCommand,
  buildStopPreviewCommand,
  getPluginDir,
  getPluginLogPath,
  getPreviewLogPath,
  getPreviewPidPath,
  getPublishLogPath,
  getRepoRoot,
} = require("./publish-core.js");

describe("updatePostHistory", () => {
  it("adds history fields after published and increments from missing count", () => {
    const result = updatePostHistory(
      [
        "---",
        "title: Hello",
        "published: 2026-05-29",
        "description: Test",
        "---",
        "",
        "hello",
      ].join("\n"),
      "2026-06-09",
    );

    assert.match(
      result,
      /published: 2026-05-29\ncreated: 2026-05-29\nupdated: 2026-06-09\nlastEdited: 2026-06-09\nupdateCount: 1\n/,
    );
  });

  it("preserves created and increments existing count", () => {
    const result = updatePostHistory(
      [
        "---",
        "title: Hello",
        "published: 2026-05-29",
        "created: 2026-05-30",
        "updated: 2026-06-01",
        "lastEdited: 2026-06-01",
        "updateCount: 3",
        "---",
        "",
        "hello",
      ].join("\n"),
      "2026-06-09",
    );

    assert.match(result, /created: 2026-05-30/);
    assert.match(result, /updated: 2026-06-09/);
    assert.match(result, /lastEdited: 2026-06-09/);
    assert.match(result, /updateCount: 4/);
  });
});

describe("post history publish gating", () => {
  it("detects changed post markdown files from git status output", () => {
    const paths = parseGitStatusPostPaths(
      [
        " M articles/posts/hello/hello.md",
        "?? articles/posts/new-post/new-post.md",
        " D articles/posts/deleted/deleted.md",
        " M articles/spec/about.md",
        " M blog/src/content/posts/hello/index.md",
        "R  articles/posts/old/old.md -> articles/posts/new-name/new-name.md",
        "",
      ].join("\n"),
    );

    assert.deepEqual(paths, [
      "posts/hello/hello.md",
      "posts/new-post/new-post.md",
      "posts/new-name/new-name.md",
    ]);
  });

  it("ignores history-only frontmatter changes when fingerprinting post content", () => {
    const before = [
      "---",
      "title: Hello",
      "published: 2026-05-29",
      "created: 2026-05-29",
      "updated: 2026-06-09",
      "lastEdited: 2026-06-09",
      "updateCount: 1",
      "---",
      "",
      "hello",
    ].join("\n");
    const after = [
      "---",
      "title: Hello",
      "published: 2026-05-29",
      "created: 2026-05-29",
      "updated: 2026-06-10",
      "lastEdited: 2026-06-10",
      "updateCount: 2",
      "---",
      "",
      "hello",
    ].join("\n");

    assert.equal(
      getPostContentFingerprint(before),
      getPostContentFingerprint(after),
    );
    assert.notEqual(
      getPostContentFingerprint(before),
      getPostContentFingerprint(`${after}\nnew paragraph`),
    );
  });

  it("counts a changed post once from the committed baseline", () => {
    const baseline = [
      "---",
      "title: Hello",
      "published: 2026-05-29",
      "created: 2026-05-29",
      "updated: 2026-06-01",
      "lastEdited: 2026-06-01",
      "updateCount: 7",
      "---",
      "",
      "hello",
    ].join("\n");
    const changed = `${baseline}\nnew paragraph`;

    const first = updatePostHistoryForCommit(changed, "2026-06-09", baseline);
    const second = updatePostHistoryForCommit(first, "2026-06-09", baseline);

    assert.match(first, /updateCount: 8/);
    assert.equal(second, first);
  });
});

describe("isPostMarkdown", () => {
  it("accepts posts markdown only", () => {
    assert.equal(
      isPostMarkdown({ extension: "md", path: "posts/hello/hello.md" }),
      true,
    );
    assert.equal(
      isPostMarkdown({ extension: "md", path: "spec/about.md" }),
      false,
    );
    assert.equal(
      isPostMarkdown({ extension: "canvas", path: "posts/test.canvas" }),
      false,
    );
  });
});

describe("publish command", () => {
  it("builds repo-rooted PowerShell deploy command without running it", () => {
    const vaultBasePath = path.resolve("articles");
    const repoRoot = path.resolve(".");
    const command = buildPublishCommand(vaultBasePath);

    assert.equal(getRepoRoot(vaultBasePath), repoRoot.replace(/\\/g, "/"));
    assert.equal(command.command, "powershell.exe");
    assert.equal(command.cwd, repoRoot.replace(/\\/g, "/"));
    assert.deepEqual(command.args.slice(0, 4), [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
    ]);
    assert.equal(
      command.args[4],
      `${repoRoot.replace(/\\/g, "/")}/scripts/deploy-blog-from-obsidian.ps1`,
    );
    assert.equal(command.args[5], "-SkipInstall");
    assert.equal(command.args[6], "-CommitChanges");
    assert.equal(command.args[7], "-PushChanges");
    assert.equal(command.scriptPath, command.args[4]);
  });

  it("can build a publish command without git commit for tests", () => {
    const vaultBasePath = path.resolve("articles");
    const command = buildPublishCommand(vaultBasePath, {
      commitChanges: false,
    });

    assert.equal(command.args.includes("-CommitChanges"), false);
  });

  it("can build a publish command without git push for tests", () => {
    const vaultBasePath = path.resolve("articles");
    const command = buildPublishCommand(vaultBasePath, {
      pushChanges: false,
    });

    assert.equal(command.args.includes("-PushChanges"), false);
  });

  it("builds a local preview command rooted at the repo scripts directory", () => {
    const vaultBasePath = path.resolve("articles");
    const repoRoot = path.resolve(".");
    const command = buildLocalPreviewCommand(vaultBasePath);

    assert.equal(command.command, "powershell.exe");
    assert.equal(command.cwd, repoRoot.replace(/\\/g, "/"));
    assert.deepEqual(command.args.slice(0, 4), [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
    ]);
    assert.equal(
      command.args[4],
      `${repoRoot.replace(/\\/g, "/")}/scripts/local-preview.ps1`,
    );
    assert.equal(command.args.includes("-SkipInstall"), false);
    assert.equal(command.scriptPath, command.args[4]);
  });

  it("can build a local preview command with dependency install skipped explicitly", () => {
    const vaultBasePath = path.resolve("articles");
    const command = buildLocalPreviewCommand(vaultBasePath, {
      skipInstall: true,
    });

    assert.equal(command.args[5], "-SkipInstall");
  });

  it("builds a local preview stop command rooted at the repo scripts directory", () => {
    const vaultBasePath = path.resolve("articles");
    const repoRoot = path.resolve(".");
    const command = buildStopPreviewCommand(vaultBasePath);

    assert.equal(command.command, "powershell.exe");
    assert.equal(command.cwd, repoRoot.replace(/\\/g, "/"));
    assert.deepEqual(command.args.slice(0, 4), [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
    ]);
    assert.equal(
      command.args[4],
      `${repoRoot.replace(/\\/g, "/")}/scripts/stop-preview.ps1`,
    );
    assert.equal(command.scriptPath, command.args[4]);
  });

  it("keeps publish log inside the local plugin directory", () => {
    const vaultBasePath = path.resolve("articles");
    const repoRoot = path.resolve(".");
    const pluginDir = `${vaultBasePath.replace(/\\/g, "/")}/.obsidian/plugins/post-history-tracker`;

    assert.equal(getPluginDir(vaultBasePath), pluginDir);
    assert.equal(getPluginLogPath(vaultBasePath), `${pluginDir}/plugin.log`);
    assert.equal(getPublishLogPath(vaultBasePath), `${pluginDir}/publish.log`);
    assert.equal(getPreviewLogPath(vaultBasePath), `${pluginDir}/preview.log`);
    assert.equal(
      getPreviewPidPath(vaultBasePath),
      `${repoRoot.replace(/\\/g, "/")}/.preview-pids.json`,
    );
  });
});

describe("obsidian plugin registration", () => {
  it("declares a loadable main entry in the manifest", () => {
    const pluginDir = path.resolve(
      "articles/.obsidian/plugins/post-history-tracker",
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf8"),
    );

    assert.equal(manifest.id, "post-history-tracker");
    assert.equal(manifest.main, "main.js");
    assert.equal(fs.existsSync(path.join(pluginDir, manifest.main)), true);
  });

  it("enables the local plugin in the vault config", () => {
    const enabledPlugins = JSON.parse(
      fs.readFileSync("articles/.obsidian/community-plugins.json", "utf8"),
    );

    assert.equal(enabledPlugins.includes("post-history-tracker"), true);
  });

  it("loads the plugin entry when Obsidian provides its runtime module", () => {
    const mainPath = require.resolve("./main.js");
    const originalLoad = Module._load;
    Module._load = function loadWithObsidianStub(request, parent, isMain) {
      if (request === "obsidian") {
        return {
          Notice: class Notice {},
          Plugin: class Plugin {},
        };
      }

      return originalLoad.call(this, request, parent, isMain);
    };

    try {
      delete require.cache[mainPath];
      const PluginClass = require(mainPath);
      assert.equal(typeof PluginClass, "function");
    } finally {
      Module._load = originalLoad;
      delete require.cache[mainPath];
    }
  });

  it("does not register save-time history listeners or commands", () => {
    const mainSource = fs.readFileSync(
      "articles/.obsidian/plugins/post-history-tracker/main.js",
      "utf8",
    );

    assert.equal(mainSource.includes("vault.on(\"modify\""), false);
    assert.equal(mainSource.includes("vault.on('modify'"), false);
    assert.equal(mainSource.includes("registerEvent("), false);
    assert.equal(mainSource.includes("scheduleHistoryUpdate"), false);
    assert.equal(
      mainSource.includes("Post History Tracker: Update current post history"),
      false,
    );
    assert.equal(mainSource.includes("async updateHistory("), false);
  });

  it("keeps the plugin entry loadable when sibling core modules are unavailable", () => {
    const mainPath = require.resolve("./main.js");
    const originalLoad = Module._load;
    Module._load = function loadWithMissingSiblingModules(
      request,
      parent,
      isMain,
    ) {
      if (request === "obsidian") {
        return {
          Notice: class Notice {},
          Plugin: class Plugin {},
        };
      }

      if (request === "./history-core.js" || request === "./publish-core.js") {
        throw new Error(`Simulated Obsidian loader miss: ${request}`);
      }

      return originalLoad.call(this, request, parent, isMain);
    };

    try {
      delete require.cache[mainPath];
      const PluginClass = require(mainPath);
      assert.equal(typeof PluginClass, "function");
    } finally {
      Module._load = originalLoad;
      delete require.cache[mainPath];
    }
  });

  it("registers a local preview entry alongside publish entry", () => {
    const mainSource = fs.readFileSync(
      "articles/.obsidian/plugins/post-history-tracker/main.js",
      "utf8",
    );

    assert.equal(mainSource.includes("本地预览博客"), true);
    assert.equal(mainSource.includes("启动博客预览"), true);
    assert.equal(mainSource.includes("停止博客预览"), true);
    assert.equal(mainSource.includes("local-preview.ps1"), true);
    assert.equal(mainSource.includes("stop-preview.ps1"), true);
    assert.equal(mainSource.includes("preview-blog-locally"), true);
    assert.equal(mainSource.includes("toggleLocalPreview"), true);
    assert.equal(mainSource.includes("stopLocalPreview"), true);
    assert.equal(mainSource.includes("refreshPreviewButtonState"), true);
    assert.equal(mainSource.includes("缺依赖会自动安装"), true);
    assert.equal(mainSource.includes("openPreviewUrl(previewState.blogUrl)"), true);
    assert.equal(mainSource.includes("shell.openExternal(url)"), true);
  });

  it("registers a site config hub command for Obsidian authoring", () => {
    const mainSource = fs.readFileSync(
      "articles/.obsidian/plugins/post-history-tracker/main.js",
      "utf8",
    );

    assert.equal(mainSource.includes("open-blog-site-config-hub"), true);
    assert.equal(mainSource.includes("打开博客站点配置入口"), true);
    assert.equal(mainSource.includes("spec/site-config-hub.md"), true);
    assert.equal(fs.existsSync("articles/spec/site-config-hub.md"), true);
  });
});

describe("obsidian article templates", () => {
  it("configures a blog post template with typed note properties", () => {
    const corePlugins = JSON.parse(
      fs.readFileSync("articles/.obsidian/core-plugins.json", "utf8"),
    );
    const templateSettings = JSON.parse(
      fs.readFileSync("articles/.obsidian/templates.json", "utf8"),
    );
    const propertyTypes = JSON.parse(
      fs.readFileSync("articles/.obsidian/types.json", "utf8"),
    ).types;
    const template = fs.readFileSync(
      "articles/templates/blog-post.md",
      "utf8",
    );

    assert.equal(corePlugins.properties, true);
    assert.equal(corePlugins.templates, true);
    assert.equal(templateSettings.folder, "templates");
    assert.equal(templateSettings.dateFormat, "YYYY-MM-DD");
    assert.equal(templateSettings.timeFormat, "HH:mm");

    assert.match(template, /^---\r?\n/);
    assert.match(template, /published: \{\{date:YYYY-MM-DD\}\}/);
    assert.match(template, /created: \{\{date:YYYY-MM-DD\}\}/);
    assert.match(template, /draft: true/);

    assert.equal(propertyTypes.title, "text");
    assert.equal(propertyTypes.published, "date");
    assert.equal(propertyTypes.created, "date");
    assert.equal(propertyTypes.description, "text");
    assert.equal(propertyTypes.image, "text");
    assert.equal(propertyTypes.tags, "tags");
    assert.equal(propertyTypes.category, "text");
    assert.equal(propertyTypes.draft, "checkbox");
    assert.equal(propertyTypes.alias, "text");
  });

  it("keeps template files and property settings in the publish allowlist", () => {
    const deployScript = fs.readFileSync(
      "scripts/deploy-blog-from-obsidian.ps1",
      "utf8",
    );

    assert.equal(deployScript.includes('"articles/templates"'), true);
    assert.equal(
      deployScript.includes('"articles/.obsidian/templates.json"'),
      true,
    );
    assert.equal(
      deployScript.includes('"articles/.obsidian/types.json"'),
      true,
    );
    assert.equal(deployScript.includes('"blog/public/_redirects"'), true);
  });

  it("hands deployment to GitHub Actions instead of local Wrangler by default", () => {
    const deployScript = fs.readFileSync(
      "scripts/deploy-blog-from-obsidian.ps1",
      "utf8",
    );

    assert.equal(deployScript.includes('"pages", "deploy"'), false);
    assert.equal(deployScript.includes("GitHub Actions"), true);
    assert.equal(deployScript.includes("VerifyLocalBuild"), true);
  });

  it("keeps a proxy-aware HTTPS fallback for SSH push failures", () => {
    const deployScript = fs.readFileSync(
      "scripts/deploy-blog-from-obsidian.ps1",
      "utf8",
    );

    assert.equal(deployScript.includes("Invoke-GitPublishHttpsFallback"), true);
    assert.equal(deployScript.includes("HTTPS_PROXY"), true);
    assert.equal(deployScript.includes("git@github\\.com:"), true);
    assert.equal(deployScript.includes("http.proxy=$proxy"), true);
  });
});

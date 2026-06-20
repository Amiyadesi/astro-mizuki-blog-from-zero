const { Plugin, Notice } = require("obsidian");
const {
  getLocalDateString,
  getPostContentFingerprint,
  isPostMarkdown,
  parseGitStatusPostPaths,
  updatePostHistoryForCommit,
} = createHistoryCore();
const {
  buildPublishCommand,
  getPluginLogPath,
  getPublishLogPath,
} = createPublishCore();

function createHistoryCore() {
  const postsPrefix = "posts/";
  const historyKeys = ["created", "updated", "lastEdited", "updateCount"];
  const historyKeySet = new Set(historyKeys);

  function isPostMarkdown(file) {
    return (
      file &&
      file.extension === "md" &&
      file.path.startsWith(postsPrefix) &&
      !file.path.split("/").some((segment) => segment.startsWith("."))
    );
  }

  function parseGitStatusPostPaths(statusText) {
    const paths = [];
    const seen = new Set();

    for (const rawLine of String(statusText || "").split(/\r?\n/)) {
      if (!rawLine.trim()) {
        continue;
      }

      const status = rawLine.slice(0, 2);
      if (status.includes("D")) {
        continue;
      }

      let repoPath = rawLine.length > 3 ? rawLine.slice(3).trim() : "";
      const renameMarker = " -> ";
      const renameIndex = repoPath.indexOf(renameMarker);
      if (renameIndex >= 0) {
        repoPath = repoPath.slice(renameIndex + renameMarker.length);
      }

      repoPath = repoPath.replace(/^"|"$/g, "").replace(/\\/g, "/");
      const vaultPath = repoPath.replace(/^articles\//, "");

      if (!vaultPath.startsWith(postsPrefix) || !vaultPath.endsWith(".md")) {
        continue;
      }

      if (vaultPath.split("/").some((segment) => segment.startsWith("."))) {
        continue;
      }

      if (!seen.has(vaultPath)) {
        seen.add(vaultPath);
        paths.push(vaultPath);
      }
    }

    return paths;
  }

  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getPostContentFingerprint(content) {
    const { createHash } = require("crypto");
    return createHash("sha256")
      .update(stripHistoryFields(content).replace(/\r\n/g, "\n"))
      .digest("hex");
  }

  function updatePostHistory(content, date, options = {}) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return content;
    }

    const frontmatter = match[1];
    const fields = parseFrontmatter(frontmatter);
    const updateCount = Number.isInteger(Number(options.updateCount))
      ? Number(options.updateCount)
      : getNextUpdateCount(fields);
    const updates = {
      created: fields.created || fields.published || date,
      updated: date,
      lastEdited: date,
      updateCount: String(updateCount),
    };

    const nextFrontmatter = applyFrontmatterUpdates(
      frontmatter,
      updates,
      eol,
    );
    return content.replace(match[1], nextFrontmatter);
  }

  function updatePostHistoryForCommit(content, date, baselineContent = null) {
    if (
      baselineContent !== null &&
      getPostContentFingerprint(content) ===
        getPostContentFingerprint(baselineContent)
    ) {
      return content;
    }

    const updateCount =
      baselineContent === null ? 1 : getPostUpdateCount(baselineContent) + 1;
    return updatePostHistory(content, date, { updateCount });
  }

  function getNextUpdateCount(fields) {
    return Number.isInteger(Number(fields.updateCount))
      ? Number(fields.updateCount) + 1
      : 1;
  }

  function getPostUpdateCount(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return 0;
    }

    const fields = parseFrontmatter(match[1]);
    return Number.isInteger(Number(fields.updateCount))
      ? Number(fields.updateCount)
      : 0;
  }

  function stripHistoryFields(content) {
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return content;
    }

    const lines = match[1]
      .split(/\r?\n/)
      .filter((line) => {
        const field = line.match(/^(\s*)([A-Za-z][A-Za-z0-9_-]*)\s*:/);
        return !field || !historyKeySet.has(field[2]);
      });

    return content.replace(match[1], lines.join(eol));
  }

  function parseFrontmatter(frontmatter) {
    const fields = {};

    for (const line of frontmatter.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
      if (!match) {
        continue;
      }
      fields[match[1]] = unquote(match[2].trim());
    }

    return fields;
  }

  function unquote(value) {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    return value;
  }

  function applyFrontmatterUpdates(frontmatter, updates, eol) {
    const lines = frontmatter.split(/\r?\n/);
    const present = new Set();

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\s*)([A-Za-z][A-Za-z0-9_-]*)\s*:/);
      if (!match) {
        continue;
      }

      const [, indent, key] = match;
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        lines[i] = `${indent}${key}: ${updates[key]}`;
        present.add(key);
      }
    }

    const missing = historyKeys.filter((key) => !present.has(key));
    if (!missing.length) {
      return lines.join(eol);
    }

    const publishedIndex = lines.findIndex((line) =>
      /^published\s*:/.test(line),
    );
    let insertAt = publishedIndex >= 0 ? publishedIndex + 1 : 0;

    for (const key of missing) {
      lines.splice(insertAt, 0, `${key}: ${updates[key]}`);
      insertAt++;
    }

    return lines.join(eol);
  }

  return {
    getLocalDateString,
    getPostContentFingerprint,
    isPostMarkdown,
    parseGitStatusPostPaths,
    updatePostHistoryForCommit,
  };
}

function createPublishCore() {
  function buildPublishCommand(vaultBasePath, options = {}) {
    const repoRoot = getRepoRoot(vaultBasePath);
    const scriptPath = joinPath(
      repoRoot,
      "scripts",
      "deploy-blog-from-obsidian.ps1",
    );
    const command = options.powershellCommand || "powershell.exe";

    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ];

    if (options.skipInstall !== false) {
      args.push("-SkipInstall");
    }

    if (options.verifyLocalBuild === true) {
      args.push("-VerifyLocalBuild");
    }

    if (options.commitChanges !== false) {
      args.push("-CommitChanges");
    }

    if (options.pushChanges !== false) {
      args.push("-PushChanges");
    }

    return {
      args,
      command,
      cwd: repoRoot,
      scriptPath,
    };
  }

  function getRepoRoot(vaultBasePath) {
    const normalized = normalizeSlashes(vaultBasePath);
    return normalized.replace(/\/articles\/?$/, "");
  }

  function getPluginDir(vaultBasePath) {
    return joinPath(
      vaultBasePath,
      ".obsidian",
      "plugins",
      "post-history-tracker",
    );
  }

  function getPublishLogPath(vaultBasePath) {
    return joinPath(getPluginDir(vaultBasePath), "publish.log");
  }

  function getPluginLogPath(vaultBasePath) {
    return joinPath(getPluginDir(vaultBasePath), "plugin.log");
  }

  function joinPath(...parts) {
    const filtered = parts.filter(Boolean).map((part) => String(part));
    if (!filtered.length) {
      return "";
    }

    return filtered
      .join("/")
      .replace(/\\/g, "/")
      .replace(/([^:])\/+/g, "$1/");
  }

  function normalizeSlashes(value) {
    return String(value || "")
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
  }

  return {
    buildPublishCommand,
    getPluginLogPath,
    getPublishLogPath,
  };
}

module.exports = class PostHistoryTrackerPlugin extends Plugin {
  async onload() {
    this.publishProcess = null;
    this.vaultBasePath = "";
    this.pluginLogPath = "";
    this.publishLogPath = "";

    try {
      this.vaultBasePath = this.getVaultBasePath();
      this.pluginLogPath = getPluginLogPath(this.vaultBasePath);
      this.publishLogPath = getPublishLogPath(this.vaultBasePath);
    } catch (error) {
      this.handleStartupError("vault path", error);
    }

    this.appendPluginLog(`[${new Date().toISOString()}] plugin loaded\n`);

    try {
      const publishRibbon = this.addRibbonIcon(
        "upload",
        "一键提交并推送博客",
        () => {
          this.publishBlog();
        },
      );
      if (publishRibbon && typeof publishRibbon.addClass === "function") {
        publishRibbon.addClass("post-history-tracker-publish-button");
      }

      this.addCommand({
        id: "publish-blog-from-obsidian",
        name: "一键提交并推送博客",
        callback: () => {
          this.publishBlog();
        },
      });

      const statusBarItem = this.addStatusBarItem();
      statusBarItem.setText("博客一键发布已加载");
      if (typeof statusBarItem.addClass === "function") {
        statusBarItem.addClass("post-history-tracker-status");
      }
    } catch (error) {
      this.handleStartupError("ui registration", error);
    }
  }

  handleStartupError(stage, error) {
    const message = error && (error.stack || error.message) ? error.stack || error.message : String(error);
    console.error(`[post-history-tracker] startup failed at ${stage}`, error);
    this.appendPluginLog(
      `[${new Date().toISOString()}] startup failed at ${stage}: ${message}\n`,
    );
    new Notice(`Post History Tracker 启动异常：${stage}`, 10000);
  }

  onunload() {
  }

  async publishBlog() {
    if (this.publishProcess) {
      new Notice("博客正在发布中。");
      return;
    }

    if (!this.vaultBasePath) {
      new Notice("无法读取 Obsidian vault 本地路径，不能发布。", 10000);
      return;
    }

    const publishCommand = buildPublishCommand(this.vaultBasePath);
    const { spawn } = require("child_process");
    const fs = require("fs");

    if (!fs.existsSync(publishCommand.scriptPath)) {
      new Notice(`发布脚本不存在：${publishCommand.scriptPath}`);
      return;
    }

    try {
      const updatedCount = await this.updateChangedPostHistoriesBeforePublish(
        publishCommand.cwd,
      );
      if (updatedCount > 0) {
        new Notice(`提交前已记录 ${updatedCount} 篇文章各 1 次更改。`);
      }
    } catch (error) {
      this.appendPublishLog(
        `[${new Date().toISOString()}] history update before publish failed: ${error.stack || error.message}\n`,
      );
      console.error(
        "[post-history-tracker] pre-publish history update failed",
        error,
      );
      new Notice(`提交前历史记录失败：${error.message}`, 10000);
      return;
    }

    this.appendPublishLog(
      [
        "",
        `[${new Date().toISOString()}] start publish`,
        `cwd: ${publishCommand.cwd}`,
        `command: ${publishCommand.command} ${publishCommand.args.join(" ")}`,
        "",
      ].join("\n"),
    );

    new Notice("开始同步、提交并推送博客，部署交给 GitHub Actions。");

    const child = spawn(publishCommand.command, publishCommand.args, {
      cwd: publishCommand.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    this.publishProcess = child;

    child.stdout.on("data", (chunk) => {
      this.handlePublishOutput("stdout", chunk);
    });

    child.stderr.on("data", (chunk) => {
      this.handlePublishOutput("stderr", chunk);
    });

    child.on("error", (error) => {
      this.publishProcess = null;
      this.appendPublishLog(
        `[${new Date().toISOString()}] publish spawn error: ${error.stack || error.message}\n`,
      );
      console.error("[post-history-tracker] publish failed", error);
      new Notice(`发布失败：${error.message}`, 10000);
    });

    child.on("close", (code) => {
      this.publishProcess = null;
      this.appendPublishLog(
        `[${new Date().toISOString()}] publish exited with code ${code}\n`,
      );

      if (code === 0) {
        new Notice("博客已提交并推送；GitHub Actions 会自动部署。");
        return;
      }

      new Notice(`发布失败，退出码 ${code}。查看 publish.log。`, 10000);
    });
  }

  handlePublishOutput(stream, chunk) {
    const text = chunk.toString();
    this.appendPublishLog(text);
    console.log(`[post-history-tracker] publish ${stream}:`, text.trim());
  }

  appendPublishLog(text) {
    if (!this.publishLogPath) {
      console.log(`[post-history-tracker] ${text.trim()}`);
      return;
    }

    try {
      const fs = require("fs");
      const path = require("path");
      fs.mkdirSync(path.dirname(this.publishLogPath), { recursive: true });
      fs.appendFileSync(this.publishLogPath, text, "utf8");
    } catch (error) {
      console.warn("[post-history-tracker] publish log write failed", error);
    }
  }

  appendPluginLog(text) {
    if (!this.pluginLogPath) {
      console.log(`[post-history-tracker] ${text.trim()}`);
      return;
    }

    try {
      const fs = require("fs");
      const path = require("path");
      fs.mkdirSync(path.dirname(this.pluginLogPath), { recursive: true });
      fs.appendFileSync(this.pluginLogPath, text, "utf8");
    } catch (error) {
      console.warn("[post-history-tracker] plugin log write failed", error);
    }
  }

  getVaultBasePath() {
    const adapter = this.app.vault.adapter;
    if (adapter && typeof adapter.getBasePath === "function") {
      return adapter.getBasePath();
    }

    if (adapter && typeof adapter.basePath === "string") {
      return adapter.basePath;
    }

    throw new Error("无法读取 Obsidian vault 本地路径。");
  }

  async updateChangedPostHistoriesBeforePublish(repoRoot) {
    const changedPaths = await this.getChangedPostPaths(repoRoot);
    let updatedCount = 0;

    for (const filePath of changedPaths) {
      const file = this.getVaultFileByPath(filePath);
      if (file && (await this.updateHistoryForCommit(file, repoRoot))) {
        updatedCount++;
      }
    }

    return updatedCount;
  }

  async getChangedPostPaths(repoRoot) {
    const { execFile } = require("child_process");

    return new Promise((resolve, reject) => {
      execFile(
        "git",
        ["-C", repoRoot, "status", "--porcelain", "--", "articles/posts"],
        { windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr.trim() || error.message));
            return;
          }

          resolve(parseGitStatusPostPaths(stdout));
        },
      );
    });
  }

  getVaultFileByPath(filePath) {
    if (typeof this.app.vault.getFileByPath === "function") {
      return this.app.vault.getFileByPath(filePath);
    }

    if (typeof this.app.vault.getAbstractFileByPath === "function") {
      return this.app.vault.getAbstractFileByPath(filePath);
    }

    return null;
  }

  async updateHistoryForCommit(file, repoRoot) {
    const original = await this.app.vault.read(file);
    const baseline = await this.getHeadFileContent(repoRoot, file.path);
    const next = updatePostHistoryForCommit(
      original,
      getLocalDateString(),
      baseline,
    );

    if (next === original) {
      return false;
    }

    await this.app.vault.modify(file, next);
    return true;
  }

  async getHeadFileContent(repoRoot, filePath) {
    const { execFile } = require("child_process");
    const repoPath = `articles/${filePath}`;

    return new Promise((resolve, reject) => {
      execFile(
        "git",
        ["-C", repoRoot, "show", `HEAD:${repoPath}`],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (!error) {
            resolve(stdout);
            return;
          }

          if (String(stderr || "").includes("exists on disk, but not in")) {
            resolve(null);
            return;
          }

          reject(new Error(stderr.trim() || error.message));
        },
      );
    });
  }

};

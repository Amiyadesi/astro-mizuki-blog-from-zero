const { Plugin, Notice, setIcon } = require("obsidian");
const {
  getLocalDateString,
  getPostContentFingerprint,
  isPostMarkdown,
  parseGitStatusPostPaths,
  updatePostHistoryForCommit,
} = createHistoryCore();
const {
  buildLocalPreviewCommand,
  buildPublishCommand,
  buildStopPreviewCommand,
  getPluginLogPath,
  getPreviewLogPath,
  getPreviewPidPath,
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
  function buildScriptCommand(vaultBasePath, scriptName, options = {}) {
    const repoRoot = getRepoRoot(vaultBasePath);
    const scriptPath = joinPath(repoRoot, "scripts", scriptName);
    const command = options.powershellCommand || "powershell.exe";
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ];

    return {
      args,
      command,
      cwd: repoRoot,
      scriptPath,
    };
  }

  function buildPublishCommand(vaultBasePath, options = {}) {
    const baseCommand = buildScriptCommand(
      vaultBasePath,
      "deploy-blog-from-obsidian.ps1",
      options,
    );
    const args = [...baseCommand.args];

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
      ...baseCommand,
      args,
    };
  }

  function buildLocalPreviewCommand(vaultBasePath, options = {}) {
    const baseCommand = buildScriptCommand(
      vaultBasePath,
      "local-preview.ps1",
      options,
    );
    const args = [...baseCommand.args];

    if (options.skipInstall === true) {
      args.push("-SkipInstall");
    }

    if (Number.isInteger(options.blogPort)) {
      args.push("-BlogPort", String(options.blogPort));
    }

    return {
      ...baseCommand,
      args,
    };
  }

  function buildStopPreviewCommand(vaultBasePath, options = {}) {
    return buildScriptCommand(vaultBasePath, "stop-preview.ps1", options);
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

  function getPreviewLogPath(vaultBasePath) {
    return joinPath(getPluginDir(vaultBasePath), "preview.log");
  }

  function getPluginLogPath(vaultBasePath) {
    return joinPath(getPluginDir(vaultBasePath), "plugin.log");
  }

  function getPreviewPidPath(vaultBasePath) {
    return joinPath(getRepoRoot(vaultBasePath), ".preview-pids.json");
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
    buildLocalPreviewCommand,
    buildPublishCommand,
    buildStopPreviewCommand,
    getPluginLogPath,
    getPreviewLogPath,
    getPreviewPidPath,
    getPublishLogPath,
  };
}

module.exports = class PostHistoryTrackerPlugin extends Plugin {
  async onload() {
    this.publishProcess = null;
    this.previewLauncherProcess = null;
    this.previewToggleBusy = false;
    this.previewRibbon = null;
    this.statusBarItem = null;
    this.vaultBasePath = "";
    this.pluginLogPath = "";
    this.publishLogPath = "";
    this.previewLogPath = "";
    this.previewPidPath = "";

    try {
      this.vaultBasePath = this.getVaultBasePath();
      this.pluginLogPath = getPluginLogPath(this.vaultBasePath);
      this.publishLogPath = getPublishLogPath(this.vaultBasePath);
      this.previewLogPath = getPreviewLogPath(this.vaultBasePath);
      this.previewPidPath = getPreviewPidPath(this.vaultBasePath);
    } catch (error) {
      this.handleStartupError("vault path", error);
    }

    this.appendPluginLog(`[${new Date().toISOString()}] plugin loaded\n`);

    try {
      this.previewRibbon = this.addRibbonIcon(
        "play",
        "启动博客预览",
        () => {
          void this.toggleLocalPreview();
        },
      );
      if (
        this.previewRibbon &&
        typeof this.previewRibbon.addClass === "function"
      ) {
        this.previewRibbon.addClass("post-history-tracker-preview-button");
      }

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
        id: "preview-blog-locally",
        name: "本地预览博客",
        callback: () => {
          void this.toggleLocalPreview();
        },
      });

      this.addCommand({
        id: "publish-blog-from-obsidian",
        name: "一键提交并推送博客",
        callback: () => {
          this.publishBlog();
        },
      });

      this.addCommand({
        id: "open-blog-site-config-hub",
        name: "打开博客站点配置入口",
        callback: () => {
          void this.openVaultPath("spec/site-config-hub.md");
        },
      });

      this.statusBarItem = this.addStatusBarItem();
      this.statusBarItem.setText("博客一键发布已加载");
      if (typeof this.statusBarItem.addClass === "function") {
        this.statusBarItem.addClass("post-history-tracker-status");
      }

      this.refreshPreviewButtonState();
      if (typeof this.registerInterval === "function") {
        this.registerInterval(
          setInterval(() => {
            this.refreshPreviewButtonState();
          }, 5000),
        );
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

  async toggleLocalPreview() {
    if (this.previewToggleBusy || this.previewLauncherProcess) {
      new Notice("博客预览正在处理中。");
      return;
    }

    const state = this.getPreviewRuntimeState();
    if (state.running) {
      await this.stopLocalPreview();
      return;
    }

    await this.startLocalPreview();
  }

  refreshPreviewButtonState() {
    const state = this.getPreviewRuntimeState();
    const isRunning = state.running;
    const icon = this.previewToggleBusy ? "loader" : isRunning ? "square" : "play";
    const label = this.previewToggleBusy
      ? "博客预览处理中"
      : isRunning
        ? "停止博客预览"
        : "启动博客预览";

    if (this.previewRibbon) {
      if (typeof setIcon === "function") {
        setIcon(this.previewRibbon, icon);
      }
      this.previewRibbon.setAttribute("aria-label", label);
      this.previewRibbon.setAttribute("title", label);
      this.previewRibbon.toggleClass?.(
        "post-history-tracker-preview-running",
        isRunning,
      );
      this.previewRibbon.toggleClass?.(
        "post-history-tracker-preview-busy",
        this.previewToggleBusy,
      );
    }

    if (this.statusBarItem) {
      this.statusBarItem.setText(
        this.previewToggleBusy
          ? "博客预览处理中"
          : isRunning
            ? "博客预览运行中"
            : "博客一键发布已加载",
      );
    }
  }

  getPreviewRuntimeState(options = {}) {
    const cleanupStale = options.cleanupStale !== false;
    const preview = this.readPreviewUrls();
    const blogPid = Number(preview.blogPid);
    const normalizedPid =
      Number.isInteger(blogPid) && blogPid > 0 ? blogPid : 0;
    const blogUrl =
      typeof preview.blogUrl === "string" ? preview.blogUrl.trim() : "";
    const running = normalizedPid > 0 && this.isProcessAlive(normalizedPid);

    if (normalizedPid > 0 && !running && cleanupStale) {
      this.removePreviewPidFile();
    }

    return {
      blogPid: normalizedPid,
      blogUrl,
      running,
    };
  }

  isProcessAlive(processId) {
    if (!Number.isInteger(processId) || processId <= 0) {
      return false;
    }

    try {
      process.kill(processId, 0);
      return true;
    } catch (error) {
      return error && error.code === "EPERM";
    }
  }

  removePreviewPidFile() {
    if (!this.previewPidPath) {
      return;
    }

    try {
      const fs = require("fs");
      if (fs.existsSync(this.previewPidPath)) {
        fs.rmSync(this.previewPidPath, { force: true });
      }
    } catch (error) {
      this.appendPreviewLog(
        `[${new Date().toISOString()}] preview pid cleanup failed: ${error.stack || error.message}\n`,
      );
    }
  }

  async waitForPreviewState(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    let lastState = this.getPreviewRuntimeState({ cleanupStale: false });

    while (Date.now() < deadline) {
      const state = this.getPreviewRuntimeState({ cleanupStale: false });
      if (state.running) {
        return state;
      }
      lastState = state;
      await this.sleep(300);
    }

    return lastState;
  }

  sleep(timeoutMs) {
    return new Promise((resolve) => {
      setTimeout(resolve, timeoutMs);
    });
  }

  async startLocalPreview() {
    if (this.publishProcess) {
      new Notice("博客正在发布中，暂时不能启动本地预览。");
      return;
    }

    if (!this.vaultBasePath) {
      new Notice("无法读取 Obsidian vault 本地路径，不能启动预览。", 10000);
      return;
    }

    const existingState = this.getPreviewRuntimeState();
    if (existingState.running) {
      this.refreshPreviewButtonState();
      if (existingState.blogUrl) {
        await this.openPreviewUrl(existingState.blogUrl);
        new Notice(`博客预览已经在运行：${existingState.blogUrl}`, 10000);
      } else {
        new Notice("博客预览已经在运行。", 7000);
      }
      return;
    }

    const previewCommand = buildLocalPreviewCommand(this.vaultBasePath);
    const { spawn } = require("child_process");
    const fs = require("fs");

    if (!fs.existsSync(previewCommand.scriptPath)) {
      new Notice(`本地预览脚本不存在：${previewCommand.scriptPath}`);
      return;
    }

    this.previewToggleBusy = true;
    this.refreshPreviewButtonState();
    this.appendPreviewLog(
      [
        "",
        `[${new Date().toISOString()}] start local preview`,
        `cwd: ${previewCommand.cwd}`,
        `command: ${previewCommand.command} ${previewCommand.args.join(" ")}`,
        "",
      ].join("\n"),
    );

    new Notice("开始本地预览：会先同步内容，缺依赖会自动安装，然后构建并启动预览服务。", 7000);

    try {
      const child = spawn(previewCommand.command, previewCommand.args, {
        cwd: previewCommand.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      this.previewLauncherProcess = child;

      child.stdout.on("data", (chunk) => {
        this.handlePreviewOutput("stdout", chunk);
      });

      child.stderr.on("data", (chunk) => {
        this.handlePreviewOutput("stderr", chunk);
      });

      await new Promise((resolve, reject) => {
        child.on("error", (error) => {
          reject(error);
        });

        child.on("close", (code) => {
          this.appendPreviewLog(
            `[${new Date().toISOString()}] preview launcher exited with code ${code}\n`,
          );

          if (code === 0) {
            resolve();
            return;
          }

          reject(new Error(`预览启动器退出码 ${code}`));
        });
      });

      const previewState = await this.waitForPreviewState();
      if (previewState.blogUrl) {
        const opened = await this.openPreviewUrl(previewState.blogUrl);
        new Notice(
          opened
            ? `本地预览已启动：${previewState.blogUrl}`
            : `本地预览已启动，但浏览器没有自动打开：${previewState.blogUrl}`,
          10000,
        );
      } else {
        new Notice("本地预览已启动。查看 preview.log。", 10000);
      }
    } catch (error) {
      this.appendPreviewLog(
        `[${new Date().toISOString()}] preview start failed: ${error.stack || error.message}\n`,
      );
      console.error("[post-history-tracker] local preview failed", error);
      new Notice(`本地预览失败：${error.message}`, 10000);
    } finally {
      this.previewLauncherProcess = null;
      this.previewToggleBusy = false;
      this.refreshPreviewButtonState();
    }
  }

  async stopLocalPreview() {
    if (!this.vaultBasePath) {
      new Notice("无法读取 Obsidian vault 本地路径，不能停止预览。", 10000);
      return;
    }

    const state = this.getPreviewRuntimeState({ cleanupStale: false });
    if (!state.running && !state.blogPid) {
      this.removePreviewPidFile();
      this.refreshPreviewButtonState();
      new Notice("博客预览已经是停止状态。", 5000);
      return;
    }

    const stopCommand = buildStopPreviewCommand(this.vaultBasePath);
    const { spawn } = require("child_process");
    const fs = require("fs");

    if (!fs.existsSync(stopCommand.scriptPath)) {
      new Notice(`停止预览脚本不存在：${stopCommand.scriptPath}`);
      return;
    }

    this.previewToggleBusy = true;
    this.refreshPreviewButtonState();
    this.appendPreviewLog(
      [
        "",
        `[${new Date().toISOString()}] stop local preview`,
        `cwd: ${stopCommand.cwd}`,
        `command: ${stopCommand.command} ${stopCommand.args.join(" ")}`,
        "",
      ].join("\n"),
    );

    try {
      const child = spawn(stopCommand.command, stopCommand.args, {
        cwd: stopCommand.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      child.stdout.on("data", (chunk) => {
        this.handlePreviewOutput("stdout", chunk);
      });

      child.stderr.on("data", (chunk) => {
        this.handlePreviewOutput("stderr", chunk);
      });

      await new Promise((resolve, reject) => {
        child.on("error", (error) => {
          reject(error);
        });

        child.on("close", (code) => {
          this.appendPreviewLog(
            `[${new Date().toISOString()}] preview stop exited with code ${code}\n`,
          );

          if (code === 0) {
            resolve();
            return;
          }

          reject(new Error(`预览停止器退出码 ${code}`));
        });
      });

      this.removePreviewPidFile();
      new Notice("博客预览已停止。", 7000);
    } catch (error) {
      this.appendPreviewLog(
        `[${new Date().toISOString()}] preview stop failed: ${error.stack || error.message}\n`,
      );
      console.error("[post-history-tracker] local preview stop failed", error);
      new Notice(`停止预览失败：${error.message}`, 10000);
    } finally {
      this.previewToggleBusy = false;
      this.refreshPreviewButtonState();
    }
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

  handlePreviewOutput(stream, chunk) {
    const text = chunk.toString();
    this.appendPreviewLog(text);
    console.log(`[post-history-tracker] preview ${stream}:`, text.trim());
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

  appendPreviewLog(text) {
    if (!this.previewLogPath) {
      console.log(`[post-history-tracker] ${text.trim()}`);
      return;
    }

    try {
      const fs = require("fs");
      const path = require("path");
      fs.mkdirSync(path.dirname(this.previewLogPath), { recursive: true });
      fs.appendFileSync(this.previewLogPath, text, "utf8");
    } catch (error) {
      console.warn("[post-history-tracker] preview log write failed", error);
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

  readPreviewUrls() {
    if (!this.previewPidPath) {
      return {};
    }

    try {
      const fs = require("fs");
      if (!fs.existsSync(this.previewPidPath)) {
        return {};
      }

      const rawJson = fs
        .readFileSync(this.previewPidPath, "utf8")
        .replace(/^\uFEFF/, "");
      const parsed = JSON.parse(rawJson);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      this.appendPreviewLog(
        `[${new Date().toISOString()}] preview pid read failed: ${error.stack || error.message}\n`,
      );
      return {};
    }
  }

  async openPreviewUrl(url) {
    if (!url) {
      return false;
    }

    this.appendPreviewLog(
      `[${new Date().toISOString()}] attempt open browser: ${url}\n`,
    );

    try {
      const { shell } = require("electron");
      if (shell && typeof shell.openExternal === "function") {
        await Promise.resolve(shell.openExternal(url));
        this.appendPreviewLog(
          `[${new Date().toISOString()}] browser opened via electron shell\n`,
        );
        return true;
      }
    } catch (error) {
      this.appendPreviewLog(
        `[${new Date().toISOString()}] electron openExternal unavailable: ${error.stack || error.message}\n`,
      );
    }

    try {
      const { spawn } = require("child_process");
      const platform = process.platform;
      if (platform === "win32") {
        const child = await this.spawnDetachedCommand("cmd", [
          "/c",
          "start",
          "",
          url,
        ]);
        if (child) {
          child.unref();
        }
        this.appendPreviewLog(
          `[${new Date().toISOString()}] browser opened via cmd start\n`,
        );
        return true;
      }

      if (platform === "darwin") {
        const child = await this.spawnDetachedCommand("open", [url]);
        if (child) {
          child.unref();
        }
        this.appendPreviewLog(
          `[${new Date().toISOString()}] browser opened via open\n`,
        );
        return true;
      }

      const child = await this.spawnDetachedCommand("xdg-open", [url]);
      if (child) {
        child.unref();
      }
      this.appendPreviewLog(
        `[${new Date().toISOString()}] browser opened via xdg-open\n`,
      );
      return true;
    } catch (error) {
      this.appendPreviewLog(
        `[${new Date().toISOString()}] preview browser open failed: ${error.stack || error.message}\n`,
      );
    }

    return false;
  }

  spawnDetachedCommand(command, args) {
    const { spawn } = require("child_process");

    return new Promise((resolve, reject) => {
      let settled = false;
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });

      child.once("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      });

      child.once("spawn", () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(child);
      });
    });
  }

  async openVaultPath(filePath) {
    const file = this.getVaultFileByPath(filePath);
    if (!file) {
      new Notice(`找不到文件：${filePath}`, 7000);
      return;
    }

    const leaf =
      this.app.workspace.getLeaf?.(true) ||
      this.app.workspace.getMostRecentLeaf?.();
    if (!leaf || typeof leaf.openFile !== "function") {
      new Notice(`无法在 Obsidian 中打开：${filePath}`, 7000);
      return;
    }

    await leaf.openFile(file);
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

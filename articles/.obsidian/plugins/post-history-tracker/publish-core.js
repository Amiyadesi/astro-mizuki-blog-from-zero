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

module.exports = {
  buildLocalPreviewCommand,
  buildPublishCommand,
  buildStopPreviewCommand,
  getPluginDir,
  getPluginLogPath,
  getPreviewLogPath,
  getPreviewPidPath,
  getPublishLogPath,
  getRepoRoot,
  joinPath,
};

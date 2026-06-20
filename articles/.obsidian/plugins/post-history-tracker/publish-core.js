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

module.exports = {
  buildPublishCommand,
  getPluginDir,
  getPluginLogPath,
  getPublishLogPath,
  getRepoRoot,
  joinPath,
};

const POSTS_PREFIX = "posts/";
const HISTORY_KEYS = ["created", "updated", "lastEdited", "updateCount"];
const HISTORY_KEY_SET = new Set(HISTORY_KEYS);

function isPostMarkdown(file) {
  return (
    file &&
    file.extension === "md" &&
    file.path.startsWith(POSTS_PREFIX) &&
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

    if (!vaultPath.startsWith(POSTS_PREFIX) || !vaultPath.endsWith(".md")) {
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

  const nextFrontmatter = applyFrontmatterUpdates(frontmatter, updates, eol);
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
      return !field || !HISTORY_KEY_SET.has(field[2]);
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

  const missing = HISTORY_KEYS.filter((key) => !present.has(key));
  if (!missing.length) {
    return lines.join(eol);
  }

  const publishedIndex = lines.findIndex((line) => /^published\s*:/.test(line));
  let insertAt = publishedIndex >= 0 ? publishedIndex + 1 : 0;

  for (const key of missing) {
    lines.splice(insertAt, 0, `${key}: ${updates[key]}`);
    insertAt++;
  }

  return lines.join(eol);
}

module.exports = {
  getLocalDateString,
  getPostContentFingerprint,
  isPostMarkdown,
  parseGitStatusPostPaths,
  updatePostHistory,
  updatePostHistoryForCommit,
};

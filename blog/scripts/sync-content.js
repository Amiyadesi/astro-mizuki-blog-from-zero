import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptFile = fileURLToPath(import.meta.url);
const blogRoot = path.resolve(path.dirname(scriptFile), "..");
const repoRoot = path.resolve(blogRoot, "..");
const articlesRoot = path.join(repoRoot, "articles");

const POSTS_SRC = path.join(articlesRoot, "posts");
const POSTS_DEST = path.join(blogRoot, "src", "content", "posts");
const IMAGES_DEST = path.join(blogRoot, "public", "images");
const POST_IMAGES_DEST = path.join(IMAGES_DEST, "posts");
const SITE_CONFIG_SRC = path.join(articlesRoot, "site");
const SITE_ASSETS_SRC = path.join(articlesRoot, "assets");
const ANIME_SRC = path.join(articlesRoot, "anime");
const PUBLIC_ASSETS_DEST = path.join(blogRoot, "public", "assets");
const ANIME_PUBLIC_DEST = path.join(PUBLIC_ASSETS_DEST, "anime");
const ANIME_DATA_DEST = path.join(blogRoot, "src", "data", "anime.ts");
const GENERATED_CONFIG_DEST = path.join(blogRoot, "src", "generated", "obsidian-config.ts");

const IMAGE_EXTS = new Set([
	".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp",
]);
const MEDIA_EXTS = new Set([
	...IMAGE_EXTS, ".mp3", ".ogg", ".wav", ".mp4", ".webm", ".pdf",
]);

const PUBLIC_WIKI_ALIASES = new Map();
const PRIVATE_WIKI_TARGETS = new Set();

const warnings = [];

if (!fs.existsSync(articlesRoot)) {
	console.warn(`[sync-content] articles 目录不存在：${articlesRoot}`);
	process.exit(0);
}

const postIndex = buildPostIndex(POSTS_SRC);

// --- Sync global images ---
const imagesSrc = path.join(articlesRoot, "images");
if (fs.existsSync(imagesSrc)) {
	fs.rmSync(IMAGES_DEST, { recursive: true, force: true });
	fs.mkdirSync(IMAGES_DEST, { recursive: true });
	copyDirectory(imagesSrc, IMAGES_DEST, { transformMarkdown: false, slug: null });
	console.log(`[sync-content] images: articles/images -> blog/public/images`);
}

// --- Sync albums ---
const albumsSrc = path.join(articlesRoot, "albums");
const albumsDest = path.join(IMAGES_DEST, "albums");
if (fs.existsSync(albumsSrc)) {
	fs.mkdirSync(albumsDest, { recursive: true });
	copyDirectory(albumsSrc, albumsDest, { transformMarkdown: false, slug: null });
	console.log(`[sync-content] albums: articles/albums -> blog/public/images/albums`);
}

// --- Sync posts (folder-per-post aware) ---
fs.rmSync(POSTS_DEST, { recursive: true, force: true });
fs.mkdirSync(POSTS_DEST, { recursive: true });

syncPosts(POSTS_SRC, POSTS_DEST, []);
console.log(`[sync-content] posts: articles/posts -> blog/src/content/posts`);

// --- Sync spec ---
const specSrc = path.join(articlesRoot, "spec");
const specDest = path.join(blogRoot, "src", "content", "spec");
if (fs.existsSync(specSrc)) {
	fs.rmSync(specDest, { recursive: true, force: true });
	fs.mkdirSync(specDest, { recursive: true });
	copyDirectory(specSrc, specDest, { transformMarkdown: true, slug: null });
	console.log(`[sync-content] spec: articles/spec -> blog/src/content/spec`);
}

// --- Sync Obsidian-managed site settings and public assets ---
syncSiteAssets();
syncAnimeData();
syncSiteConfig();

// Ensure post images directory exists for co-located assets
fs.mkdirSync(POST_IMAGES_DEST, { recursive: true });

if (warnings.length > 0) {
	console.warn("\n[sync-content] 警告：");
	for (const warning of warnings) {
		console.warn(`  - ${warning}`);
	}
}

console.log("[sync-content] done");

// ─── Posts sync (folder-per-post aware) ───────────────────────────────────────

function syncPosts(srcDir, destDir, segments) {
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const sourcePath = path.join(srcDir, entry.name);

		if (entry.isDirectory()) {
			if (isPostFolder(sourcePath, entry.name)) {
				syncPostFolder(sourcePath, destDir, [...segments, entry.name]);
			} else {
				const subDest = path.join(destDir, entry.name);
				fs.mkdirSync(subDest, { recursive: true });
				syncPosts(sourcePath, subDest, [...segments, entry.name]);
			}
			continue;
		}

		if (/\.(md|mdx)$/i.test(entry.name)) {
			const slug = [...segments, entry.name.replace(/\.(md|mdx)$/i, "")].join("/");
			const original = fs.readFileSync(sourcePath, "utf8");
			const transformed = transformMarkdown(original, sourcePath, slug);
			fs.writeFileSync(path.join(destDir, entry.name), transformed);
		}
	}
}

function isPostFolder(dirPath, dirName) {
	const entries = fs.readdirSync(dirPath);
	return entries.some(
		(e) => /\.(md|mdx)$/i.test(e) && (
			e.replace(/\.(md|mdx)$/i, "").toLowerCase() === dirName.toLowerCase() ||
			e.toLowerCase() === "index.md" || e.toLowerCase() === "index.mdx"
		),
	);
}

function syncPostFolder(srcDir, destDir, segments) {
	const dirName = segments[segments.length - 1];
	const slug = segments.map(slugify).join("/");
	const imageSegments = slug.split("/").filter(Boolean);
	const postDestDir = path.join(destDir, dirName);
	fs.mkdirSync(postDestDir, { recursive: true });

	let mainMd = null;
	const assets = [];

	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const sourcePath = path.join(srcDir, entry.name);

		if (entry.isDirectory()) {
			// Sub-directories in a post folder are asset folders
			const assetDestDir = path.join(POST_IMAGES_DEST, ...imageSegments);
			fs.mkdirSync(path.join(assetDestDir, entry.name), { recursive: true });
			copyDirectory(sourcePath, path.join(assetDestDir, entry.name), { transformMarkdown: false, slug: null });
			continue;
		}

		if (/\.(md|mdx)$/i.test(entry.name)) {
			const baseName = entry.name.replace(/\.(md|mdx)$/i, "").toLowerCase();
			if (baseName === dirName.toLowerCase() || baseName === "index") {
				mainMd = sourcePath;
			} else {
				// Additional markdown files in the folder — copy as-is
				const content = fs.readFileSync(sourcePath, "utf8");
				fs.writeFileSync(path.join(postDestDir, entry.name), transformMarkdown(content, sourcePath, slug));
			}
		} else if (MEDIA_EXTS.has(path.extname(entry.name).toLowerCase())) {
			assets.push(entry.name);
		} else {
			assets.push(entry.name);
		}
	}

	// Copy assets to public/images/posts/<slug>/
	if (assets.length > 0) {
		const assetDest = path.join(POST_IMAGES_DEST, ...imageSegments);
		fs.mkdirSync(assetDest, { recursive: true });
		for (const asset of assets) {
			fs.copyFileSync(path.join(srcDir, asset), path.join(assetDest, asset));
		}
	}

	// Write main markdown as index.md
	if (mainMd) {
		const original = fs.readFileSync(mainMd, "utf8");
		const transformed = transformMarkdown(original, mainMd, slug);
		fs.writeFileSync(path.join(postDestDir, "index.md"), transformed);
	}
}

// ─── Markdown transformation ──────────────────────────────────────────────────

function transformMarkdown(content, sourcePath, slug) {
	let result = content;
	result = convertObsidianEmbeds(result, sourcePath, slug);
	result = convertWikiLinks(result, sourcePath);
	result = normalizeImageLinks(result, slug);
	return result;
}

function convertObsidianEmbeds(content, sourcePath, slug) {
	return content.replace(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (match, target, alt) => {
		const filename = target.trim();
		const altText = (alt || filename).trim();
		const ext = path.extname(filename).toLowerCase();

		if (IMAGE_EXTS.has(ext)) {
			if (slug) {
				return `![${altText}](${publicPath("images", "posts", slug, filename)})`;
			}
			return `![${altText}](${publicPath("images", "posts", filename)})`;
		}

		if (MEDIA_EXTS.has(ext)) {
			if (slug) {
				return `[${altText}](${publicPath("images", "posts", slug, filename)})`;
			}
			return `[${altText}](${publicPath("images", "posts", filename)})`;
		}

		// Treat as wiki link to another post
		const key = normalizeLookupKey(filename);
		const resolved = postIndex.get(key);
		if (resolved) {
			return `[${altText}](/posts/${resolved}/)`;
		}

		if (isPrivateWikiTarget(filename)) {
			return altText;
		}

		warnings.push(`${path.relative(repoRoot, sourcePath)}: 无法解析嵌入 ${match}`);
		return altText;
	});
}

function convertWikiLinks(content, sourcePath) {
	return content.replace(/\[\[([^\]|#]+)?(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (match, target = "", heading = "", alias = "") => {
		const rawTarget = target.trim();
		const label = (alias || heading || rawTarget).trim();

		if (!rawTarget) {
			return label || match;
		}

		const key = normalizeLookupKey(rawTarget);
		const resolved = postIndex.get(key);

		if (!resolved) {
			if (isPrivateWikiTarget(rawTarget)) {
				return label || rawTarget;
			}

			warnings.push(`${path.relative(repoRoot, sourcePath)}: 无法解析 ${match}`);
			return label || rawTarget;
		}

		const anchor = heading ? `#${slugify(heading)}` : "";
		return `[${label || rawTarget}](/posts/${resolved}/${anchor})`;
	});
}

function normalizeImageLinks(content, slug) {
	return content.replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, (match, start, rawUrl, end) => {
		const url = rawUrl.trim();

		if (
			url.startsWith("http://") ||
			url.startsWith("https://") ||
			url.startsWith("#") ||
			url.startsWith("data:")
		) {
			return match;
		}

		if (url.startsWith("/")) {
			return `${start}${encodeInternalPath(url)}${end}`;
		}

		const normalized = url.replaceAll("\\", "/").replace(/^\.\//, "");

		// Co-located image: relative path within post folder
		if (slug && !normalized.includes("/")) {
			return `${start}${publicPath("images", "posts", slug, normalized)}${end}`;
		}

		const imagesIndex = normalized.indexOf("images/posts/");
		if (imagesIndex >= 0) {
			return `${start}${publicPath("images", "posts", normalized.slice(imagesIndex + "images/posts/".length))}${end}`;
		}

		if (normalized.startsWith("../images/")) {
			return `${start}${publicPath("images", normalized.slice("../images/".length))}${end}`;
		}

		// Relative path with directories — resolve against slug
		if (slug) {
			return `${start}${publicPath("images", "posts", slug, normalized)}${end}`;
		}

		return match;
	});
}

function publicPath(...segments) {
	return encodeInternalPath(`/${segments.join("/")}`);
}

function encodeInternalPath(value) {
	const normalized = value.replaceAll("\\", "/");
	const suffixIndex = firstSuffixIndex(normalized);
	const pathPart = suffixIndex >= 0 ? normalized.slice(0, suffixIndex) : normalized;
	const suffix = suffixIndex >= 0 ? normalized.slice(suffixIndex) : "";
	const encodedPath = pathPart
		.split("/")
		.map((segment) => segment ? encodeURIComponent(decodeURIComponentSafe(segment)) : "")
		.join("/");
	return `${encodedPath}${suffix}`;
}

function firstSuffixIndex(value) {
	const indexes = [value.indexOf("?"), value.indexOf("#")].filter((index) => index >= 0);
	return indexes.length ? Math.min(...indexes) : -1;
}

function decodeURIComponentSafe(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function copyDirectory(src, dest, options) {
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const sourcePath = path.join(src, entry.name);
		const targetPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			fs.mkdirSync(targetPath, { recursive: true });
			copyDirectory(sourcePath, targetPath, options);
			continue;
		}

		if (options.transformMarkdown && /\.(md|mdx)$/i.test(entry.name)) {
			const original = fs.readFileSync(sourcePath, "utf8");
			const transformed = transformMarkdown(original, sourcePath, options.slug);
			fs.writeFileSync(targetPath, transformed);
			continue;
		}

		fs.copyFileSync(sourcePath, targetPath);
	}
}

// ─── Site settings/assets sync ────────────────────────────────────────────────

function syncSiteAssets() {
	if (!fs.existsSync(SITE_ASSETS_SRC)) {
		return;
	}

	copyManagedAssetFolder("profile", "profile");
	copyManagedAssetFolder("banner/desktop", "desktop-banner");
	copyManagedAssetFolder("banner/mobile", "mobile-banner");
	copyManagedAssetFolder("music", "music");
	console.log("[sync-content] site assets: articles/assets -> blog/public/assets");
}

function copyManagedAssetFolder(sourceSegment, targetSegment) {
	const src = path.join(SITE_ASSETS_SRC, ...sourceSegment.split("/"));
	if (!fs.existsSync(src)) {
		return;
	}
	const dest = path.join(PUBLIC_ASSETS_DEST, ...targetSegment.split("/"));
	fs.rmSync(dest, { recursive: true, force: true });
	fs.mkdirSync(dest, { recursive: true });
	copyDirectory(src, dest, { transformMarkdown: false, slug: null });
}

function syncSiteConfig() {
	fs.mkdirSync(path.dirname(GENERATED_CONFIG_DEST), { recursive: true });

	const profile = readJson("profile.json", null);
	const banner = readJson("banner.json", null);
	const navigation = readJson("navigation.json", null);
	const announcement = readJson("announcement.json", null);
	const music = readJson("music.json", null);
	const generated = [
		"// This file is generated by blog/scripts/sync-content.js.",
		"// Edit articles/site/*.json and articles/assets/* instead.",
		'import type { AnnouncementConfig, FullscreenWallpaperConfig, MusicPlayerConfig, NavBarConfig, ProfileConfig, SiteConfig } from "../types/config";',
		'import { LinkPreset } from "../types/config";',
		'import type { Song } from "../components/widgets/music-player/types";',
		"",
		'type MusicSettingsConfig = {',
		"\tregionAware: boolean;",
		"\tshuffle: boolean;",
		'\tdefaultProvider: "auto" | "netease" | "youtube";',
		"};",
		"",
		`export const profileConfigOverride = ${toTsObject(normalizeProfileConfig(profile))} satisfies Partial<ProfileConfig>;`,
		"",
		`export const bannerConfigOverride = ${toTsObject(normalizeBannerConfig(banner))} satisfies Partial<SiteConfig["banner"]>;`,
		"",
		`export const fullscreenWallpaperConfigOverride = ${toTsObject(normalizeFullscreenWallpaperConfig(banner))} satisfies Partial<FullscreenWallpaperConfig>;`,
		"",
		`export const navBarConfigOverride = ${toTsObject(normalizeNavBarConfig(navigation))} satisfies Partial<NavBarConfig>;`,
		"",
		`export const announcementConfigOverride = ${toTsObject(normalizeAnnouncementConfig(announcement))} satisfies Partial<AnnouncementConfig>;`,
		"",
		`export const musicPlayerConfigOverride = ${toTsObject(normalizeMusicPlayerConfig(music))} satisfies Partial<MusicPlayerConfig>;`,
		"",
		`export const localPlaylistOverride = ${toTsObject(normalizeMusicTracks(music))} satisfies Song[];`,
		"",
		`export const musicSettingsOverride = ${toTsObject(normalizeMusicSettings(music))} satisfies MusicSettingsConfig;`,
		"",
	].join("\n");

	fs.writeFileSync(GENERATED_CONFIG_DEST, generated);
	console.log("[sync-content] site config: articles/site -> blog/src/generated/obsidian-config.ts");
}

function syncAnimeData() {
	if (!fs.existsSync(ANIME_SRC)) {
		return;
	}

	const statusDirs = ["watching", "completed", "planned"];
	const items = [];

	// anime 目录由 articles/anime 完整托管，先清理旧平铺封面，避免页面引用混乱。
	fs.rmSync(ANIME_PUBLIC_DEST, { recursive: true, force: true });
	fs.mkdirSync(ANIME_PUBLIC_DEST, { recursive: true });

	for (const status of statusDirs) {
		const dir = path.join(ANIME_SRC, status);
		if (!fs.existsSync(dir)) {
			continue;
		}

		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) {
				continue;
			}
			const sourcePath = path.join(dir, entry.name);
			const content = fs.readFileSync(sourcePath, "utf8");
			const frontmatter = parseFrontmatter(content);
			if (!frontmatter.title) {
				warnings.push(`${path.relative(repoRoot, sourcePath)}: 缺少 title，已忽略`);
				continue;
			}

			const normalized = normalizeAnimeItem(frontmatter, status, sourcePath);
			if (normalized.cover && !normalized.cover.startsWith("http") && !normalized.cover.startsWith("/")) {
				const assetSource = path.join(ANIME_SRC, "assets", status, normalized.cover);
				const assetDest = path.join(ANIME_PUBLIC_DEST, status, normalized.cover);
				if (fs.existsSync(assetSource)) {
					fs.mkdirSync(path.dirname(assetDest), { recursive: true });
					fs.copyFileSync(assetSource, assetDest);
					normalized.cover = `/assets/anime/${status}/${normalized.cover.replaceAll("\\", "/")}`;
				} else {
					warnings.push(`${path.relative(repoRoot, sourcePath)}: 找不到封面 ${path.relative(repoRoot, assetSource)}`);
					normalized.cover = "";
				}
			}

			items.push(normalized);
		}
	}

	if (!items.length) {
		return;
	}

	const generated = [
		"// This file is generated by blog/scripts/sync-content.js.",
		"// Edit articles/anime/**/*.md and articles/anime/assets/**/* instead.",
		"export interface AnimeItem {",
		"\ttitle: string;",
		'\tstatus: "watching" | "completed" | "planned";',
		"\trating: number;",
		"\tcover: string;",
		"\tdescription: string;",
		"\tepisodes: string;",
		"\tyear: string;",
		"\tgenre: string[];",
		"\tstudio: string;",
		"\tlink: string;",
		"\tprogress: number;",
		"\ttotalEpisodes: number;",
		"\tstartDate: string;",
		"\tendDate: string;",
		"}",
		"",
		`const localAnimeList: AnimeItem[] = ${toTsObject(items)};`,
		"",
		"export default localAnimeList;",
		"",
	].join("\n");

	fs.writeFileSync(ANIME_DATA_DEST, generated);
	console.log("[sync-content] anime: articles/anime -> blog/src/data/anime.ts");
}

function parseFrontmatter(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		return {};
	}
	const result = {};
	for (const rawLine of match[1].split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const colon = line.indexOf(":");
		if (colon < 0) {
			continue;
		}
		const key = line.slice(0, colon).trim();
		const rawValue = line.slice(colon + 1).trim();
		result[key] = parseFrontmatterValue(rawValue);
	}
	return result;
}

function parseFrontmatterValue(value) {
	if (value === "") {
		return "";
	}
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	if (value.startsWith("[") && value.endsWith("]")) {
		return value
			.slice(1, -1)
			.split(",")
			.map((item) => item.trim().replace(/^["']|["']$/g, ""))
			.filter(Boolean);
	}
	if (/^-?\d+(\.\d+)?$/.test(value)) {
		return Number(value);
	}
	return value;
}

function normalizeAnimeItem(frontmatter, status, sourcePath) {
	const itemStatus = ["watching", "completed", "planned"].includes(frontmatter.status)
		? frontmatter.status
		: status;
	if (frontmatter.status && frontmatter.status !== itemStatus) {
		warnings.push(`${path.relative(repoRoot, sourcePath)}: status 不在 watching/completed/planned 中，已使用目录 ${status}`);
	}
	return {
		title: String(frontmatter.title ?? ""),
		status: itemStatus,
		rating: Number(frontmatter.rating) || 0,
		cover: String(frontmatter.cover ?? ""),
		description: String(frontmatter.description ?? ""),
		episodes: String(frontmatter.episodes ?? ""),
		year: String(frontmatter.year ?? ""),
		genre: Array.isArray(frontmatter.genre) ? frontmatter.genre.map(String) : [],
		studio: String(frontmatter.studio ?? ""),
		link: String(frontmatter.link ?? ""),
		progress: Number(frontmatter.progress) || 0,
		totalEpisodes: Number(frontmatter.totalEpisodes) || 0,
		startDate: String(frontmatter.startDate ?? ""),
		endDate: String(frontmatter.endDate ?? ""),
	};
}

function readJson(filename, fallback) {
	const filePath = path.join(SITE_CONFIG_SRC, filename);
	if (!fs.existsSync(filePath)) {
		return fallback;
	}
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		warnings.push(`${path.relative(repoRoot, filePath)}: JSON 解析失败：${error.message}`);
		return fallback;
	}
}

function normalizeProfileConfig(profile) {
	if (!profile || typeof profile !== "object") {
		return {};
	}
	const result = pick(profile, ["name", "bio", "links", "typewriter"]);
	if (typeof profile.avatar === "string" && profile.avatar.trim()) {
		result.avatar = toPublicAssetPath("profile", profile.avatar);
	}
	return result;
}

function normalizeNavBarConfig(navigation) {
	if (!navigation || typeof navigation !== "object") {
		return {};
	}
	const links = normalizeNavLinks(navigation.links);
	return links.length ? { links } : {};
}

function normalizeNavLinks(links) {
	if (!Array.isArray(links)) {
		return [];
	}
	return links
		.map(normalizeNavLink)
		.filter((link) => link !== null);
}

function normalizeNavLink(link) {
	if (!link || typeof link !== "object" || link.visible === false) {
		return null;
	}
	if (typeof link.preset === "string") {
		const preset = normalizeLinkPreset(link.preset);
		if (preset !== null) {
			return preset;
		}
		warnings.push(`articles/site/navigation.json: 未知 preset，已忽略：${link.preset}`);
		return null;
	}
	if (typeof link.url !== "string" || !link.url.trim()) {
		warnings.push("articles/site/navigation.json: 缺少 url 的导航项已忽略");
		return null;
	}
	const result = pick(link, ["name", "url", "external", "icon"]);
	if (!result.name) {
		result.name = result.url;
	}
	const children = normalizeNavLinks(link.children);
	if (children.length) {
		result.children = children;
	}
	return result;
}

function normalizeLinkPreset(value) {
	const presetMap = {
		Home: "LinkPreset.Home",
		Archive: "LinkPreset.Archive",
		About: "LinkPreset.About",
		Friends: "LinkPreset.Friends",
		Anime: "LinkPreset.Anime",
		Diary: "LinkPreset.Diary",
		Albums: "LinkPreset.Albums",
		Projects: "LinkPreset.Projects",
		Skills: "LinkPreset.Skills",
		Timeline: "LinkPreset.Timeline",
	};
	return presetMap[value] ?? null;
}

function normalizeBannerConfig(banner) {
	if (!banner || typeof banner !== "object") {
		return {};
	}
	const desktop = normalizeAssetList(banner.desktop, "desktop-banner", "desktop");
	const mobile = normalizeAssetList(banner.mobile, "mobile-banner", "mobile");
	const result = {};
	if (desktop.length || mobile.length) {
		result.src = {};
		if (desktop.length) {
			result.src.desktop = desktop;
		}
		if (mobile.length) {
			result.src.mobile = mobile;
		}
	}
	const position = normalizePosition(banner.position);
	if (position) {
		result.position = position;
	}
	result.carousel = {
		enable: banner.carousel?.enable ?? banner.enableCarousel ?? true,
		interval: banner.carousel?.interval ?? banner.interval ?? 3,
	};
	if (banner.homeText) {
		result.homeText = banner.homeText;
	}
	if (banner.credit) {
		result.credit = banner.credit;
	}
	return result;
}

function normalizeFullscreenWallpaperConfig(banner) {
	const normalized = normalizeBannerConfig(banner);
	const result = {};
	if (normalized.src) {
		result.src = normalized.src;
	}
	if (normalized.position) {
		result.position = normalized.position;
	}
	if (normalized.carousel) {
		result.carousel = normalized.carousel;
	}
	return result;
}

function normalizeAnnouncementConfig(announcement) {
	if (!announcement || typeof announcement !== "object") {
		return {};
	}
	return pick(announcement, ["title", "content", "icon", "type", "closable", "link"]);
}

function normalizeMusicPlayerConfig(music) {
	if (!music || typeof music !== "object") {
		return {};
	}
	return {
		enable: music.enable ?? true,
		showFloatingPlayer: music.showFloatingPlayer ?? true,
		floatingEntryMode: music.floatingEntryMode ?? "fab",
		mode: "local",
	};
}

function normalizeMusicSettings(music) {
	return {
		regionAware: music?.regionAware ?? true,
		shuffle: music?.shuffle ?? true,
		defaultProvider: normalizeMusicProvider(music?.defaultProvider),
	};
}

function normalizeMusicTracks(music) {
	if (!music || !Array.isArray(music.tracks)) {
		return [];
	}
	return music.tracks.map((track, index) => ({
		id: Number.isFinite(track.id) ? track.id : index + 1,
		title: String(track.title ?? `Track ${index + 1}`),
		artist: String(track.artist ?? "Unknown Artist"),
		cover: track.cover ? toPublicAssetPath("music", track.cover) : "",
		url: track.url ? toPublicAssetPath("music", track.url) : "",
		duration: Number.isFinite(track.duration) ? track.duration : 0,
		category: track.category ?? "",
		youtube: track.youtube ?? "",
		netease: track.netease ?? "",
	}));
}

function normalizeAssetList(value, publicFolder, sourcePrefix = "") {
	const list = Array.isArray(value) ? value : value ? [value] : [];
	return list
		.filter((item) => typeof item === "string" && item.trim())
		.map((item) => toPublicAssetPath(publicFolder, stripSourcePrefix(item, sourcePrefix)));
}

function toPublicAssetPath(publicFolder, value) {
	const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
	if (normalized.startsWith("assets/")) {
		return `/${normalized}`;
	}
	if (normalized === publicFolder || normalized.startsWith(`${publicFolder}/`)) {
		return `/assets/${normalized}`;
	}
	return `/assets/${publicFolder}/${normalized}`;
}

function stripSourcePrefix(value, prefix) {
	const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
	if (!prefix) {
		return normalized;
	}
	return normalized.startsWith(`${prefix}/`)
		? normalized.slice(prefix.length + 1)
		: normalized;
}

function pick(source, keys) {
	const result = {};
	for (const key of keys) {
		if (source[key] !== undefined) {
			result[key] = source[key];
		}
	}
	return result;
}

function normalizePosition(value) {
	if (["top", "center", "bottom"].includes(value)) {
		return value;
	}
	if (value !== undefined) {
		warnings.push(`articles/site/banner.json: position 只能是 top、center、bottom，已忽略：${value}`);
	}
	return undefined;
}

function normalizeMusicProvider(value) {
	if (["auto", "netease", "youtube"].includes(value)) {
		return value;
	}
	if (value !== undefined) {
		warnings.push(`articles/site/music.json: defaultProvider 只能是 auto、netease、youtube，已回退 auto：${value}`);
	}
	return "auto";
}

function toTsObject(value) {
	return JSON.stringify(value, null, "\t")
		.replace(/"LinkPreset\.([A-Za-z]+)"/g, "LinkPreset.$1")
		.replace(/\n/g, "\n");
}

function buildPostIndex(postsDir) {
	const index = new Map();

	if (!fs.existsSync(postsDir)) {
		return index;
	}

	for (const filePath of walk(postsDir)) {
		if (!/\.(md|mdx)$/i.test(filePath)) {
			continue;
		}

		const relative = path.relative(postsDir, filePath).replaceAll("\\", "/");
		const parsed = path.parse(relative);
		const slug = toPostSlug(relative);
		const content = fs.readFileSync(filePath, "utf8");
		const title = readFrontmatterTitle(content);

		for (const key of [
			parsed.name,
			path.dirname(relative) === "." ? "" : path.basename(path.dirname(relative)),
			relative.replace(/\.(md|mdx)$/i, ""),
			title,
			...deriveTitleLookupAliases(title),
		]) {
			if (key) {
				addPostIndexKey(index, key, slug);
			}
		}
	}

	applyPublicWikiAliases(index);
	return index;
}

function* walk(dir) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const current = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(current);
		} else {
			yield current;
		}
	}
}

function toPostSlug(relativePath) {
	const withoutExt = relativePath.replace(/\.(md|mdx)$/i, "");
	const segments = withoutExt.split("/");

	if (segments.at(-1)?.toLowerCase() === "index") {
		segments.pop();
	}

	// folder-per-post: posts/foo/foo.md → slug "foo" (not "foo/foo")
	if (segments.length >= 2) {
		const last = segments[segments.length - 1].toLowerCase();
		const parent = segments[segments.length - 2].toLowerCase();
		if (last === parent) {
			segments.pop();
		}
	}

	return segments.map(slugify).join("/");
}

function slugify(value) {
	return value
		.normalize("NFKD")
		.toLowerCase()
		.trim()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizeLookupKey(value) {
	return value
		.replace(/\.(md|mdx)$/i, "")
		.replaceAll("\\", "/")
		.toLowerCase()
		.trim();
}

function addPostIndexKey(index, key, slug) {
	for (const candidate of [key, slugify(key)]) {
		const normalized = normalizeLookupKey(candidate);
		if (normalized && !index.has(normalized)) {
			index.set(normalized, slug);
		}
	}
}

function deriveTitleLookupAliases(title) {
	if (!title) {
		return [];
	}

	const aliases = new Set();
	const compact = title.replace(/\s+/g, "");
	const simplified = compact
		.replace(/^(最近的|近期的|当前的|我的|一份|关于)/, "")
		.replace(/(公开版|整理版)$/, "");

	for (const candidate of [simplified, simplified.replace(/^公开/, "")]) {
		if (candidate && candidate !== compact) {
			aliases.add(candidate);
		}
	}

	return Array.from(aliases);
}

function applyPublicWikiAliases(index) {
	for (const [alias, slug] of PUBLIC_WIKI_ALIASES) {
		if (!indexHasSlug(index, slug)) {
			continue;
		}
		addPostIndexKey(index, alias, slug);
	}
}

function indexHasSlug(index, slug) {
	for (const value of index.values()) {
		if (value === slug) {
			return true;
		}
	}
	return false;
}

function isPrivateWikiTarget(value) {
	return PRIVATE_WIKI_TARGETS.has(value.trim());
}

function readFrontmatterTitle(content) {
	const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!frontmatter) {
		return "";
	}

	const title = frontmatter[1].match(/^title:\s*(.+)$/m);
	return title ? title[1].replace(/^["']|["']$/g, "").trim() : "";
}

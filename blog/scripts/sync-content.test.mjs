import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./sync-content.js", import.meta.url));
const repoRoot = path.resolve(path.dirname(scriptPath), "..", "..");
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "blog-sync-"));

try {
	const fixtureRoot = path.join(tmpRoot, "astro-mizuki-blog-from-zero");
	const fixtureBlog = path.join(fixtureRoot, "blog");
	const fixtureArticles = path.join(fixtureRoot, "articles");

	fs.mkdirSync(path.join(fixtureBlog, "scripts"), { recursive: true });
	fs.cpSync(scriptPath, path.join(fixtureBlog, "scripts", "sync-content.js"));

	write(path.join(fixtureArticles, "posts", "hello", "hello.md"), [
		"---",
		"title: Hello",
		"published: 2026-05-29",
		"description: Test",
		"tags: [test]",
		"category: Test",
		"essay: true",
		"---",
		"",
		"hello",
	].join("\n"));
	write(path.join(fixtureArticles, "posts", "current-public-plan", "current-public-plan.md"), [
		"---",
		"title: 最近的公开计划书",
		"published: 2026-06-01",
		"description: Test",
		"tags: [test]",
		"category: Test",
		"---",
		"",
		"plan",
	].join("\n"));
	write(path.join(fixtureArticles, "posts", "diary", "2026-06-07", "2026-06-07.md"), [
		"---",
		"title: 日记：2026-06-07",
		"published: 2026-06-07",
		"description: Test",
		"tags:",
		"  - test",
		"  - diary",
		"category: Test",
		"---",
		"",
		"See [[计划书]].",
		"See [[#^answer1|block answer]].",
		"Keep inline `[[keep inline link]] ==keep inline highlight== %% keep inline comment %%`.",
		"==highlight me==",
		"%% hide me %%",
		"",
		"^answer1",
		"",
		"```md",
		"%% keep code comment %% [[keep code link]] ==keep code highlight==",
		"```",
		"",
		"~~~md",
		"%% keep tilde code comment %% [[keep tilde code link]] ==keep tilde code highlight==",
		"~~~",
	].join("\n"));
	write(path.join(fixtureArticles, "posts", "space-images", "space-images.md"), [
		"---",
		"title: Space Images",
		"published: 2026-05-29",
		"description: Test",
		"tags: [test]",
		"category: Test",
		"---",
		"",
		"![[Pasted image 20260601203747.png]]",
		"![[Pasted image 20260601203747.png|320]]",
		"![[Pasted image 20260601203747.png|A pasted screenshot|640x360]]",
		"{{spoiler:covered answer|hover hint}}",
		"{{黑幕:没有提示的文字}}",
		"",
		":::photo-grid",
		"![[Pasted image 20260601203747.png|Left caption]]",
		"![Right caption](second image.jpg)",
		":::",
	].join("\n"));
	write(path.join(fixtureArticles, "posts", "space-images", "Pasted image 20260601203747.png"), "image");
	write(path.join(fixtureArticles, "posts", "space-images", "second image.jpg"), "second image");
	write(path.join(fixtureArticles, "spec", "about.md"), "# About\n");
	write(path.join(fixtureArticles, "site", "profile.json"), JSON.stringify({
		avatar: "profile/avatar.webp",
		name: "Test Name",
		bio: "Test bio",
		links: [{ name: "Home", icon: "material-symbols:home", url: "https://example.com/" }],
	}, null, 2));
	write(path.join(fixtureArticles, "site", "banner.json"), JSON.stringify({
		desktop: ["desktop/1.webp"],
		mobile: ["mobile/1.webp"],
		interval: 7,
	}, null, 2));
	write(path.join(fixtureArticles, "site", "navigation.json"), JSON.stringify({
		links: [
			{ preset: "Home" },
			{
				name: "More",
				url: "#",
				children: [
					{ name: "Visible", url: "/visible/", icon: "material-symbols:link" },
					{ name: "Hidden", url: "/hidden/", visible: false },
				],
			},
		],
	}, null, 2));
	write(path.join(fixtureArticles, "site", "announcement.json"), JSON.stringify({
		content: "Test announcement",
		link: { enable: true, text: "Read", url: "/about/", external: false },
	}, null, 2));
	write(path.join(fixtureArticles, "site", "music.json"), JSON.stringify({
		shuffle: true,
		tracks: [
			{
				id: 1,
				title: "Test Song",
				artist: "Test Artist",
				cover: "cover/test.webp",
				url: "url/test.mp3",
				youtube: "abc123",
				netease: "123456",
			},
		],
	}, null, 2));
	write(path.join(fixtureArticles, "friends", "example-friend.md"), [
		"---",
		"id: 7",
		"title: Example Friend",
		"siteurl: https://friend.example/",
		"imgurl: avatar.webp",
		"desc: Friend site",
		"tags:",
		"  - blog",
		"  - friend",
		"---",
		"",
		"notes",
	].join("\n"));
	write(path.join(fixtureArticles, "friends", "hidden-friend.md"), [
		"---",
		"title: Hidden Friend",
		"siteurl: https://hidden.example/",
		"visible: false",
		"---",
	].join("\n"));
	write(path.join(fixtureArticles, "assets", "profile", "avatar.webp"), "avatar");
	write(path.join(fixtureArticles, "assets", "friends", "avatar.webp"), "friend-avatar");
	write(path.join(fixtureArticles, "assets", "banner", "desktop", "1.webp"), "desktop");
	write(path.join(fixtureArticles, "assets", "banner", "mobile", "1.webp"), "mobile");
	write(path.join(fixtureArticles, "assets", "music", "cover", "test.webp"), "cover");
	write(path.join(fixtureArticles, "assets", "music", "url", "test.mp3"), "audio");
	write(path.join(fixtureBlog, "public", "images", "posts", "deleted-post", "stale.png"), "stale-post-image");
	write(path.join(fixtureBlog, "public", "assets", "friends", "deleted-avatar.webp"), "stale-friend-avatar");
	write(path.join(fixtureBlog, "src", "data", "anime.ts"), [
		"const localAnimeList = [{ title: \"Old Anime\" }];",
		"export default localAnimeList;",
	].join("\n"));

	const result = spawnSync(process.execPath, [path.join(fixtureBlog, "scripts", "sync-content.js")], {
		cwd: fixtureRoot,
		encoding: "utf8",
	});

	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "profile", "avatar.webp")), "avatar");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "friends", "avatar.webp")), "friend-avatar");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "desktop-banner", "1.webp")), "desktop");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "mobile-banner", "1.webp")), "mobile");
	assert.equal(read(path.join(fixtureBlog, "public", "assets", "music", "url", "test.mp3")), "audio");
	assert.equal(
		read(path.join(fixtureBlog, "public", "images", "posts", "space-images", "Pasted image 20260601203747.png")),
		"image",
	);
	assert.equal(
		fs.existsSync(path.join(fixtureBlog, "public", "images", "posts", "deleted-post", "stale.png")),
		false,
	);
	assert.equal(
		fs.existsSync(path.join(fixtureBlog, "public", "assets", "friends", "deleted-avatar.webp")),
		false,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/!\[Pasted image 20260601203747\.png\]\(\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png\)/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="Pasted image 20260601203747\.png" width="320" \/>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="A pasted screenshot" width="640" height="360" \/>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<span class="sayori-spoiler" tabindex="0" data-tooltip="hover hint" aria-label="hover hint">covered answer<\/span>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<span class="sayori-spoiler" tabindex="0">没有提示的文字<\/span>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "space-images", "index.md")),
		/<div class="sayori-photo-grid" style="--photo-grid-columns: 2;">[\s\S]*<img src="\/images\/posts\/space-images\/Pasted%20image%2020260601203747\.png" alt="Left caption" loading="lazy" \/>[\s\S]*<figcaption>Left caption<\/figcaption>[\s\S]*<img src="\/images\/posts\/space-images\/second%20image\.jpg" alt="Right caption" loading="lazy" \/>[\s\S]*<figcaption>Right caption<\/figcaption>[\s\S]*<\/div>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "hello", "index.md")),
		/essay: true/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/See \[计划书\]\(\/posts\/current-public-plan\/\)\./,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/See \[block answer\]\(#answer1\)\./,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/<a id="answer1"><\/a>/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/<mark>highlight me<\/mark>/,
	);
	assert.doesNotMatch(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/hide me/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/%% keep code comment %% \[\[keep code link\]\] ==keep code highlight==/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/`\[\[keep inline link\]\] ==keep inline highlight== %% keep inline comment %%`/,
	);
	assert.match(
		read(path.join(fixtureBlog, "src", "content", "posts", "diary", "2026-06-07", "index.md")),
		/%% keep tilde code comment %% \[\[keep tilde code link\]\] ==keep tilde code highlight==/,
	);

	const generated = read(path.join(fixtureBlog, "src", "generated", "obsidian-config.ts"));
	assert.match(generated, /profileConfigOverride/);
	assert.match(generated, /"Test Name"/);
	assert.match(generated, /"\/assets\/profile\/avatar.webp"/);
	assert.match(generated, /"\/assets\/desktop-banner\/1.webp"/);
	assert.match(generated, /navBarConfigOverride/);
	assert.match(generated, /LinkPreset\.Home/);
	assert.match(generated, /"Visible"/);
	assert.doesNotMatch(generated, /"Hidden"/);
	assert.match(generated, /"Test announcement"/);
	assert.match(generated, /"abc123"/);
	assert.match(generated, /"123456"/);

	const generatedFriends = read(path.join(fixtureBlog, "src", "generated", "friends.ts"));
	assert.match(generatedFriends, /Example Friend/);
	assert.match(generatedFriends, /"\/assets\/friends\/avatar.webp"/);
	assert.match(generatedFriends, /"blog"/);
	assert.match(generatedFriends, /"friend"/);
	assert.match(generatedFriends, /getShuffledFriendsList/);
	assert.doesNotMatch(generatedFriends, /Hidden Friend/);

	const generatedAnime = read(path.join(fixtureBlog, "src", "data", "anime.ts"));
	assert.match(generatedAnime, /const localAnimeList: AnimeItem\[\] = \[\];/);
	assert.doesNotMatch(generatedAnime, /Old Anime/);
} finally {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function write(filePath, content) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content);
}

function read(filePath) {
	return fs.readFileSync(filePath, "utf8");
}

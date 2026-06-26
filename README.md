# Astro Mizuki Blog From Zero

Obsidian-first content workflow for an Astro/Mizuki blog.

This repository is a clean starter extracted from a real blog workflow. It is
inspired by the official Mizuki content repository, while adding:

- an `articles/` Obsidian vault for writing posts;
- a local Obsidian plugin for one-click sync, commit, and push;
- a local Obsidian preview button for starting/stopping the blog preview;
- a blog post template with edit-history fields;
- an `essay` frontmatter switch for short notes collected on a dedicated essays page;
- Obsidian-friendly spoiler blocks and side-by-side photo groups;
- a content sync script for folder-per-post Markdown and co-located assets;
- a sample Cloudflare Pages GitHub Actions workflow.

It intentionally does not include private posts, personal assets, API keys, or
production secrets.

## Repository Layout

```text
.
├─ articles/
│  ├─ posts/                         # Obsidian writing source
│  ├─ friends/                       # Friend link cards
│  ├─ templates/blog-post.md          # New post template
│  ├─ spec/about.md                   # About page
│  ├─ spec/friends.md                 # Friends page body
│  ├─ site/                           # Profile, navigation, banner, music JSON
│  ├─ assets/                         # Profile, banner, music, friend assets
│  └─ .obsidian/
│     └─ plugins/post-history-tracker # Local publish plugin
├─ blog/
│  └─ scripts/sync-content.js         # Copy into your Mizuki blog project
├─ scripts/
│  └─ deploy-blog-from-obsidian.ps1   # Sync + optional commit + optional push
└─ .github/workflows/
   └─ deploy-cloudflare-pages.yml     # Optional direct-upload workflow
```

`articles/posts/<slug>/<slug>.md` is the authoring source. Generated Mizuki
content under `blog/src/content/posts/` should not be edited by hand.

New posts start as drafts. Set `draft: false` when they are ready to publish.
Set `essay: true` for short notes that should appear on a dedicated essays page
instead of as standalone post pages. To turn an essay back into a normal post,
remove `essay: true` or set it to `false`, then sync and build again.

Useful writing syntax:

```md
{{spoiler:covered text|tooltip text}}
{{黑幕:只遮住正文}}

:::photo-grid
![[left.png|Left caption]]
![Right caption](right.png)
:::
```

The sync script emits `.sayori-spoiler`, `.sayori-photo-grid`, and
`.sayori-photo-grid-item`. Add matching styles in the Mizuki theme so spoilers
hide until hover/focus and photo groups become side-by-side on wide screens.

## How To Use

1. Create or clone your Mizuki blog code into `blog/`.
2. Keep this repository's `articles/`, `blog/scripts/sync-content.js`, and
   `scripts/deploy-blog-from-obsidian.ps1`.
3. Merge `blog/package-scripts.example.json` into `blog/package.json`.
4. Open `articles/` as an Obsidian vault.
5. Enable the local community plugin `Post History Tracker` if Obsidian asks.
6. Write posts in `articles/posts/`.
7. Run:

```powershell
.\scripts\deploy-blog-from-obsidian.ps1 -SkipInstall -CommitChanges -PushChanges
```

For local preview, use the Obsidian ribbon button:

```text
启动博客预览
```

It syncs content, builds the blog, starts the preview service, and opens:

```text
http://127.0.0.1:4173/
```

The same button becomes `停止博客预览`; click it again to stop the preview
service.

If `blog/node_modules` is missing, the first local preview installs the blog
dependencies before building. Later previews are faster because dependencies are
already present.

## Cloudflare Pages

The included workflow is optional. If you prefer the Cloudflare Dashboard Git
integration, use:

```text
Root directory: blog
Build command: pnpm install --frozen-lockfile && pnpm run build
Build output directory: dist
```

If you use the GitHub Actions workflow, add these repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_PROJECT_NAME
```

`CLOUDFLARE_API_TOKEN` should be a Cloudflare API token with Account ->
Cloudflare Pages -> Edit access. The workflow checks whether
`CLOUDFLARE_PROJECT_NAME` exists and creates that Pages project before the first
deployment if needed.

## Plugin Behavior

The Obsidian plugin adds:

- a ribbon button: `启动博客预览` / `停止博客预览`;
- a ribbon button: `一键提交并推送博客`;
- a command palette item with the same name;
- a command palette item: `打开博客站点配置入口`;
- one edit-history update per changed post at publish time only.

It calls:

```powershell
.\scripts\deploy-blog-from-obsidian.ps1 -SkipInstall -CommitChanges -PushChanges
```

Ordinary saves in Obsidian do not change `updated`, `lastEdited`, or
`updateCount`.

## Tests

```bash
npm test
```

The test suite checks that the local Obsidian plugin is loadable, that the
vault config enables it, and that the publish command points at the repository
script without running a deployment.

## Credits

- Mizuki content separation reference:
  https://github.com/matsuzaka-yuki/Mizuki-Content
- Mizuki:
  https://github.com/LyraVoid/Mizuki

## License

MIT

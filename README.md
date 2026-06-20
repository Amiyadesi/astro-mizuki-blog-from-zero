# Astro Mizuki Blog From Zero

Obsidian-first content workflow for an Astro/Mizuki blog.

This repository is a clean starter extracted from a real blog workflow. It is
inspired by the official Mizuki content repository, while adding:

- an `articles/` Obsidian vault for writing posts;
- a local Obsidian plugin for one-click sync, commit, and push;
- a blog post template with edit-history fields;
- a content sync script for folder-per-post Markdown and co-located assets;
- a sample Cloudflare Pages GitHub Actions workflow.

It intentionally does not include private posts, personal assets, API keys, or
production secrets.

## Repository Layout

```text
.
├─ articles/
│  ├─ posts/                         # Obsidian writing source
│  ├─ templates/blog-post.md          # New post template
│  ├─ spec/about.md                   # Example special page
│  ├─ site/                           # Optional site config JSON
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

## How To Use

1. Create or clone your Mizuki blog code into `blog/`.
2. Keep this repository's `articles/`, `blog/scripts/sync-content.js`, and
   `scripts/deploy-blog-from-obsidian.ps1`.
3. Install your Mizuki dependencies inside `blog/`.
4. Open `articles/` as an Obsidian vault.
5. Enable the local community plugin `Post History Tracker` if Obsidian asks.
6. Write posts in `articles/posts/`.
7. Run:

```powershell
.\scripts\deploy-blog-from-obsidian.ps1 -SkipInstall -CommitChanges -PushChanges
```

For local preview only:

```powershell
node .\blog\scripts\sync-content.js
cd blog
pnpm run dev
```

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

## Plugin Behavior

The Obsidian plugin adds:

- a ribbon button: `一键提交并推送博客`;
- a command palette item with the same name;
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

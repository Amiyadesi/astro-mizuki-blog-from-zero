# Writing Workflow

## Source Of Truth

Write posts in:

```text
articles/posts/<slug>/<slug>.md
```

The generated output is:

```text
blog/src/content/posts/<slug>/index.md
```

Do not edit generated output directly.

## Obsidian Setup

Open `articles/` as an Obsidian vault.

The starter enables:

- Properties
- Templates
- the local `post-history-tracker` community plugin

Use `articles/templates/blog-post.md` for new posts.

The post template includes:

```yaml
draft: true
essay: false
```

Use `draft: false` when a post is ready to publish. Use `essay: true` for a
short note that should be collected on the essays page instead of published as
a standalone post page. If the note later grows into a full article, change
`essay` back to `false` or remove that line, then sync and build again.

## Writing Syntax

Spoilers can be written inline:

```md
{{spoiler:covered text|tooltip text}}
{{黑幕:只遮住正文}}
```

The optional text after `|` becomes the tooltip. The generated HTML uses
`.sayori-spoiler`.

Side-by-side photos can be written as a container:

```md
:::photo-grid
![[left.png|Left caption]]
![Right caption](right.png)
:::
```

Use `:::photo-grid columns=3` for three columns. Captions come from the
Obsidian embed alias or Markdown image alt text. The generated HTML uses
`.sayori-photo-grid` and `.sayori-photo-grid-item`; add matching theme CSS if
the base blog theme does not include it yet.

## Preview

From Obsidian, click the preview ribbon icon or run:

```text
本地预览博客
```

The button starts the blog preview and opens:

```text
http://127.0.0.1:4173/
```

Click the same button again to stop the preview service.

The preview script expects `blog/package.json` to provide `build` and
`preview` scripts. `blog/package-scripts.example.json` shows the expected
entries.

## Publish

From the repository root:

```powershell
.\scripts\deploy-blog-from-obsidian.ps1 -SkipInstall -CommitChanges -PushChanges
```

From Obsidian, click the upload ribbon icon or run:

```text
一键提交并推送博客
```

## References

The official Mizuki content repository keeps content separate from code:

```text
https://github.com/matsuzaka-yuki/Mizuki-Content
```

This starter keeps that idea, but makes `articles/` an Obsidian vault and adds
a local publish plugin.

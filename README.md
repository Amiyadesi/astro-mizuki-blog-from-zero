# Sayori Lite · 我的书桌

暖纸色、橄榄绿链接、少量珊瑚色。一个能直接部署的 Astro 静态博客模板，沿用 [Amiya 的博客](https://blog.sayori.org/) 当前的简洁阅读方向。

**[使用这个模板创建自己的仓库](https://github.com/new?template_name=astro-mizuki-blog-from-zero&template_owner=Amiyadesi)**

仓库保留旧名字，方便旧链接继续使用。现在已包含完整网站，不需要再下载 Mizuki，也不依赖作者的内容仓库、R2、评论或其他服务。

## 先把网站搭起来

1. 点上面的模板按钮，用自己的账号创建仓库，例如 `my-blog`。
2. 在 Cloudflare 的 **Workers & Pages → Create application → Pages → Import an existing Git repository** 选择这个新仓库。注意选择 Pages，不是 Workers 的部署命令入口。
3. 填入下面的构建设置，再保存部署。

| 设置 | 值 |
| --- | --- |
| Production branch | `main` |
| Framework preset | `Astro` |
| Root directory | 留空，使用仓库根目录 |
| Build command | `pnpm run build` |
| Build output directory | `dist` |
| 环境变量 `NODE_VERSION` | `22` |
| 环境变量 `PNPM_VERSION` | `11.0.8` |
| 环境变量 `SITE_URL` | `https://你的项目名.pages.dev`，有自定义域名时改成正式域名 |

以后提交文章到 `main`，Cloudflare 会自动重建。**这条路线不需要 Cloudflare API Token，也不需要开启 Actions 发布。** 仓库自带的 Actions 默认只检查构建，不会重复部署。

Pages 会识别锁文件并安装依赖。若构建环境没有正确启用 pnpm，构建命令可改成 `npx --yes pnpm@11.0.8 install --frozen-lockfile && npx --yes pnpm@11.0.8 run build`。

`SITE_URL` 用于 canonical、RSS 和 sitemap。未配置时，Pages 使用构建环境的 `CF_PAGES_URL`，本地使用 `http://localhost:4321`；正式上线请设置固定生产地址，避免预览域名进入索引。非 `main` 的 Pages 构建输出 `noindex` 与禁止抓取的 robots。

## 写一篇文章

只用 GitHub 网页编辑也可以，不要求安装 Obsidian、Node 或 Git。

在仓库的 **Add file → Create new file** 输入：

```text
articles/posts/my-first-post/index.md
```

写入：

```md
---
title: 我的第一篇文章
description: 今天终于有了自己的博客。
published: 2026-10-16
draft: false
category: 日常
tags: [生活]
---

这里开始写正文。页面会自动显示标题，不用再写一次一级标题。

## 今天想记下的事

这是一个普通段落。
```

点 **Commit changes** 提交到 `main`。日期改成自己的发布日期；`draft: false` 才会发布。文章地址是 `/posts/my-first-post/`，标题可以随便改，文件夹名决定地址。

每篇文章一个文件夹，名字使用小写英文、数字和连字符；正文文件固定叫 `index.md`。本模板默认单语言，不要求每篇都补翻译。

```text
articles/
  posts/
    my-first-post/
      index.md
      desk.webp
  spec/
    about.md
    friends.md
  templates/
    blog-post.md
```

图片放在文章旁边，使用标准 Markdown 相对路径：

```md
![窗边的书桌](./desk.webp)
```

本地图片经过 Astro 处理，预留宽高；正文居中显示并限制尺寸，可点击或按 Enter 放大。不要把自己的私密笔记、Token、数据库备份或私钥放进仓库。`draft: true` 只排除网站输出，**不能隐藏公开仓库里的原文**。将来的发布日期也会排除，到了日期需要再次触发构建，不包含定时发布服务。

## 自定义

| 修改位置 | 用途 |
| --- | --- |
| `site.config.mjs` | 站名、作者、简介、头像路径、便笺、HTML 语言 |
| `articles/spec/about.md` | 关于页正文 |
| `articles/spec/friends.md` | 友链与说明，直接写 Markdown 链接 |
| `articles/posts/` | 文章与相邻图片 |
| `public/avatar.svg` | 默认头像，可以替换为自己的图片并修改配置 |
| `public/favicon.svg` | 浏览器图标 |
| `src/styles/global.css` | 颜色、正文宽度、间距 |
| `src/layouts/Base.astro` | 导航、页脚和通用页面文案 |

正文约 `72ch`，桌面 `18px`、手机 `17px`，行高 `1.85`。默认使用系统字体。包括文字文章列表、分页、按年归档、桌面侧边目录、手机固定折叠目录、图片放大、深浅主题、按需加载的 Pagefind 搜索、RSS、sitemap 和 canonical。

模板使用普通整页导航；没有音乐、宠物、统计服务、评论后台、自动翻译或付费存储。它是独立的简洁起点，不是作者生产站所有功能的复制。

## 本地预览

安装 Node.js 22.12+ 与 Git，然后在自己的仓库根目录运行：

```sh
npm install --global pnpm@11.0.8
pnpm install --frozen-lockfile
pnpm dev
```

写作预览默认在 `http://localhost:4321`。搜索索引只在构建时生成，验证搜索请使用：

```sh
pnpm run build
pnpm preview
```

打开终端显示的地址。发布前的必要检查为 `pnpm test`、`pnpm run check`、`pnpm run build`、`pnpm run verify-build`。

## 可选：用 Obsidian 写

1. 先把**自己的新仓库** clone 到本地。也可以用 GitHub Desktop 登录自己的 GitHub 后克隆。
2. 在 Obsidian 中把**仓库根目录**作为仓库打开，不是只打开 `articles/`。
3. 自带配置将附件放在当前目录，使用标准 Markdown 链接；核心 Templates 模板目录为 `articles/templates`。
4. 在 `articles/posts/文章名/` 新建 `index.md`，使用“插入模板”选择 `blog-post`。填标题、日期和正文，准备公开时把 `draft` 改成 `false`。
5. 用 GitHub Desktop 提交并 Push，或者从 Obsidian 社区插件市场安装 **Git**，作者 **Vinzent**。插件 ID 为 `obsidian-git`。安装后按插件命令提交和推送。

不用为模板注册 OAuth App。Windows 推荐 Git for Windows 自带的 Git Credential Manager；首次在终端执行 `git push` 时按浏览器提示登录自己的 GitHub，之后桌面版 Obsidian Git 复用系统 Git 凭据。GitHub Desktop 也是可选的浏览器登录方式；它的登录不保证被系统 Git 或 Obsidian 复用，插件仍需先完成系统 Git 的认证。

macOS/Linux 按 Obsidian Git 的认证文档配置系统凭据助手或 SSH。移动版插件不使用桌面系统 Git，认证限制不同，本教程不承诺一键 OAuth 或跨设备凭据同步。Git 插件是第三方插件，请自行从社区市场安装；模板不自动启用插件，也不内置登录信息。推荐先手动提交，熟悉后再自行开启自动提交。

## 可选：GitHub Actions + Cloudflare Token

适用于希望在 Actions 检查通过后才上传的人。**两条部署路线选一条。**

1. 已经连接 Pages Git 的项目，先在 Pages 的 Build / Branch control 关闭生产与预览分支自动部署，避免重复发布。也可以提前创建一个 Direct Upload Pages 项目。Direct Upload 项目不能直接切回 Git 集成。
2. 在 Cloudflare 创建自定义 API Token，只授予目标账户的 **Account → Cloudflare Pages → Edit**。不要用 Global API Key，不需要 DNS、R2 或 Workers 权限。
3. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 配置：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | 上面创建的 Token |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | 目标 Cloudflare 账户 ID |
| Variable | `CLOUDFLARE_PROJECT_NAME` | 已存在的 Pages 项目名 |
| Variable | `SITE_URL` | 正式站点完整地址，例如 `https://my-blog.pages.dev` |
| Variable | `CF_PAGES_DEPLOY` | `true`，只有主动设置才会上传 |

之后提交到 `main`，`.github/workflows/deploy-cloudflare-pages.yml` 先检查、构建，再上传同一份产物。工作流不会自行创建项目或其他 Cloudflare 资源，不给 PR 暴露部署凭据。不要把 Token 写进 YAML、Markdown 或 Obsidian 设置文件。

API Token 用于部署网站；GitHub 浏览器登录用于推送代码，两者不通用。

## 旧模板迁移

早期版本只有 `articles/` 写作脚手架，要求自行补上 Mizuki，并使用 Windows PowerShell 插件同步。现在网站源码直接位于根目录 `src/`，不再有需要同步的 `blog/`。

旧用户请先备份自己的内容，在新模板仓库中逐篇迁移为 `articles/posts/<slug>/index.md`，图片一起迁移。不要直接拉取此重构覆盖已经定制的 Mizuki。原插件的随笔、黑幕、相册分组、Obsidian `![[双链图片]]` 和文章块嵌入不属于本模板语法，迁移为标准 Markdown。旧版代码仍保留在 Git 历史里。

## 文档与许可

- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Astro 部署指南](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)
- [Actions Direct Upload 指南](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Obsidian Git 认证说明](https://github.com/Vinzent03/obsidian-git/blob/master/docs/Authentication.md)

上述部署与认证说明核对于 2026-10-16。模板代码、示例文章和 SVG 素材使用 MIT 许可，见 [LICENSE](./LICENSE)。风格参考作者目前的博客；未复制生产博客的 Apache-2.0 实现或个人内容。

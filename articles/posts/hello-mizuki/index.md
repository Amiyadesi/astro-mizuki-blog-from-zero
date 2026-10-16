---
title: 把书桌收拾好，从这里开始写
description: 一张暖纸色的书桌，只留下文章和必要的导航。
published: 2026-01-01
updated: 2026-10-16
draft: false
category: 日常
tags: [写作, 博客]
---

欢迎来到你的新博客。这里没有大幅封面和自动播放的音乐，文章就是首页最重要的内容。

这是一篇示例文章。你可以修改它，也可以删掉整个 `hello-mizuki` 文件夹，换成自己的第一篇。

## 一篇文章，一个文件夹

在 `articles/posts/` 下面新建一个文件夹，比如 `my-first-post`，把正文写进里面的 `index.md`。

图片和正文放在一起，Markdown 可以直接引用：

```md
![窗边的书桌](./desk.webp)
```

下面这张示例图也来自当前文章文件夹，点击可以放大。

![一本书和一杯茶放在暖纸色的书桌上](./desk.svg)

## 写一点，再写一点

普通段落、列表、引用和代码块都可以直接写。

> 不必一次写得很完整。能把今天想说的话留下来，就已经很好了。

- 修改 `site.config.mjs` 里的站点名字和作者。
- 修改 `articles/spec/about.md`，介绍你自己。
- 写好文章，把 `draft` 改为 `false`，再提交到 GitHub。

```js
const greeting = "你好，世界。";
console.log(greeting);
```

## 发布之后

Cloudflare Pages 连接 GitHub 后，每次推送都会重新构建。你不用再去后台点一次发布，也不用为了写文章创建 Cloudflare Token。

更详细的目录说明在仓库的 README。先写起来吧。

---
title: 友情链接
---

## 友链申请

如果你想交换友链，可以按这个格式留言：

```txt
名称：你的博客名
地址：https://example.com/
简介：一句话介绍你的博客
图标：https://example.com/avatar.webp
```

## 我的友链

友链卡片不写在这里。

真正会显示成卡片的数据放在：

```text
articles/friends/*.md
```

一个友链一个 Markdown 文件，改完后运行 `pnpm run sync-content`，脚本会生成 `blog/src/generated/friends.ts`。

## 旅行入口

- [开往 Travellings](https://www.travellings.cn/go.html)：随机前往另一个独立网站。

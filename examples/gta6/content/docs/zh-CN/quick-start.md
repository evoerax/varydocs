---
title: 快速开始
description: 从本地 VaryDocs 源码创建一个采用 GTA6 主题的 Next.js 文档站。
---

## 创建站点

在仓库根目录安装工作区依赖，再生成双语模板。向导会把打包好的 SDK 安装到新项目中。

```sh
pnpm install
pnpm create:local my-varydocs --style gta6 --language bilingual --lang zh-CN --package-manager pnpm --yes --install
cd my-varydocs
pnpm dev
```

打开本地服务的 `/zh-CN/docs/` 阅读中文文档，`/docs/` 是英文入口。

## 修改首页

编辑 `content/docs/zh-CN/index.mdx` 的 description 并保存，就能看到标题下的文字更新。英文首页在 `content/docs/en/index.mdx`。

## 构建并部署

```sh
pnpm run check
pnpm build
```

默认的静态模板会把可部署的网站导出到 `out/`。将这个目录上传到静态托管平台即可。要先添加一篇指南，请阅读[编写内容](./writing-content.mdx)。

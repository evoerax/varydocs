---
title: 命令行
description: 在终端选择模板、风格和文档语言，创建自己的文档项目。
---

## 创建项目

从准备存放项目的目录启动交互向导。示例中的命令使用 npm。

~~~bash
npx @varydocs/cli@0.1.0 --lang zh-CN init my-varydocs --install
cd my-varydocs
npm run dev
~~~

模板决定新项目的起始内容。入门模板（`starter`）包含开始使用、组件示例和配置指南三页。空白模板（`blank`）从一页 Markdown 首页开始。两种模板都可以搭配向导中的通用风格或主题风格，主题风格包括复古桌面和 GTA6。建站后可以保留正文，通过切换风格改变布局、字体和配色。

站点语言可以选英文、简体中文或中英双语。

## 安装本地包

在本地 VaryDocs 源码目录运行以下命令。

~~~bash
pnpm create:local my-varydocs --lang zh-CN
~~~

选择模板、风格、导航布局、语言和包管理器。安装依赖后，进入新项目目录，运行向导提示的预览命令。再次安装时保留生成项目中的 vendor/varydocs 目录即可使用同一批本地包。

## 在脚本中使用

~~~bash
pnpm create:local my-varydocs --lang zh-CN --template starter --style editorial \
  --layout topbar --language bilingual --package-manager pnpm --yes --install
~~~

用 `varydocs check` 校验文档、链接和多语言路由。用 `varydocs build` 构建可部署的静态站点。

## 切换风格

在已创建的文档项目中，通过本地 CLI 选择内置风格。

~~~bash
pnpm exec varydocs add style swiss
~~~

命令会更新 `varydocs.json` 中的 `style`，开发服务器运行时会自动刷新。新建的 CLI 项目再次运行 `npm run build` 后，导出的站点只包含 Swiss 主题及其样式。手动修改配置中的 `style` 也会生效。

## 选择导航布局

`varydocs.json` 中的 `layout` 控制文档导航和站点操作的位置。它可以搭配所选风格，并应用于站点的所有语言。

- `theme` 是默认值，沿用所选主题原有的布局。
- `topbar` 将站点操作固定在顶部，文档导航放在正文旁。
- `sidebar` 将站点操作固定在左栏上方，下方的页面列表独立滚动。

创建项目时也可以通过 `varydocs init --layout` 选择布局。

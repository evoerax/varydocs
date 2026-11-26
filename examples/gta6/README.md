# VaryDocs GTA6 theme

A bilingual documentation site built with React, Vite and the GTA6 theme. Open the introduction, follow a guide or search for a heading. The language switch takes you to the same page in English or Simplified Chinese.

Run these commands from the VaryDocs repository root.

```sh
pnpm install
pnpm dev:gta6
```

Follow the local URL printed by Vite. English is at `/` and Chinese is at `/zh-CN/`. Run `pnpm build` from the repository root for a production build in `examples/gta6/dist/`. When hosting this Vite build, serve `index.html` for document routes so deep links work.

The [entry point](./main.jsx) imports the theme and its stylesheet. Edit the [English](./content/docs/en/) and [Chinese](./content/docs/zh-CN/) sources, then restart the dev command to recompile them. The [configuration](./varydocs.json) groups the pages. Both Vite examples use the [same React host](../vite-embed/render-docs.jsx) for routing, search and language switching.

The introduction and writing guide each use an AI-generated illustration created for this example. Both files are in [public/art](./public/art/). To use your own artwork, edit the image paths and alt text in both languages. To remove both images, delete the introduction’s figure, the writing guide’s image example and the unused WebP files.

## 中文

在 VaryDocs 仓库根目录运行上面的两条命令，然后打开终端中的地址。`/zh-CN/` 是中文入口。可以在页头切换同一篇文档的语言，也可以搜索“页首信息”，直接定位到对应章节。

修改 `content/docs/` 下的 Markdown 或 MDX 后，重启开发命令即可重新编译。若要将示例部署到静态托管，运行 `pnpm build`，上传 `examples/gta6/dist/`，并将文档页面路径回退到 `index.html`。

简介和编写内容两页各引用一张为此示例生成的 AI 插画，文件存放在 [public/art](./public/art/)。替换时，在中英文正文中更新图片路径和替代文本。移除时，删除简介中的 figure、写作指南的图片示例和不用的 WebP 文件即可。

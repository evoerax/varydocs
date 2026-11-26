# VaryDocs

[English](README.md)

VaryDocs 是一套用于文档的开源 React 组件库。一篇 Markdown 或 MDX 可以交给不同的布局渲染。你可以在现有产品里只用一个标签页组件，也可以把一套内容做成带导航、搜索和多语言路由的独立文档站。

## 从哪里开始

| 你要做什么 | 使用入口 | 可运行的参考 |
| --- | --- | --- |
| 在已有 React 页面加标签页、步骤或可复制的代码块 | 从 `@varydocs/react/components/<name>` 导入组件和对应 CSS | [React 接入指南](packages/core/docs/zh-CN/react.md) |
| 在已有 React 应用里嵌入整本文档 | 用 `@varydocs/core` 在构建时编译内容，用 `@varydocs/react/view` 渲染当前页面和主题 | [完整 Vite 示例](examples/vite-embed/main.jsx) |
| 给已有 Next.js 项目增加文档路由 | 用 Next.js 页面加载器接入 App Router 的静态参数、元数据和页面渲染，再为阅读器选择主题 | [单主题模板示例](packages/cli/templates/base/lib/docs.jsx) · [页面与搜索路由](packages/cli/templates/base/app) |
| 从头建一个可以独立部署的站点 | 运行 CLI 向导，选择 Starter 或 Blank、风格和语言 | [CLI 指南](packages/core/docs/zh-CN/cli.md) |

### 使用公开发行包

使用 Node.js 22.12 或更高版本。下面的 npm 命令需要 0.1.0 已正式发布。也可以[直接从源码建站](#从本地源码运行)。

~~~sh
npx @varydocs/cli@0.1.0 init my-varydocs --lang zh-CN --install
cd my-varydocs
npm run dev
~~~

已有 React 19 项目只用 Tabs 时，安装 `npm install @varydocs/react@0.1.0`，再按下文示例导入组件和 CSS。Vite 嵌入整站时加装构建期的 `@varydocs/core`。发行验收使用 Node.js 22.12 起、pnpm 10、npm 10 或 11、React 19.2.8 和 Next.js 16.4.6。可选助手要求 React 19.2.1 以上的 19.x 版本。[贡献与问题反馈](CONTRIBUTING.md)

### 从本地源码运行

在仓库根目录使用 Node.js 22.12 或更高版本和 pnpm 10，即可运行双语 React 示例。

~~~sh
pnpm install --frozen-lockfile
pnpm dev
~~~

在仓库根目录运行 `pnpm dev:gta6`，可以体验 GTA6 主题的漫画标题、霓虹粉导航和暖纸色正文。双语示例在文章中展示了插画。[GTA6 示例](examples/gta6/README.md)

要创建新站，在已安装依赖的仓库根目录运行以下命令。默认模板会把示例文档放进生成项目，开发服务器会给出访问地址。

~~~sh
pnpm create:local my-varydocs --lang zh-CN --install
cd my-varydocs
npm run dev
~~~

`--lang zh-CN` 设置向导语言。站点语言在向导里单独选择，支持英文、简体中文和双语。源码启动器会把本地 SDK 包放进生成项目的 `vendor/varydocs/`，移动项目时请带上这个目录。在新项目中运行 `npm run check` 校验内容与链接，运行 `npm run build` 导出可以静态托管的 `out/`。

## 开源交付范围

这些包在同一个 pnpm monorepo 中开发，首版共用版本号。SDK、CLI、内置风格、模板、示例和随包发布的中英文开发指南使用 MIT 许可证。GTA6 主题随附的字体使用 SIL 开放字体许可证。官网的品牌素材、风格库和试玩界面由官网项目维护。开发者可以只靠本仓库完成编写、预览、构建和部署。[MIT 许可证](LICENSE)

| 包 | 职责 |
| --- | --- |
| `@varydocs/model` | 编译器和阅读器共享的清单类型、路径函数和内置主题标识。这个包没有运行时依赖。 |
| `@varydocs/core` | 在构建时校验内容与文档内链接，按语言生成页面清单、目录、搜索数据和逐页加载的模块。浏览器端可从 `/model` 使用路径与数据模型。 |
| `@varydocs/react` | 提供文档阅读器、可单独引入的组件与样式表，以及八种内置主题。现有项目可传入自己的布局和组件映射。 |
| `@varydocs/next` | 把编译结果挂到现有 Next.js 16 App Router 应用，复用 React 阅读器。React 包与 Next.js 适配器的 React peer 版本均为 19。 |
| `@varydocs/cli` | 提供交互式建站、内容校验、开发预览、构建和内置风格切换。Starter 包含示例页面，Blank 从一页 Markdown 开始。 |
| `@varydocs/ai` | 可选的提问侧边栏与服务端接口，根据当前语言和页面检索本站文档，并返回可打开的来源。 |

## 给文档加上 AI 侧边栏

在 `init` 建站命令中加入 `--assistant` 即可启用助手。从源码运行可用 `pnpm create:local my-varydocs --assistant --lang zh-CN --language bilingual --install`。读者可以从搜索旁打开助手，围绕当前页面提问、追问并跳到引用的小节。配置模型后，通过 Vercel AI SDK 流式回答。没有密钥时，仍可查阅相关文档摘录。启用助手的模板包含 Next.js 服务端接口。[配置模型与接入静态站点](packages/core/docs/zh-CN/assistant.md)

## 按需使用与扩展

例如，给已有 React 项目加一组命令标签页，只需引入标签页入口和它的样式表。

~~~tsx
import { Tab, Tabs } from '@varydocs/react/components/tabs';
import '@varydocs/react/components/tabs.css';

export function BuildCommands() {
  return (
    <Tabs>
      <Tab title="npm"><code>npm run build</code></Tab>
      <Tab title="pnpm"><code>pnpm build</code></Tab>
    </Tabs>
  );
}
~~~

七类组件入口是 `appearance`、`callout`、`tabs`、`steps`、`code-block`、`copy-button` 和 `search`。只使用一种风格时，从 `@varydocs/react/view` 引入阅读器，再导入对应主题及其 CSS。

建站向导提供六种通用风格（Minimal、Editorial、Terminal、Swiss、Brutalism、Blueprint）和两种主题风格（GTA6、复古桌面）。复古桌面把侧栏文件树、文档搜索和代码块呈现为桌面窗口。在已有 CLI 项目中运行 `pnpm exec varydocs add style desktop` 即可切换。[单主题示例与自定义布局](packages/core/docs/zh-CN/styling.mdx)

新建的 CLI 项目只打包当前风格的布局及其样式。若要给旧版全主题模板启用这项优化，先一并更新 SDK 和 CLI，再把新模板的主题导入和阅读器接入代码合并到自己的 `lib/docs.jsx` 中。[模板源码](packages/cli/templates/base/lib/docs.jsx)

文档作者可以在 MDX 中使用已注册的组件和字面量属性。自定义组件的 JavaScript 写在宿主应用中，文档内的模块导入和 JavaScript 表达式会在编译时被拒绝。翻译文件分别放在各语言目录下，每种语言有自己的导航和搜索索引。[开始写文档](packages/core/docs/zh-CN/index.mdx)

内置风格默认跟随系统浅色或深色。页头的外观控件也可手动选择并记住偏好。双语模板在页头提供当前文档的译文链接。从站点根路径进入时优先采用上次选择的语言，其次匹配浏览器语言。直接打开文档链接会保留该链接指定的语言。

## 静态部署与旧模板升级

静态站在构建时设置公开域名和部署前缀。将 `out/` 内的文件部署到对应路径，并让托管服务把缺失文件交给 `404.html`，返回 HTTP 404。配置域名后，页面会输出 canonical 和已有译文的 hreflang，站点地图位于该前缀下的 `sitemap.xml`。启用 AI 的整站使用 `npm run build` 和 `npm start`；静态前端可单独部署助手接口，密钥放在服务端。

~~~sh
VARYDOCS_SITE_URL=https://docs.example.com VARYDOCS_BASE_PATH=/product npm run build
~~~

从旧版单语 Starter 升级为双语时：

1. 一起升级现有的 VaryDocs 依赖和开发依赖。如果项目由源码创建，用同一份源码重新打包并更新项目里的安装包和锁文件。
2. 保留各页相对路径，将原正文移到 `content/docs/en/`，把中文首页及译文放到 `content/docs/zh-CN/`。在 `varydocs.json` 中增加 `i18n`，保留现有站点设置。
3. 执行 `npm run check` 和 `npm run build`，检查两种语言首页和同路径译文。CLI 会为生成项目补齐缺失的语言路由。对自己改写过的首页和文档布局，按当前模板手动合并 SEO 导出。缺少翻译的页面会给出另一种语言的文档首页链接。

如果项目已有 `app/[lang]` 之类的顶层动态路由，请将该参数统一为 `[locale]`，并同步修改代码里的 `params` 引用。自定义语言首页、文档路由或搜索路由时，把文件放在 `app/[locale]` 下对应的模板路径。Next.js 匹配 URL 时会忽略路由组目录，同一 URL 的两份路由文件会造成冲突。

```json
{ "defaultLocale": "en", "locales": [{ "id": "en", "label": "English" }, { "id": "zh-CN", "label": "简体中文" }] }
```

上例是 `varydocs.json` 中 `i18n` 字段的值。

## 本地验收

`pnpm test` 检查编译、CLI 和按需打包，`pnpm build` 构建 SDK 和 Vite 示例。安装 Python 3 后，以下命令会用本地发行包创建双语站点，依次构建 Swiss、GTA6、复古桌面和 Editorial，验证静态页面、主题字体、搜索索引和子路径部署。脚本也会检查示例插画没有进入 React 安装包和 CLI 站点，验证独立安装 Tabs，并通过本地 HTTP 检查 AI 助手的中英文摘录和章节链接。

~~~sh
pnpm pack:local
node scripts/smoke-release.mjs
~~~

`pnpm check:pack` 核对发行包的入口、依赖与字体许可。八种主题的键盘与无障碍测试、搜索网络请求、包体测量和千页构建基线见[本地发行验收记录](RELEASE-CHECKLIST.zh-CN.md)。

# VaryDocs 0.1.0 本地候选版本验收

本次验收范围是六个开源包、CLI 建站模板和两个 Vite 示例。候选包来自同一份 checkout，使用者路径从临时空目录开始。本文保留首次公开发布前的执行顺序、复现命令和测试边界。

验收矩阵覆盖 Node.js 22.12.0 和 24、npm 及 pnpm 10.31.0。使用锁文件安装、运行自动化测试，再从六个本地发行包建站。模板使用 React 19.2.8、Next.js 16.4.6。

## P0 验收

| 项目 | 验收证据 |
| --- | --- |
| 旧单语站升级双语 | 从已生成的单语项目迁移既有正文，保留用户改过的首页和布局。运行路由冲突和自定义路由回归。真实构建分别部署到根路径和子路径，检查两种语言的页面、对应译文、缺译回退及搜索 JSON。[CLI 测试](tests/cli.test.mjs) · [升级演练](scripts/verify-site-upgrade.mjs) |
| MDX 章节链接 | Callout、Tabs 内的中文标题和重名标题使用与渲染结果一致的 ID。目录、搜索、AI 来源都能指向原文，直接打开深链和再次点击同一锚点均可展开正确的 Tab。[内容测试](tests/docs.test.mjs) · [阅读器测试](scripts/verify-reader.mjs) |
| 文档链接检查 | 检查相对 Markdown 文件、文档目录式链接、锚点与来自 public 的根相对静态图片。删除目标时 CLI 返回非零并给出文件和目标，补齐图片后开发服务器自动重新编译。宿主绝对路由与站外 URL 由宿主负责。[内容指南](packages/core/docs/zh-CN/index.mdx) · [开发模式回归](tests/cli.test.mjs) |
| 八种风格与两种导航布局 | 用同一篇含长中文标题、宽表格、长代码、Callout 和 Tabs 的文章，分别在 1360 × 900 和 375 × 812 验证。逐风格检查系统明暗变化、手动选择、刷新后记忆和恢复跟随系统。验证侧栏独立滚动、固定控件、章节链接以及接入宿主路由的侧栏链接。[阅读器测试](scripts/verify-reader.mjs) · [React 测试](tests/react.test.mjs) |
| 全新安装和升级说明 | 中英文覆盖交互建站、独立 Tabs、Vite 嵌入和 Next.js 静态部署，说明 MDX 边界与 AI 服务端要求。首版六个包各带自己的安装包 README。[英文](README.md) · [中文](README.zh-CN.md) · [贡献与问题反馈](CONTRIBUTING.md) |
| 实际包交付 | 六份 tarball 验证入口、类型、CSS 引用、CLI 可执行文件、内部依赖版本、MIT 和三个字体文件对应的 OFL。项目安装分别覆盖 npm 与 pnpm，静态站不安装 AI SDK，独立 Tabs 不安装编译器。连续 Swiss → GTA6 → Retro Desktop → Editorial 构建检查 JS、CSS 和旧字体是否清除。[验包](scripts/check-packs.mjs) · [端到端演练](scripts/smoke-release.mjs) |
| AI 助手 | 从发行包生成中英双语助手站点，验证 SSE、正文引用、使用量、限流和反馈。浏览器检查悬浮与拼接切换、跨页章节链接、保留会话、带新页面上下文的追问和清空对话。专项测试验证页面摘要和章节追问的补查范围。[模型替身及浏览器回归](scripts/verify-assistant-server.mjs) · [服务端测试](tests/assistant-server.test.mjs) |

## P1 验收

- **国际化与部署。** 中文默认导航使用中文分组，缺少译文时链接到目标语言的文档首页。显式设置 `VARYDOCS_SITE_URL` 和可选的 `VARYDOCS_BASE_PATH` 后，导出的 canonical、hreflang、sitemap 与实际可访问页面对应。缺页和缺失译文 URL 返回 404，搜索无匹配和助手中断可显示中文反馈。
- **检索质量。** 针对切换已有站点的风格、单独引入 Tabs、配置模型、配置语言、静态导出和自定义布局，使用内置开发指南作为语料，为每道题标注目标章节。普通搜索与实际助手检索接口均达到英文首条/前三 6/6、中文首条/前三 6/6，无关问题返回空。该结果衡量这组固定问题的章节召回，不代表任意用户问题的准确率。[双语样本与断言](tests/search-quality.test.mjs)
- **按需加载。** 两个生产 Vite 示例分别走英文、简体中文路径。只读页面请求索引 0 次，首次搜索只取当前语言 1 次，同页再次打开新增请求 0 次。[网络请求验证](scripts/verify-search-load.mjs)
- **反馈与维护。** 六个包的源码与反馈链接均指向 `evoerax/varydocs`。仓库包含中英文贡献说明、问题复现模板、变更记录和 CI。[问题模板](.github/ISSUE_TEMPLATE/bug.yml) · [Changelog](CHANGELOG.md)

### 视觉和辅助技术

桌面与窄屏分别留存八种风格截图。阅读区保持在视口之内，长代码在代码框内滚动，宽表格有独立可聚焦区域。根据中文截图调整了 GTA6 小节标题的描边及表头换行。GTA6 的字体仅用于相应风格，示例插画仅随示例内容交付。

独立无头 Chromium 验证了导航、Tabs 方向键、搜索和 AI 的打开、Esc 关闭与焦点归还，以及助手请求失败后重试。axe-core 扫描八种风格的两种视口和深色页面，也检查搜索结果和助手错误态。每个风格另有可访问性树快照，包含中文标题层级、按钮名称、选中的 Tab、表格区域和列头。截图和快照由 `pnpm qa:reader` 写入 `.varydocs/reader-qa/`。辅助技术记录来自 Chromium 可访问性树，尚未用 VoiceOver 或 NVDA 实机听读。

### 性能基线

2026-11-26 在本地使用 Node 24.15.0、Vite 生产压缩和 gzip level 9 测量。按需入口外置 React 与 React DOM。下表列出 gzip 字节数，字体列为已压缩的 WOFF2 文件原始字节数。单风格入口包含阅读器、该风格和搜索。全风格入口使用默认聚合阅读器。

| 入口 | JS gzip | CSS gzip | 字体 |
| --- | ---: | ---: | ---: |
| 单独 Tabs | 1,776 B | 344 B | 0 B |
| Swiss 阅读器 | 7,570 B | 4,543 B | 0 B |
| GTA6 阅读器 | 7,872 B | 6,677 B | 68,572 B |
| 全风格阅读器 | 8,556 B | 9,948 B | 68,572 B |

包含 React 的 GTA6 生产示例入口 JS 为 70,166 B gzip，HTML 另声明预加载 JS 557 B gzip 和入口 CSS 6,722 B gzip。按需加载的搜索 JSON 分别为英文 1,802 B 和中文 2,125 B gzip。上述入口数字不含随后加载的正文模块和文内图片。

合成语料包含 1,000 篇 Markdown、每篇四个小节，加上页面自身共 5,000 条索引记录，未压缩 JSON 为 2,208,707 B。本机一次测量中首次编译 739 ms，修改一页后全量重建 617 ms。当前实现仍做全量内容分析。这组数字可用于同机比较。大型 MDX 站点和实际托管环境需要独立测量。[复现脚本](scripts/measure-release.mjs)

## 复现本地验收

在仓库根目录执行。首次运行阅读器测试需要下载独立测试用 Chromium。交互式 CLI 演练依赖 Python 3。

```sh
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level=high
pnpm test
pnpm build
pnpm pack:local
pnpm check:pack
pnpm exec playwright install --only-shell chromium
VARYDOCS_SMOKE_ASSISTANT_BROWSER=1 node scripts/smoke-release.mjs
pnpm qa:reader
pnpm qa:search
pnpm bench:release
```

可选助手的生产服务验收在本地以无密钥模式检查 SSE、来源链接、语言、无匹配和错误输入，模型流用测试替身验证。公开仓库与 npm 发布由项目所有者决定。正式上架后，运行 `node scripts/smoke-release.mjs --registry` 验证注册表中用户实际安装到的版本。

## 后续版本

文档版本快照与重定向、OpenAPI 参考页与试调、第三方主题 registry 和更多主题，按首批用户反馈继续迭代。

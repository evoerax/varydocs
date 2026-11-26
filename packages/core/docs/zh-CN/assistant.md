---
title: 文档 AI 助手
description: 让读者根据当前页面提问，阅读流式回答，并跳转到对应语言的文档原文。
---

## 创建带助手的文档站

在已安装依赖的源码仓库中运行以下命令。

~~~sh
pnpm create:local my-varydocs --assistant --style swiss --lang zh-CN --language bilingual --yes --install
cd my-varydocs
npm run dev
~~~

打开中文文档，从搜索旁点击**问 AI**。先选一个推荐小节，再问「能举个例子吗？」，助手会继续查阅这个小节。想换话题时，在下一条问题里写明新主题即可。

用关闭按钮左边的布局图标在悬浮窗口和右侧并排之间切换。站点会记住选择，空间较窄时使用悬浮窗口。点击回答中的章节链接，文档会跳到原文标题，对话和草稿仍留在侧栏。接着提问时，助手会使用跳转后的页面。

回答过程中可以点**停止回答**，再点**重试**重新提问。关闭助手会停止当前回答，并保留对话。有消息时，顶栏显示**新对话**按钮。点击后会结束当前回答并清空历史，输入框里还没发出的草稿会保留。

## 启用模型回答

要启用模型生成的回答，在 Next.js 服务端环境或生成项目的 `.env.local` 中设置环境变量 `AI_GATEWAY_API_KEY` 和 `VARYDOCS_AI_MODEL`，然后重启服务。模型 ID 使用自己的 Vercel AI Gateway 账户支持的值。密钥只保存在服务端。未配置模型时，助手会显示带原文链接的文档摘录。

浏览器向 `POST /api/ask/` 发送对话、当前页面 ID 和语言。服务端从该语言的索引中选择相关小节，作为模型的参考资料。回答会逐步显示，来源链接根据文档清单生成。

部署时运行 `npm run build`，然后用 `npm start` 或支持 Next.js 路由处理器的平台运行站点。公开启用模型时，读者提问会消耗站点的模型额度，请在部署平台设置相应的访问和用量限制。

## 启用文档补查

若模型支持工具调用，在生成站点的服务端设置环境变量 `VARYDOCS_AI_DOCUMENT_SEARCH=1` 并重启，即可打开自动补查。第一轮资料不全时，助手可以调整关键词，在当前语言的文档索引中再查一次。新找到的章节链接也会根据文档清单核对。

## 接入已有站点

在应用中安装 `@varydocs/ai`，把入口放入阅读器的 `headerActions`。这个示例通过本站的 `/api/ask/` 访问服务端。

~~~jsx
import { AskAI } from '@varydocs/ai';
import '@varydocs/ai/styles.css';

<DocsView {...props} theme={theme} headerActions={
  <AskAI endpoint="/api/ask/" locale={props.manifest.locale}
    pageId={props.page.id} pageTitle={props.page.title}
    headings={props.page.headings.map(heading => heading.title)} />
} />
~~~

要支持并排和跨页保留对话，在文档路由的上层用 `@varydocs/ai` 的 `AssistantLayout` 包裹阅读器。把路由器的导航函数传给 `navigate`，跨页时保留这个布局。

前端可以继续静态托管。使用独立的服务端运行 AI 助手接口，再把前端同源的 `/api/ask/` 路径代理到该服务。在独立服务中从 `@varydocs/ai/server` 导入 `createDocsChatHandler`，传入编译生成的 `locales`、`searchByLocale` 和 `defaultLocale`。若使用其他模型供应商，给可选的 `model` 参数传入对应的 Vercel AI SDK 模型。使用支持工具调用的模型时，在处理器选项中设置 `searchDocumentation: true` 可以启用补查。

如果站点部署在 `/product/` 这样的子路径下，将按钮的接口地址设为 `/product/api/ask/`，并给处理器传入相同的部署前缀 `basePath: '/product'`。处理器会把该前缀加到引用链接中。

## 查看用量和评分

CLI 生成的助手每个服务进程默认每分钟接受 30 条聊天请求，可用服务端的 `VARYDOCS_AI_REQUESTS_PER_MINUTE` 调整。超过上限时接口返回 HTTP 429 和 `Retry-After`。多个实例共用上限时，请在部署网关限流。

回答完成后，读者可提交「有用」或「没用」评分。部署者可在服务端日志查看带 `[varydocs:assistant]` 前缀的 JSON。用量事件区分模型调用、摘录与无匹配，并记录耗时、结果和供应商返回的 token。评分可用 `responseId` 关联用量事件。此日志仅记录结构化指标和文档标识。已有站点可在处理器的 `operations.onEvent` 回调中把事件送到自己的收集服务。

每条回答接受一次评分，同一评分的重试只记录一次。近期回答标识由产生回答的实例保留，多实例部署可用会话亲和性把聊天和评分发送到同一实例。

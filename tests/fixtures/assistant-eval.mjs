// Paired reader tasks use the bundled SDK guides in packages/core/docs.
// Each expected source supports an expected fact. A matching link alone
// cannot pass the answer. Review the generated claims against the cited text.
export const assistantEvalCases = [
  {
    id: 'standalone-tabs',
    pageId: 'index',
    turns: [{
      en: {
        question: 'How do I use just the Tabs component in an existing React app? Which imports do I need, and do I need the MDX compiler?',
        expectedSources: ['react#import-a-component'],
        expectedFacts: [
          'Import Tabs and Tab from @varydocs/react/components/tabs and import @varydocs/react/components/tabs.css.',
          'The standalone component can be used without installing @varydocs/core or compiling MDX.',
        ],
      },
      'zh-CN': {
        question: '已有 React 项目只想用 Tabs，需要导入什么？还要安装 MDX 编译器吗？',
        expectedSources: ['react#按需引入组件'],
        expectedFacts: [
          '从 @varydocs/react/components/tabs 导入 Tabs 和 Tab，并导入 @varydocs/react/components/tabs.css。',
          '单独用这个组件时无需安装 @varydocs/core 或编译 MDX。',
        ],
      },
    }],
  },
  {
    id: 'static-to-assistant',
    pageId: 'index',
    turns: [{
      en: {
        question: 'How do I export the default documentation site for static hosting, and where are the files written?',
        expectedSources: ['index#export-the-site'],
        expectedFacts: [
          'Run npm run build in the generated project. The default template puts the static site in out/.',
        ],
      },
      'zh-CN': {
        question: '默认模板怎么导出成可静态托管的文档站，文件生成到哪里？',
        expectedSources: ['index#导出文档站'],
        expectedFacts: [
          '在生成的项目里运行 npm run build，默认模板把静态站点写到 out/。',
        ],
      },
    }, {
      en: {
        question: 'If I keep that frontend on a static host, where should the assistant API run and how should the frontend reach it?',
        expectedSources: ['assistant#use-the-sidebar-on-an-existing-site'],
        expectedFacts: [
          'A separate service runs createDocsChatHandler. The static frontend can proxy its same-origin /api/ask/ path to that service.',
        ],
        forbiddenFacts: ['The server endpoint can run inside out/ using a static file host alone.'],
      },
      'zh-CN': {
        question: '如果前端继续静态托管，AI 助手接口要在哪里运行，前端怎么接过去？',
        expectedSources: ['assistant#接入已有站点'],
        expectedFacts: [
          '独立服务运行 createDocsChatHandler。静态前端可将同源 /api/ask/ 代理到该服务。',
        ],
        forbiddenFacts: ['直接上传 out/ 到纯静态主机就能运行问答接口。'],
      },
    }, {
      en: {
        question: 'What changes if the site lives under /product/, and which environment variables are needed to get generated answers rather than excerpts?',
        expectedSources: ['assistant#use-the-sidebar-on-an-existing-site', 'assistant#enable-generated-answers'],
        expectedFacts: [
          'Include the deployment prefix in the browser endpoint, and pass the same basePath to the handler for links.',
          'The provided Next.js template enables generated answers when AI_GATEWAY_API_KEY and VARYDOCS_AI_MODEL are configured on the server.',
        ],
        forbiddenFacts: ['Put AI_GATEWAY_API_KEY in browser code or an environment variable exposed to the frontend.'],
      },
      'zh-CN': {
        question: '如果挂在 /product/ 子路径下要改什么？想要模型回答而不是摘录，要设置哪些环境变量？',
        expectedSources: ['assistant#接入已有站点', 'assistant#启用模型回答'],
        expectedFacts: [
          '前端接口地址加上部署前缀，并给处理器传同样的 basePath，让引用链接正确。',
          '随包的 Next.js 模板使用服务端 AI_GATEWAY_API_KEY 和 VARYDOCS_AI_MODEL 启用模型回答。',
        ],
        forbiddenFacts: ['把 AI_GATEWAY_API_KEY 放进浏览器代码或暴露给前端的环境变量。'],
      },
    }],
  },
  {
    id: 'follow-up-after-topic-change',
    pageId: 'styling',
    turns: [{
      en: {
        question: 'How do I switch an existing VaryDocs site to Retro Desktop?',
        expectedSources: ['styling#change-a-style'],
        expectedFacts: [
          'Run pnpm exec varydocs add style desktop from the project, or set style to desktop in varydocs.json.',
        ],
      },
      'zh-CN': {
        question: '已有的 VaryDocs 站点如何换到复古桌面风格？',
        expectedSources: ['styling#切换风格'],
        expectedFacts: [
          '在项目中运行 pnpm exec varydocs add style desktop，或在 varydocs.json 中设置 style 为 desktop。',
        ],
      },
    }, {
      en: {
        question: 'Different question: where do I configure multiple languages in an existing React integration?',
        expectedSources: ['react#configure-languages'],
        expectedFacts: [
          'In varydocs.json set i18n.defaultLocale and i18n.locales, then use a content/docs/ subfolder per language.',
          'Use matching source paths to switch languages on the corresponding page.',
        ],
      },
      'zh-CN': {
        question: '换个问题，已有的 React 接入中要在哪里配置多语言？',
        expectedSources: ['react#配置多语言'],
        expectedFacts: [
          '在 varydocs.json 配置 i18n.defaultLocale 和 i18n.locales，并为各语言使用 content/docs/ 下的单独目录。',
          '让对应译文的文件路径一致，切换语言时能留在同一页。',
        ],
      },
    }, {
      en: {
        question: 'Can you give me an example?',
        expectedSources: ['react#configure-languages'],
        expectedFacts: [
          'The example still illustrates multilingual configuration and shows two languages with matching relative page paths, such as content/docs/en/setup.mdx and content/docs/zh-CN/setup.mdx.',
        ],
        forbiddenFacts: ['Switch back to the earlier Retro Desktop topic without providing a localization example.'],
      },
      'zh-CN': {
        question: '能举个例子吗？',
        expectedSources: ['react#配置多语言'],
        expectedFacts: [
          '示例仍在讲多语言，用两个语言目录中的同路径页面说明，例如 content/docs/en/setup.mdx 和 content/docs/zh-CN/setup.mdx。',
        ],
        forbiddenFacts: ['只回到之前的复古桌面话题，未给出多语言示例。'],
      },
    }],
  },
  {
    id: 'mdx-anchor',
    pageId: 'react',
    turns: [{
      en: {
        question: 'I am linking from another Markdown file to a heading inside a Callout. What does the link look like, and how is the second heading with the same title named?',
        expectedSources: ['index#write-a-page'],
        expectedFacts: [
          'Use a path relative to the source file and a heading fragment, for example ./guide/index.md#install or ./guide/#install.',
          'The compiler handles headings inside Callout. A repeated heading starts with suffix -1, for example #install-1.',
        ],
        forbiddenFacts: ['The second occurrence starts at -2.'],
      },
      'zh-CN': {
        question: '从另一个 Markdown 文件链接到 Callout 里的小节，链接怎么写？遇到第二个同名标题，锚点怎么命名？',
        expectedSources: ['index#写一篇文档'],
        expectedFacts: [
          '链接使用相对于源文件的路径和小节片段，例如 ./guide/index.md#安装 或 ./guide/#安装。',
          '编译器可以处理 Callout 里的标题。重复标题后缀从 -1 开始，例如 #安装-1。',
        ],
        forbiddenFacts: ['第二个同名标题的后缀从 -2 开始。'],
      },
    }],
  },
  {
    id: 'unsupported-provider-sla',
    pageId: 'assistant',
    turns: [{
      en: {
        question: 'What maximum response latency does the AI Gateway guarantee in its SLA, and what percentage refund do I get if it is missed?',
        expectedSources: [],
        unanswerable: true,
        expectedFacts: [
          'The SDK guides do not give a Gateway SLA or a refund policy. The answer should say so without inventing figures.',
        ],
        forbiddenFacts: ['A specific SLA, a guaranteed response time, or a refund percentage asserted as fact.'],
      },
      'zh-CN': {
        question: 'AI Gateway 的服务协议保证最长响应多久？超时可以拿到百分之多少的退款？',
        expectedSources: [],
        unanswerable: true,
        expectedFacts: [
          'SDK 指南没有说明 Gateway 的 SLA 或退款政策。应明确说明文档缺少这些依据。',
        ],
        forbiddenFacts: ['把具体 SLA、承诺响应时长或退款比例当成已知事实。'],
      },
    }],
  },
];

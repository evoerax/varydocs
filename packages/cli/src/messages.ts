export type CliLanguage = 'en' | 'zh-CN';

const en = {
  description: 'Create and build a VaryDocs documentation site.',
  lang: 'Language for CLI messages',
  language: 'Site languages',
  init: 'Create a documentation site from a built-in template.',
  dev: 'Compile content and start the Next.js development server.',
  build: 'Compile content and build the Next.js site.',
  add: 'Apply a built-in style to this project.',
  chooseStyle: 'Select the documentation style in varydocs.json.',
  selectedStyle: (id: string) => 'Selected the ' + id + ' style.',
  check: 'Validate configuration, content, document links and localized routes.',
  port: 'Port for the dev server',
  host: 'Address for the dev server',
  open: 'Create a VaryDocs site',
  directory: 'Project directory',
  missingDirectory: 'Enter a project directory.',
  template: 'Template',
  starter: 'Starter',
  starterHint: 'Quickstart, example components, and navigation',
  blank: 'Blank',
  blankHint: 'An index page and a small project skeleton',
  style: 'Documentation style',
  styleCategories: { general: 'General styles', themed: 'Themed styles' },
  styles: { minimal: 'Minimal', editorial: 'Editorial', terminal: 'Terminal', swiss: 'Swiss', brutalism: 'Brutalism', blueprint: 'Blueprint',
    gta6: 'GTA6', desktop: 'Retro Desktop' },
  styleHints: { minimal: 'Clear navigation', editorial: 'Long-form reading', terminal: 'Monospace layout',
    swiss: 'Red accents and modular columns', brutalism: 'Bold yellow and black type', blueprint: 'Blue drafting grid',
    gta6: 'Inked headlines and neon-pink navigation', desktop: 'File browser, document finder and code windows' },
  layout: 'Navigation layout',
  layouts: { theme: 'Theme default', topbar: 'Fixed top bar', sidebar: 'Left sidebar' },
  layoutHints: { theme: 'Use the selected style’s layout', topbar: 'Site controls stay across the top',
    sidebar: 'Search and scrolling navigation on the left, site controls at the top right' },
  packageManager: 'Package manager',
  assistant: 'Add the Ask AI sidebar and its Next.js server endpoint',
  assistantPrompt: 'Enable the AI assistant? (Requires a Next.js server)',
  localPackages: 'Use VaryDocs packages from this directory',
  localPackageMissing: 'Missing local package. Run pnpm pack:local to create',
  install: 'Install dependencies?',
  installOption: 'Install the generated project’s dependencies',
  skipInstall: 'Skip dependency installation',
  yes: 'Yes',
  no: 'No',
  defaults: 'Use defaults for unanswered prompts',
  cancelled: 'Setup cancelled.',
  emptyDirectory: 'Choose an empty project directory',
  created: 'Created',
  next: 'Open the project directory and run',
  then: ', then ',
  dependenciesMissing: 'Install the project dependencies before running',
  conflictingLocaleParameter: (path: string) =>
    `Cannot add multilingual routes under app/[locale] because ${path} already defines a different dynamic parameter at the same URL depth. ` +
    'Rename the existing directory to [locale] and update its route parameters before enabling multiple languages.',
  conflictingLocaleEntry: (path: string, destination: string) =>
    `Cannot add multilingual routes because ${path} resolves to the same URL as ${destination}. ` +
    'Give the custom route a different URL before enabling multiple languages.',
  conflictingLocaleGroup: (path: string, destination: string) =>
    `Cannot add multilingual routes because ${path} resolves to the same URL as ${destination}. ` +
    `Move the custom route to ${destination} before enabling multiple languages.`,
  checked: (count: number) => 'Checked ' + count + ' pages.',
  compiled: (count: number) => 'Compiled ' + count + ' pages.',
  updated: (count: number) => 'Updated ' + count + ' pages.',
};
export type CliMessages = typeof en;

const zh: CliMessages = {
  description: '创建并构建 VaryDocs 文档站。',
  lang: '命令行显示语言',
  language: '文档语言',
  init: '使用内置模板创建文档站。',
  dev: '编译内容并启动 Next.js 开发服务器。',
  build: '编译内容并构建 Next.js 站点。',
  add: '将内置风格应用到当前项目。',
  chooseStyle: '在 varydocs.json 中选择文档风格。',
  selectedStyle: id => '已切换为 ' + id + ' 风格。',
  check: '校验配置、内容、文档链接和多语言路由。',
  port: '开发服务器端口',
  host: '开发服务器监听地址',
  open: '创建 VaryDocs 文档站',
  directory: '项目目录',
  missingDirectory: '请输入项目目录。',
  template: '模板',
  starter: '入门',
  starterHint: '含快速开始、示例组件和文档导航',
  blank: '空白',
  blankHint: '含首页和基础项目结构',
  style: '文档风格',
  styleCategories: { general: '通用风格', themed: '主题风格' },
  styles: { minimal: '极简', editorial: '编辑', terminal: '终端', swiss: '瑞士风格', brutalism: '粗野主义', blueprint: '蓝图',
    gta6: 'GTA6', desktop: '复古桌面' },
  styleHints: { minimal: '清晰的文档导航', editorial: '适合长篇阅读', terminal: '等宽字体布局',
    swiss: '模块网格与朱红色标记', brutalism: '亮黄底色与粗黑字', blueprint: '工程蓝图与细线网格',
    gta6: '漫画标题与霓虹粉导航', desktop: '文件侧栏、文档查找和代码窗口' },
  layout: '导航布局',
  layouts: { theme: '风格默认', topbar: '固定顶栏', sidebar: '左侧栏' },
  layoutHints: { theme: '使用所选风格的布局', topbar: '站点操作固定在顶部', sidebar: '左侧搜索和独立滚动的文档列表，右上站点操作' },
  packageManager: '包管理器',
  assistant: '启用文档问答侧边栏和 Next.js 服务端接口',
  assistantPrompt: '启用 AI 助手？（需要 Next.js 服务端）',
  localPackages: '使用此目录中的 VaryDocs 本地安装包',
  localPackageMissing: '缺少本地安装包，请运行 pnpm pack:local 生成',
  install: '现在安装依赖？',
  installOption: '安装生成项目的依赖',
  skipInstall: '跳过依赖安装',
  yes: '是',
  no: '否',
  defaults: '其余选项使用默认值',
  cancelled: '已取消创建。',
  emptyDirectory: '请选择空项目目录',
  created: '已创建',
  next: '进入项目目录后运行',
  then: '，然后运行 ',
  dependenciesMissing: '请先安装项目依赖，再运行',
  conflictingLocaleParameter: path =>
    `无法在 app/[locale] 下添加多语言路由。${path} 在同一 URL 层级使用了不同的动态参数。` +
    '请将该目录改名为 [locale]，并更新代码里的 params 引用，再启用多语言。',
  conflictingLocaleEntry: (path, destination) =>
    `无法添加多语言路由。${path} 与 ${destination} 对应同一个 URL。请先为自定义路由换一个 URL，再启用多语言。`,
  conflictingLocaleGroup: (path, destination) =>
    `无法添加多语言路由。${path} 与 ${destination} 对应同一个 URL。请先将自定义路由移到 ${destination}，再启用多语言。`,
  checked: count => '已检查 ' + count + ' 个页面。',
  compiled: count => '已编译 ' + count + ' 个页面。',
  updated: count => '已更新 ' + count + ' 个页面。',
};

export function cliLanguage(): CliLanguage {
  const flag = process.argv.findIndex(arg => arg === '--lang' || arg.startsWith('--lang='));
  const requested = flag >= 0 ? (process.argv[flag].split('=')[1] ?? process.argv[flag + 1]) : undefined;
  const locale = requested ?? process.env.VARYDOCS_LANG ?? process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? 'en';
  return /^zh(?:[-_.]|$)/iu.test(locale) ? 'zh-CN' : 'en';
}

export function cliMessages(language: CliLanguage) {
  return language === 'zh-CN' ? zh : en;
}

import type { AppearanceLabels } from './components/appearance.js';

const en = {
  skip: 'Skip to content',
  pages: 'Pages',
  navigation: 'Documentation',
  outline: 'On this page',
  pagination: 'Previous and next pages',
  previous: 'Previous',
  next: 'Next',
  note: 'Note',
  table: 'Data table',
  examples: 'Examples',
  copyCode: 'Copy code',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  search: 'Search',
  searchTitle: 'Search documentation',
  close: 'Close',
  searchPlaceholder: 'Type a word or phrase',
  searchError: 'Search couldn’t load. Close and reopen to retry.',
  searchLoading: 'Loading search…',
  searchHint: 'Try a page title or a topic.',
  searchKeyboardHint: 'Use ↑ and ↓ to move between results, then press Enter to open one.',
  noResults: 'No results for “{query}”.',
};

const zh: DocMessages = {
  skip: '跳到正文',
  pages: '文档导航',
  navigation: '文档导航',
  outline: '本页目录',
  pagination: '上一篇与下一篇',
  previous: '上一篇',
  next: '下一篇',
  note: '提示',
  table: '数据表格',
  examples: '示例',
  copyCode: '复制代码',
  copy: '复制',
  copied: '已复制',
  copyFailed: '复制失败',
  search: '搜索',
  searchTitle: '搜索文档',
  close: '关闭',
  searchPlaceholder: '输入关键词',
  searchError: '搜索加载失败。关闭后重新打开即可重试。',
  searchLoading: '正在加载搜索…',
  searchHint: '试着输入文档标题或关键词。',
  searchKeyboardHint: '用 ↑ 和 ↓ 选择结果，按回车打开。',
  noResults: '没有找到“{query}”。',
};

export type DocMessages = typeof en & { appearance?: AppearanceLabels };

export function getMessages(locale: string, overrides?: Partial<DocMessages>): DocMessages {
  const defaults = locale === 'zh' || locale.toLowerCase().startsWith('zh-') ? zh : en;
  return overrides ? { ...defaults, ...overrides } : defaults;
}

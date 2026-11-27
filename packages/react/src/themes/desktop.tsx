import { isValidElement } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { CodeBlock } from '../components/code-block.js';
import { standardComponents } from './components.js';
import type { DocTheme, LayoutSlots, ThemeHeaderProps } from './types.js';

function isChinese(locale: string) {
  return /^zh(?:-|$)/iu.test(locale);
}

function DesktopHeader({ brand, actions }: ThemeHeaderProps) {
  return <header className="dt-header dt-desktop-header">
    <div className="dt-desktop-brand"><span className="dt-desktop-app-icon" aria-hidden="true" />{brand}</div>
    <div className="dt-header-actions">{actions}</div>
  </header>;
}

function DesktopLayout({ navigation, article, outline, context }: LayoutSlots) {
  return <div className="dt-layout dt-layout-desktop">
    <div className="dt-desktop-files">
      <div className="dt-desktop-titlebar">
        <span className="dt-desktop-folder" aria-hidden="true" />
        {isChinese(context?.locale ?? '') ? '文档文件' : 'Files'}
      </div>
      {navigation}
    </div>
    <div className="dt-desktop-reader">
      <div className="dt-desktop-titlebar">
        <span className="dt-desktop-file" aria-hidden="true" />
        <bdi>{context?.sourcePath || context?.pageTitle}</bdi>
      </div>
      <div className="dt-desktop-content" data-outline={outline ? '' : undefined}>{article}{outline}</div>
    </div>
  </div>;
}

function DesktopCodeBlock(props: ComponentPropsWithoutRef<'pre'>) {
  const code = isValidElement<{ className?: string }>(props.children) ? props.children.props : undefined;
  const language = code?.className?.match(/(?:^|\s)language-([\w+#.-]+)/u)?.[1];
  return <div className="dt-desktop-command">
    <div className="dt-desktop-command-title" aria-hidden="true">
      <span>›_</span>{language}
    </div>
    <CodeBlock {...props} />
  </div>;
}

export const desktopTheme = {
  id: 'desktop',
  Header: DesktopHeader,
  SidebarHeader: DesktopHeader,
  Layout: DesktopLayout,
  messages: locale => isChinese(locale)
    ? { search: '查找文档', searchTitle: '查找文档' }
    : { search: 'Find in docs', searchTitle: 'Find in docs' },
  components: { ...standardComponents, pre: DesktopCodeBlock },
} satisfies DocTheme;

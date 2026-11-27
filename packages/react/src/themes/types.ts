import type { ComponentType, ElementType, ReactNode } from 'react';
import type { DocMessages } from '../messages.js';

export interface ThemePageContext {
  locale: string;
  pageTitle: string;
  pageId: string;
  sourcePath?: string;
  groups: { label: string; pages: { id: string; title: string; href: string }[] }[];
}

export interface ThemeHeaderProps {
  brand: ReactNode;
  actions: ReactNode;
  context: ThemePageContext;
}

export interface LayoutSlots {
  navigation: ReactNode;
  article: ReactNode;
  outline: ReactNode;
  context?: ThemePageContext;
}

export interface DocTheme {
  id: string;
  Layout: ComponentType<LayoutSlots>;
  Header?: ComponentType<ThemeHeaderProps>;
  /** In sidebar layout, receives the brand and search while the reader renders site actions on the right. */
  SidebarHeader?: ComponentType<ThemeHeaderProps>;
  messages?: (locale: string) => Partial<DocMessages>;
  components: Record<string, ElementType>;
}

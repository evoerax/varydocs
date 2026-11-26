'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { getMessages } from './messages.js';
import type { DocMessages } from './messages.js';

const LanguageContext = createContext({ locale: 'en', messages: getMessages('en') });

export function DocsLanguage({ locale, messages, children }: { locale: string; messages?: DocMessages; children: ReactNode }) {
  return <LanguageContext.Provider value={{ locale, messages: messages ?? getMessages(locale) }}>{children}</LanguageContext.Provider>;
}

export function useDocsLanguage() {
  return useContext(LanguageContext);
}

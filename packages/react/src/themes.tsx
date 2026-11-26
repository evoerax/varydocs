import { minimalTheme } from './themes/minimal.js';
import { editorialTheme } from './themes/editorial.js';
import { terminalTheme } from './themes/terminal.js';
import { swissTheme } from './themes/swiss.js';
import { brutalismTheme } from './themes/brutalism.js';
import { blueprintTheme } from './themes/blueprint.js';
import { gta6Theme } from './themes/gta6.js';
import { desktopTheme } from './themes/desktop.js';
import type { builtinStyles } from '@varydocs/model';
import type { DocTheme } from './themes/types.js';

export const themes = {
  minimal: minimalTheme,
  editorial: editorialTheme,
  terminal: terminalTheme,
  swiss: swissTheme,
  brutalism: brutalismTheme,
  blueprint: blueprintTheme,
  gta6: gta6Theme,
  desktop: desktopTheme,
} satisfies Record<(typeof builtinStyles)[number]['id'], DocTheme>;

export function getTheme(id: string): DocTheme {
  if (!Object.hasOwn(themes, id)) throw new Error('Unknown VaryDocs style: ' + id);
  return themes[id as keyof typeof themes];
}

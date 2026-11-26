import { stat } from 'node:fs/promises';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import GithubSlugger, { slug } from 'github-slugger';
import type { Element, Root } from 'hast';
import { toString } from 'hast-util-to-string';
import { SKIP, visit } from 'unist-util-visit';
import { pagePath } from './model.js';
import type { DocPage, SearchDocument } from './model.js';

const headingTag = /^h[1-6]$/u;

export interface SectionLink {
  from: string;
  to: DocPage;
  fragment: string;
}

export interface DocumentIndex {
  bySource: Map<string, DocPage>;
  bySlug: Map<string, DocPage>;
  anchors: Map<DocPage, Set<string>>;
  links: SectionLink[];
  search: SearchDocument[];
}

// Literal MDX tags normally bypass the host's Markdown link/image components.
// Use the same URL and heading pipeline for both spellings.
function normalizeMarkup(tree: Root) {
  visit(tree, (node, index, parent) => {
    if ((node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') ||
        !node.name || !/^(?:img|a|h[1-6])$/u.test(node.name) || !parent || index == null) return;
    const properties: Element['properties'] = {};
    for (const attribute of node.attributes) {
      if (attribute.type !== 'mdxJsxAttribute' || typeof attribute.name !== 'string') return;
      if (attribute.value != null && typeof attribute.value !== 'string') return;
      properties[attribute.name] = attribute.value ?? true;
    }
    parent.children[index] = { type: 'element', tagName: node.name, properties, children: node.children, position: node.position };
  });
}

function collectSections(tree: Root, page: DocPage, anchors: Set<string>, search: SearchDocument[]) {
  const slugger = new GithubSlugger();
  visit(tree, node => {
    let id: unknown;
    if (node.type === 'element') id = node.properties.id;
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && /^[a-z]/u.test(node.name ?? '')) {
      const attribute = node.attributes.find(attribute => attribute.type === 'mdxJsxAttribute' && attribute.name === 'id');
      if (attribute?.type === 'mdxJsxAttribute') id = attribute.value;
    }
    if (typeof id === 'string' && id) {
      if (anchors.has(id)) throw new Error('Duplicate anchor #' + id);
      anchors.add(id);
    }
  });

  let section: SearchDocument = { id: page.id, title: page.title, text: page.description ?? '' };
  const text: string[] = [];
  function finishSection() {
    section.text = (section.text + ' ' + text.join('')).trim();
    search.push(section);
    text.length = 0;
  }
  visit(tree, node => {
    if (node.type === 'text') {
      text.push(node.value);
    } else if (node.type === 'element') {
      if (headingTag.test(node.tagName)) {
        finishSection();
        const title = toString(node).trim();
        let id = node.properties.id;
        if (typeof id !== 'string' || !id) {
          const base = slug(title) || 'section';
          do { id = slugger.slug(base); } while (anchors.has(id));
          node.properties.id = id;
          anchors.add(id);
        }
        page.headings.push({ id, title, level: Number(node.tagName[1]) });
        section = { id: page.id, anchor: id, title: page.title, section: title, text: '' };
        return SKIP;
      }
      // Adjacent paragraphs inside MDX components do not always have whitespace nodes.
      if (['p', 'li', 'pre', 'td', 'th', 'br'].includes(node.tagName)) text.push(' ');
    }
  });
  finishSection();
}

function decode(value: string, from: string) {
  try { return decodeURIComponent(value); }
  catch { throw new Error('Invalid URL encoding in ' + from + ': ' + value); }
}

function checkDocLink(node: Element, href: string, from: DocPage, index: DocumentIndex) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/)/iu.test(href)) return;
  const [, path, suffix] = /^([^?#]*)(.*)$/u.exec(href)!;
  const hash = suffix.indexOf('#');
  const fragment = hash < 0 ? '' : decode(suffix.slice(hash + 1), from.sourcePath);
  let target: DocPage | undefined = from;
  if (path) {
    const pathname = decode(path, from.sourcePath);
    const resolved = posix.normalize(posix.join(posix.dirname(from.sourcePath), pathname));
    const route = resolved.replace(/\/$/u, '').replace(/^\.$/u, '').normalize('NFC').toLowerCase();
    target = index.bySource.get(resolved) ?? index.bySlug.get(route);
    if (!target) {
      const isDoc = /\.mdx?$/iu.test(pathname) ||
        (route !== '..' && !route.startsWith('../') && !posix.extname(route));
      if (isDoc) throw new Error('Missing document linked from ' + from.sourcePath + ': ' + href);
      return;
    }
    node.properties.href = pagePath(target) + suffix;
    node.properties.dataVarydocsRoute = true;
  }
  if (fragment) index.links.push({ from: from.sourcePath, to: target, fragment });
}

async function checkPublicImage(publicDir: string, src: string, from: string) {
  const path = decode(src.split(/[?#]/u, 1)[0], from);
  // Extensionless image endpoints can be provided by the host application.
  if (!posix.extname(path)) return;
  const target = resolve(publicDir, '.' + path);
  const within = relative(publicDir, target);
  if (within && within !== '..' && !within.startsWith('..' + sep) && !isAbsolute(within)) {
    try {
      if ((await stat(target)).isFile()) return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
  }
  throw new Error('Missing public image in ' + from + ': ' + src);
}

export async function analyzePage(tree: Root, page: DocPage, publicDir: string, index: DocumentIndex) {
  normalizeMarkup(tree);
  collectSections(tree, page, index.anchors.get(page)!, index.search);
  const images = new Set<string>();
  visit(tree, 'element', node => {
    const { href, src } = node.properties;
    if (node.tagName === 'a' && typeof href === 'string') checkDocLink(node, href, page, index);
    if (node.tagName === 'img' && typeof src === 'string' && src.startsWith('/') && !src.startsWith('//')) images.add(src);
  });
  await Promise.all([...images].map(src => checkPublicImage(publicDir, src, page.sourcePath)));
}

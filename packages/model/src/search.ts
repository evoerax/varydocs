import type { SearchDocument } from './index.js';

const stopWords: Record<string, Set<string>> = {
  en: new Set(('a an and are as at be by can could do does for from how i in is it me my of on or ' +
    'if its please should than that the this to what where which with would you your').split(' ')),
  zh: new Set('的 我 我们 你 为什么 什么 有 是 在 了 要 和 吗 如何 怎么 怎样 可以 请 请问 一个 一下 能 个'.split(' ')),
};

// Match the common vocabulary shared by documentation authors and readers.
const equivalentTerms = [
  ['theme', 'style'], ['switch', 'change'], ['风格', '主题'], ['切换', '更换'],
];

function forms(word: string) {
  const singular = /^[a-z]{3,}s$/u.test(word) ? word.slice(0, -1) : word;
  return equivalentTerms.find(group => group.includes(singular)) ?? [word];
}

function termPosition(word: string) {
  // Short technical words such as AI and API also occur inside "plain" and "capital".
  const token = /^[a-z]{1,3}$/u.test(word)
    ? new RegExp('(?<![\\p{Script=Latin}\\p{N}])' + word + 's?(?![\\p{Script=Latin}\\p{N}])', 'u') : undefined;
  return (value: string) => token ? value.search(token) : value.indexOf(word);
}

function fallbackWords(text: string) {
  // Older browsers without Intl.Segmenter still support Unicode property escapes.
  const groups = text.replace(/(\p{Script=Han}+)/gu, ' $1 ').match(/[\p{L}\p{N}_]+/gu) ?? [];
  return groups.flatMap(word => {
    if (!/^\p{Script=Han}/u.test(word)) return word;
    const chars = Array.from(word);
    return chars.length === 1 ? chars : chars.slice(1).map((char, i) => chars[i] + char);
  });
}

export function createDocumentSearch(documents: SearchDocument[], locale: string) {
  // Standalone React hosts may pass a POSIX locale name or a custom label.
  let language = 'en';
  try { language = Intl.getCanonicalLocales(locale.replaceAll('_', '-'))[0] ?? 'en'; } catch {}
  const stop = stopWords[language.split('-')[0]];
  const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase(language);
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(language, { granularity: 'word' }) : undefined;
  function words(text: string) {
    const terms = segmenter ? Array.from(segmenter.segment(text)).filter(part => part.isWordLike).map(part => part.segment)
      : fallbackWords(text);
    return [...new Set(terms.filter(term => !stop?.has(term)))];
  }

  const entries = documents.map(doc => {
    const title = normalize(doc.title);
    const section = normalize(doc.section ?? '');
    return { doc, title, section, body: normalize(doc.text.trim()), headingWords: words(section || title).map(forms) };
  });

  return function search(query: string, preferredPageId?: string) {
    const queryWords = words(normalize(query).trim()).slice(0, 32).map(forms);
    if (!queryWords.length) return [];

    const matchers = queryWords.map(alternatives => alternatives.map(termPosition));
    const frequency = queryWords.map(() => 0);
    const candidates = entries.map(entry => {
      let offset = Infinity;
      const weights = matchers.map((positions, i) => {
        const inHeading = positions.some(position => position(entry.section) >= 0);
        const inTitle = positions.some(position => position(entry.title) >= 0);
        let inBody = false;
        for (const position of positions) {
          const at = position(entry.body);
          if (at >= 0) {
            inBody = true;
            offset = Math.min(offset, at);
          }
        }
        const weight = (inHeading ? 5 : 0) + (inTitle ? 2 : 0) + (inBody ? 1 : 0);
        if (weight) frequency[i]++;
        return weight;
      });
      return { entry, weights, offset: Number.isFinite(offset) ? offset : 0 };
    });

    // A term found in few passages (e.g. an API identifier) is stronger evidence
    // than a word repeated throughout the site. Matching more of the question
    // and matching a complete heading also favor specific answers.
    const importance = frequency.map(count => 1 + Math.log((entries.length + 1) / (count + 1)));
    return candidates.flatMap(({ entry, weights, offset }) => {
      const matches = weights.filter(Boolean).length;
      if (!matches || matches < queryWords.length / 2) return [];
      const completeHeading = entry.headingWords.length > 0 && entry.headingWords.every(alternatives =>
        queryWords.some(queryForms => alternatives.some(term => queryForms.includes(term))));
      const score = weights.reduce((sum, weight, i) => sum + weight * importance[i], 0)
        * matches / queryWords.length + (completeHeading ? 6 : 0);
      return [{ doc: entry.doc, score, offset }];
    }).sort((a, b) => b.score - a.score ||
      Number(b.doc.id === preferredPageId) - Number(a.doc.id === preferredPageId));
  };
}

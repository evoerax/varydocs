import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const directory = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('.varydocs/packs/', root));
const fontLicenses = new Map([
  ['barlow-condensed-latin-900-normal.woff2', 'barlow-condensed-OFL.txt'],
  ['barlow-condensed-latin-900-italic.woff2', 'barlow-condensed-OFL.txt'],
  ['explora-latin-400-normal.woff2', 'explora-OFL.txt'],
]);

let version;
for (const kind of ['model', 'core', 'react', 'next', 'cli', 'ai']) {
  const source = JSON.parse(readFileSync(new URL('packages/' + kind + '/package.json', root)));
  const file = join(directory, 'varydocs-' + kind + '-' + source.version + '.tgz');
  const files = new Set(execFileSync('tar', ['-tzf', file], { encoding: 'utf8' }).trim().split('\n'));
  const read = path => execFileSync('tar', ['-xOzf', file, path]);
  const pkg = JSON.parse(read('package/package.json'));
  version ??= source.version;
  assert.equal(pkg.name, '@varydocs/' + kind);
  assert.equal(pkg.version, source.version, pkg.name + ' packed version');
  assert.equal(pkg.version, version, pkg.name + ' release version');
  assert.equal(pkg.publishConfig?.access, 'public');
  assert.equal(pkg.license, 'MIT');
  assert.deepEqual(pkg.exports, source.exports, pkg.name + ' packed export map');
  assert.deepEqual(pkg.bin, source.bin, pkg.name + ' packed CLI entry');
  const paths = ['LICENSE', 'README.md', ...Object.values(pkg.bin ?? {})];
  for (const entry of Object.values(pkg.exports)) {
    if (typeof entry === 'string') paths.push(entry);
    else {
      assert(entry.types && entry.import, 'Missing type or JS entry in ' + pkg.name);
      paths.push(entry.types, entry.import);
    }
  }
  for (const path of paths) assert(files.has('package/' + path.replace(/^\.\//u, '')), pkg.name + ' missing ' + path);
  for (const path of ['LICENSE', 'README.md']) {
    const current = readFileSync(new URL('packages/' + kind + '/' + path, root));
    assert(read('package/' + path).equals(current), pkg.name + ' outdated ' + path);
  }
  for (const field of ['dependencies', 'optionalDependencies', 'devDependencies', 'peerDependencies']) {
    const expected = source[field] ?? {};
    assert.deepEqual(Object.keys(pkg[field] ?? {}).sort(), Object.keys(expected).sort(), pkg.name + ' packed ' + field);
    for (const [name, dep] of Object.entries(pkg[field] ?? {})) {
      assert(!/^(?:workspace|file|link):/u.test(dep), pkg.name + ' contains local ' + name + ' in ' + field);
      const requirement = expected[name] === 'workspace:*' ? version : expected[name];
      assert.equal(dep, requirement, pkg.name + ' packed requirement for ' + name);
    }
  }
  for (const path of files) {
    if (path.endsWith('.css')) {
      const css = read(path).toString();
      for (const match of css.matchAll(/@import\s+["']([^"']+)["']|url\(\s*["']?([^)"'\s]+)/gu)) {
        const url = match[1] ?? match[2];
        if (!/^(?:[a-z][a-z\d+.-]*:|[/#])/iu.test(url)) {
          const target = posix.join(posix.dirname(path), url.split(/[?#]/u, 1)[0]);
          assert(files.has(target), pkg.name + ' missing CSS asset ' + url + ' from ' + path);
        }
      }
    } else if (/\.(?:woff2?|ttf|otf|eot)$/iu.test(path)) {
      const license = fontLicenses.get(posix.basename(path));
      assert(license, 'No license mapped for ' + path);
      const notice = posix.join(posix.dirname(path), license);
      assert(files.has(notice), 'Missing ' + notice + ' for ' + path);
      const text = read(notice);
      assert.match(text.toString(), /SIL OPEN FONT LICENSE Version 1\.1/u);
      assert(text.equals(readFileSync(new URL('packages/' + kind + '/' + notice.slice(8), root))), 'Outdated ' + notice);
      console.log(posix.basename(path) + ' — ' + license + ' (SIL OFL 1.1)');
    }
  }
  console.log(pkg.name + '@' + version + ' verified');
}

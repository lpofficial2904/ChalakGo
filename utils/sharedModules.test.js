import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageCopyKey } from '../shared/pageCopyKey.js';

test('backend shared imports resolve inside the standalone repository', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  let references = 0;
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'uploads'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (entry.name.endsWith('.js')) {
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]*shared\/[^'"]+)['"]/g)) {
          references++;
          const target = path.resolve(path.dirname(file), match[1]);
          const relative = path.relative(root, target);
          assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), `${file} imports outside the repository`);
          await access(target);
        }
      }
    }
  }
  await scan(root);
  assert.ok(references >= 7);
});

test('persisted page-copy keys retain the original hash contract', () => {
  assert.equal(pageCopyKey(''), 'copy_811c9dc5');
  assert.equal(pageCopyKey('hello'), 'copy_4f9f2cab');
  assert.equal(pageCopyKey(123), pageCopyKey('123'));
});

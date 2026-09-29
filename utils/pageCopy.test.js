import test from 'node:test';
import assert from 'node:assert/strict';
import Page from '../models/Page.js';
import { pageCopyKey } from '../shared/pageCopyKey.js';

test('page copy survives storage serialization, including intentionally empty text', async () => {
  const page = new Page({ title: 'About', slug: 'about', preserveLayout: true, copy: { text_1: 'Our story', text_2: '', [pageCopyKey('Original card')]: 'Updated card' } });
  await page.validate();
  const saved = JSON.parse(JSON.stringify(page));
  assert.equal(saved.preserveLayout, true);
  assert.equal(saved.copy.text_1, 'Our story');
  assert.equal(saved.copy.text_2, '');
  assert.equal(saved.copy[pageCopyKey('Original card')], 'Updated card');
  page.isPublished = false;
  assert.equal(JSON.parse(JSON.stringify(page)).copy.text_1, 'Our story');
});

import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAssetUrls } from './assets.js'

test('replaces legacy localhost upload URLs with the public API URL', () => {
  const result = normalizeAssetUrls({ image: 'http://localhost:5000/uploads/driver.png', nested: ['http://127.0.0.1:5173/uploads/logo.webp'] })
  assert.equal(result.image, 'https://chalakgo.onrender.com/uploads/driver.png')
  assert.equal(result.nested[0], 'https://chalakgo.onrender.com/uploads/logo.webp')
})

test('does not change external or relative asset URLs', () => {
  assert.equal(normalizeAssetUrls('https://images.example.com/driver.png'), 'https://images.example.com/driver.png')
  assert.equal(normalizeAssetUrls('/uploads/driver.png'), '/uploads/driver.png')
})

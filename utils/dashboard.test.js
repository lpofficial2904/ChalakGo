import test from 'node:test';
import assert from 'node:assert/strict';
import { periodStarts, pageCounts, publicationCounts, requestCounts } from './dashboard.js';
test('IST midnight and Monday start work across month and year boundaries', () => {
  const starts = periodStarts(new Date('2026-09-13T18:30:00Z'));
  assert.equal(starts.today.toISOString(), '2026-09-13T18:30:00.000Z');
  assert.equal(starts.week.toISOString(), '2026-09-13T18:30:00.000Z');
  assert.equal(starts.month.toISOString(), '2026-08-31T18:30:00.000Z');
  assert.equal(periodStarts(new Date('2026-01-01T00:00:00Z')).week.toISOString(), '2025-12-28T18:30:00.000Z');
});
test('built-in overrides count once and custom pages are included', () => {
  assert.deepEqual(pageCounts([{slug:'home',isPublished:false},{slug:'custom',isPublished:true}]), {total:12,active:11,inactive:1});
  assert.deepEqual(publicationCounts([{isActive:true},{isActive:false}], 'isActive'), {total:2,active:1,inactive:1});
});
test('no requests gives zeros rather than missing dashboard values', async () => {
  assert.deepEqual(await requestCounts({ aggregate: async () => [] }), {total:0,today:0,week:0,month:0});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { adminEvents, notifyAdminRequests } from './adminEvents.js';

function response() {
  const res = new EventEmitter();
  res.set = () => res;
  res.json = body => { res.body = body; res.calls = (res.calls || 0) + 1; };
  return res;
}

test('new requests wake all waiting admins and reconnects catch missed changes', () => {
  const initial = response();
  adminEvents({ query: {} }, initial);
  const since = initial.body.revision;
  const first = response(), second = response();
  adminEvents({ query: { since } }, first);
  adminEvents({ query: { since } }, second);
  assert.equal(first.body, undefined);
  notifyAdminRequests();
  assert.notEqual(first.body.revision, since);
  assert.deepEqual(second.body, first.body);
  notifyAdminRequests();
  assert.equal(first.calls, 1);
  const reconnected = response();
  adminEvents({ query: { since } }, reconnected);
  assert.notEqual(reconnected.body.revision, since);
});

test('disconnected requests stop listening', () => {
  const initial = response();
  adminEvents({ query: {} }, initial);
  const waiting = response();
  adminEvents({ query: { since: initial.body.revision } }, waiting);
  waiting.emit('close');
  notifyAdminRequests();
  assert.equal(waiting.body, undefined);
  assert.equal(waiting.listenerCount('close'), 0);
});

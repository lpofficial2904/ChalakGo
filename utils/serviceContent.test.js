import test from 'node:test';
import assert from 'node:assert/strict';
import Service from '../models/Service.js';
import { contentOf } from '../../shared/serviceContent.js';

test('service content survives model JSON serialization and status updates', async () => {
  const service = new Service({ slug: 'jaipur-tour', name: 'Custom tour', content: 'Inclusions\nPrivate pickup', pageContent: { plansTitle: 'Choose a trip', itineraryNote: '' }, isActive: true });
  await service.validate();
  service.isActive = false;
  const saved = JSON.parse(JSON.stringify(service));
  assert.equal(saved.isActive, false);
  assert.equal(saved.content, 'Inclusions\nPrivate pickup');
  assert.equal(contentOf(saved).plansTitle, 'Choose a trip');
  assert.equal(contentOf(saved).itineraryNote, '');
  assert.ok(contentOf(saved).plansDescription);
});

test('existing permanent driver content remains available before an admin edits it', () => {
  assert.ok(contentOf({ slug: 'permanent-driver' }).benefits);
  assert.deepEqual(contentOf({ slug: 'new-service' }), {});
});

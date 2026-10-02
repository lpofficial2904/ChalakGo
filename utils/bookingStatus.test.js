import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Booking from '../models/Booking.js';
import AdminCredentials from '../models/AdminCredentials.js';
import bookingRoutes from '../routes/bookings.js';
import { apiErrorHandler } from './router.js';

test('admin can mark a booking pending, completed or cancelled', async t => {
  const previousState = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  t.after(() => { mongoose.connection.readyState = previousState; });
  t.mock.method(AdminCredentials, 'findById', async () => null);
  let saved;
  t.mock.method(Booking, 'findByIdAndUpdate', async (id, update) => {
    saved = { _id: id, ...update.$set };
    return saved;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingRoutes);
  app.use(apiErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'development-only-change-this-jwt-secret');
  const call = status => fetch(`http://127.0.0.1:${server.address().port}/api/bookings/admin/${'a'.repeat(24)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) });
  for (const status of ['pending', 'completed', 'cancelled']) {
    const response = await call(status);
    assert.equal(response.status, 200);
    const booking = await response.json();
    assert.equal(booking.status, status);
    assert.ok(booking.statusUpdatedAt);
    assert.equal(Boolean(booking.completedAt), status === 'completed');
    assert.equal(Boolean(booking.cancelledAt), status === 'cancelled');
  }
  assert.equal((await call('refunded')).status, 400);
  assert.equal(saved.status, 'cancelled');
});

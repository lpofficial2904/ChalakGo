import test from 'node:test'
import assert from 'node:assert/strict'
import { generateBookingId } from './bookingId.js'

test('reference uses India date/time and four random digits', () => {
  assert.match(generateBookingId(new Date('2026-09-08T18:31:02Z')), /^BK-20260909000102-[1-9][0-9]{3}$/)
})

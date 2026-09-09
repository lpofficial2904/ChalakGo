import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDistanceFare, calculateMonthlyFare, calculateTemporaryDriverFare } from './temporaryDriverFare.js'
import Booking from '../models/Booking.js'

test('temporary-driver pricing matches the published daily examples', () => {
  const startDateTime = '2026-09-08T10:00'
  for (const [hours, expected] of [[24, 2386], [48, 4762], [72, 7138], [120, 11890]]) {
    const endDateTime = new Date(Date.parse(`${startDateTime}:00Z`) + hours * 60 * 60 * 1000).toISOString().slice(0, 16)
    const fare = calculateTemporaryDriverFare({ startDateTime, endDateTime })
    assert.equal(fare.totalFare, expected)
  }
})

test('temporary-driver pricing has a 10-hour base charge and a one-time discount', () => {
  const fare = calculateTemporaryDriverFare({ startDateTime: '2026-09-08T10:00', endDateTime: '2026-09-09T10:00' })
  assert.equal(fare.baseFare, 1200)
  assert.equal(fare.additionalHours, 14)
  assert.equal(fare.additionalFare, 1386)
  assert.equal(fare.subtotal, 2586)
  assert.equal(fare.discount, 200)
  assert.equal(fare.totalFare, 2386)
})

test('invalid or nonpositive schedules are rejected', () => {
  for (const endDateTime of ['', 'invalid', '2026-02-30T14:00', '2026-09-08T13:11', '2026-09-07T13:11']) {
    assert.throws(() => calculateTemporaryDriverFare({ startDateTime: '2026-09-08T13:11', endDateTime }))
  }
})

test('Cab vehicle rates calculate SUV and Hatchback fares by distance', () => {
  assert.equal(calculateDistanceFare({ distanceKm: 100, carType: 'SUV', vehicleRates: { suv: 18, hatchback: 14 } }).totalFare, 1800)
  assert.equal(calculateDistanceFare({ distanceKm: 100, carType: 'Hatchback', vehicleRates: { suv: 18, hatchback: 14 } }).totalFare, 1400)
  assert.equal(calculateDistanceFare({ distanceKm: 100, carType: 'Haravan Traveller', vehicleRates: { suv: 18, hatchback: 14, traveller: 35 } }).totalFare, 3500)
})

test('Permanent Driver shift rates calculate monthly estimates', () => {
  const monthlyRates = { sixToEight: 15000, eightToTen: 18000, tenToTwelve: 22000 }
  assert.equal(calculateMonthlyFare({ duration: '6–8 Hours / Day', monthlyRates }).totalFare, 15000)
  assert.equal(calculateMonthlyFare({ duration: '8–10 Hours / Day', monthlyRates }).totalFare, 18000)
  assert.equal(calculateMonthlyFare({ duration: '10–12 Hours / Day', monthlyRates }).totalFare, 22000)
})

test('booking validation replaces client fare with the server calculation', async () => {
  const booking = new Booking({
    fullName: 'Test Customer', phone: '9876543210', email: 'test@example.com',
    service: 'Driver Only', pickup: { source: 'manual', formattedAddress: 'Jaipur' },
    address: 'Jaipur', pickupLocation: 'Jaipur', carType: 'Sedan / SUV',
    startDateTime: '2026-09-08T13:11', endDateTime: '2026-09-08T19:12',
    duration: '8 Hours', totalFare: 1, durationMinutes: 451,
  })
  await booking.validate()
  assert.equal(booking.totalFare, 1000)
  assert.equal(booking.durationMinutes, 361)
  assert.equal(booking.duration, '6 hours 1 minutes')
})

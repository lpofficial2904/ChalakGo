import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDistanceFare, calculateMonthlyFare, calculateTemporaryDriverFare } from './temporaryDriverFare.js'
import Booking from '../models/Booking.js'

for (const [minutes, expected] of [[360, 390], [480, 520], [720, 780], [1440, 1440]]) {
  test(`${minutes} minutes costs ${expected}`, () => {
    const startDateTime = '2026-09-08T13:11'
    const endDateTime = new Date(Date.parse(`${startDateTime}:00Z`) + minutes * 60000).toISOString().slice(0, 16)
    const fare = calculateTemporaryDriverFare({ startDateTime, endDateTime })
    assert.equal(fare.durationMinutes, minutes)
    assert.equal(fare.totalFare, expected)
  })
}

test('invalid or nonpositive schedules are rejected', () => {
  for (const endDateTime of ['', 'invalid', '2026-02-30T14:00', '2026-09-08T13:11', '2026-09-07T13:11']) {
    assert.throws(() => calculateTemporaryDriverFare({ startDateTime: '2026-09-08T13:11', endDateTime }))
  }
})

test('admin service hourly and daily prices drive the calculation', () => {
  const startDateTime = '2026-09-08T13:11'
  assert.equal(calculateTemporaryDriverFare({ startDateTime, endDateTime: '2026-09-08T21:11', price: '₹100/hr' }).totalFare, 800)
  assert.equal(calculateTemporaryDriverFare({ startDateTime, endDateTime: '2026-09-10T13:11', price: '₹2,000/day' }).totalFare, 4000)
  assert.equal(calculateTemporaryDriverFare({ startDateTime, endDateTime: '2026-09-08T15:11', price: '₹120 per hour' }).totalFare, 240)
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

test('booking validation replaces client fare and duration with selected-time calculation', async () => {
  const booking = new Booking({
    fullName: 'Test Customer', phone: '9876543210', email: 'test@example.com',
    service: 'Driver Only', pickup: { source: 'manual', formattedAddress: 'Jaipur' },
    address: 'Jaipur', pickupLocation: 'Jaipur', carType: 'Sedan / SUV',
    startDateTime: '2026-09-08T13:11', endDateTime: '2026-09-08T19:12',
    duration: '8 Hours', totalFare: 1, durationMinutes: 451,
  })
  await booking.validate()
  assert.equal(booking.totalFare, 391.08)
  assert.equal(booking.durationMinutes, 361)
  assert.equal(booking.duration, '6 hours 1 minutes')
  booking.endDateTime = booking.startDateTime
  await assert.rejects(booking.validate(), /must be after/)
})

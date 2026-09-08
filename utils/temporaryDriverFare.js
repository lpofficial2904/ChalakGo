// Shared by the browser and server. Booking inputs are local wall-clock times;
// parse them as UTC solely for timezone-independent calendar arithmetic.
function parseBookingTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('Select a valid start and end date/time.')
  }
  const milliseconds = Date.parse(`${value}:00Z`)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 16) !== value) {
    throw new Error('Select a valid start and end date/time.')
  }
  return milliseconds
}

function parsePrice(value) {
  const text = typeof value === 'string' ? value.replace(/,/g, '') : ''
  const matches = [...text.matchAll(/₹?\s*(\d+(?:\.\d+)?)\s*(?:\/|per\s+)(hr|hour|hours?|day|days?)\b/gi)]
  if (!matches.length) throw new Error('This service does not have a valid hourly or daily price.')
  return matches.map(match => ({ amount: Number(match[1]), unit: match[2].toLowerCase().startsWith('d') ? 'day' : 'hour' }))
}

export function calculateTemporaryDriverFare({ startDateTime, endDateTime, price = '₹65/hr; ₹60/hr for 24 hours' }) {
  const durationMinutes = (parseBookingTime(endDateTime) - parseBookingTime(startDateTime)) / 60000
  if (durationMinutes <= 0) throw new Error('End date/time must be after start date/time.')
  const rates = parsePrice(price)
  const rate = rates[durationMinutes === 24 * 60 && rates.length > 1 ? 1 : 0]
  const totalFare = rate.unit === 'day' ? durationMinutes * rate.amount / (24 * 60) : durationMinutes * rate.amount / 60
  return {
    durationMinutes,
    duration: `${Math.floor(durationMinutes / 60)} hours ${durationMinutes % 60} minutes`,
    hourlyRate: rate.unit === 'hour' ? rate.amount : undefined,
    dailyRate: rate.unit === 'day' ? rate.amount : undefined,
    rateUnit: rate.unit,
    firstHours: durationMinutes / 60,
    additionalHours: 0,
    firstFare: totalFare,
    additionalFare: 0,
    totalFare: Math.round(totalFare * 100) / 100,
  }
}

export function calculateDistanceFare({ distanceKm, carType, vehicleRates }) {
  const distance = Number(distanceKm)
  const rates = vehicleRates || {}
  const rate = /traveller/i.test(String(carType)) ? Number(rates.traveller) : /suv/i.test(String(carType)) ? Number(rates.suv) : Number(rates.hatchback)
  if (!Number.isFinite(distance) || distance <= 0) throw new Error('Enter a valid trip distance in kilometres.')
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('This service does not have a valid vehicle rate.')
  return { distanceKm: distance, ratePerKm: rate, totalFare: Math.round(distance * rate * 100) / 100 }
}

export function calculateMonthlyFare({ duration, monthlyRates }) {
  const rates = monthlyRates || {}
  const key = /6\s*[–-]\s*8/.test(String(duration)) ? 'sixToEight' : /8\s*[–-]\s*10/.test(String(duration)) ? 'eightToTen' : /10\s*[–-]\s*12/.test(String(duration)) ? 'tenToTwelve' : ''
  const monthlyRate = Number(rates[key])
  if (!key || !Number.isFinite(monthlyRate) || monthlyRate <= 0) throw new Error('Select a valid permanent driver shift.')
  return { monthlyRate, totalFare: monthlyRate }
}

export function calculateFixedFare({ tourPlanPrice }) {
  const amount = Number(String(tourPlanPrice || '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('This tour plan does not have a valid price.')
  return { totalFare: amount }
}

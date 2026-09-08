import { randomInt } from 'node:crypto'

export function generateBookingId(now = new Date()) {
  // India time, independent of the server's deployment timezone.
  const indiaTime = new Date(now.getTime() + 330 * 60000)
  const timestamp = indiaTime.toISOString().slice(0, 19).replace(/[-:T]/g, '')
  return `BK-${timestamp}-${randomInt(1000, 10000)}`
}

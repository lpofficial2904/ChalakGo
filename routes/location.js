import { Router } from 'express'
import { createReverseGeocoder, parseCoordinate } from '../utils/reverseGeocode.js'

const router = Router()
const reverseGeocode = createReverseGeocoder()
router.get('/reverse', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const latitude = parseCoordinate(req.query.latitude, 90)
    const longitude = parseCoordinate(req.query.longitude, 180)
    res.json(await reverseGeocode(latitude, longitude))
  } catch (error) {
    const status = error.status || 502
    if (status === 429) res.set('Retry-After', '60')
    res.status(status).json({ message: error.status ? error.message : 'Address lookup timed out or is unavailable. Retry or enter your address manually.' })
  }
})
export default router

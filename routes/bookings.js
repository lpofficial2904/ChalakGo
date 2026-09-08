import { Router } from 'express'
import { isDatabaseConnected } from '../db.js'
import Booking from '../models/Booking.js'
import { requireUser } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/auth.js'
import { generateBookingId } from '../utils/bookingId.js'
import Service from '../models/Service.js'

const router = Router()

router.post('/', requireUser, async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ message: 'Booking service is temporarily unavailable. MongoDB is not connected.' })
  }
  try {
    const payload = { ...req.body, fullName: req.body.fullName || req.user.fullName, phone: req.body.phone || req.user.mobile }
    if (payload.service) {
      const service = await Service.findOne({ name: payload.service, isActive: true }).lean()
      if (service?.price) payload.servicePrice = service.price
      if (service?.pricingType) payload.pricingType = service.pricingType
      if (service?.vehicleRates) payload.vehicleRates = service.vehicleRates
      if (service?.monthlyRates) payload.monthlyRates = service.monthlyRates
      if (service?.tourPlans?.length && payload.tourPlanDays) {
        const plan = service.tourPlans.find(item => item.days === Number(payload.tourPlanDays))
        if (!plan) return res.status(400).json({ message: 'Please select a valid Jaipur Tour plan.' })
        payload.pricingType = 'fixed'
        payload.tourPlanPrice = plan.price
      }
    }
    const isCurrentPickup = payload.pickup?.source === 'current'
    const pickupLatitude = payload.pickupLatitude
    const pickupLongitude = payload.pickupLongitude
    const pickupAccuracy = payload.pickupAccuracy
    const pickupTimestamp = payload.pickupTimestamp
    if (isCurrentPickup && (!Number.isFinite(pickupLatitude) || pickupLatitude < -90 || pickupLatitude > 90 || !Number.isFinite(pickupLongitude) || pickupLongitude < -180 || pickupLongitude > 180)) {
      return res.status(400).json({ message: 'A valid GPS pickup latitude and longitude are required.' })
    }
    if (isCurrentPickup && (!Number.isFinite(pickupAccuracy) || pickupAccuracy < 0 || !Number.isFinite(pickupTimestamp) || pickupTimestamp <= 0)) {
      return res.status(400).json({ message: 'GPS accuracy and timestamp are required for a current pickup.' })
    }
    if (isCurrentPickup) {
      payload.pickupLatitude = pickupLatitude
      payload.pickupLongitude = pickupLongitude
      payload.pickupAccuracy = pickupAccuracy
      payload.pickupTimestamp = pickupTimestamp
      payload.locationSource = payload.locationSource || 'gps'
      payload.pickupAddress = payload.pickupAddress || payload.pickupLocation
      payload.pickupHouseNumber = payload.pickupHouseNumber || payload.houseNumber || ''
      payload.pickupBuildingName = payload.pickupBuildingName || payload.buildingName || ''
      payload.pickupRoad = payload.pickupRoad || payload.road || ''
      payload.pickupArea = payload.pickupArea || payload.area || ''
      payload.pickupCity = payload.pickupCity || payload.city || ''
      payload.pickupState = payload.pickupState || payload.state || ''
      payload.pickupPincode = payload.pickupPincode || payload.pincode || ''
      payload.pickupCountry = payload.pickupCountry || payload.country || ''
      payload.coordinates = { latitude: pickupLatitude, longitude: pickupLongitude, accuracy: pickupAccuracy }
      payload.pickup = { ...payload.pickup, coordinates: payload.coordinates, formattedAddress: payload.pickupAddress }
    }
    let booking
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        booking = await Booking.create({ ...payload, bookingId: generateBookingId() })
        break
      } catch (error) {
        if (error.code !== 11000 || !error.keyPattern?.bookingId || attempt === 4) throw error
      }
    }
    res.status(201).json({ message: 'Booking created', booking })
  } catch (error) {
    res.status(400).json({ message: 'Unable to create booking', error: error.message })
  }
})
router.get('/admin', requireAdmin, async (_req, res) => { if (!isDatabaseConnected()) return res.status(503).json({ message: 'Database is not connected.' }); res.json(await Booking.find().sort({ createdAt: -1 })) })

export default router

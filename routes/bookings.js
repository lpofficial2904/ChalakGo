import { Router } from 'express'
import { isDatabaseConnected } from '../db.js'
import Booking from '../models/Booking.js'
import { requireUser } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

router.post('/', requireUser, async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ message: 'Booking service is temporarily unavailable. MongoDB is not connected.' })
  }
  try {
    const booking = await Booking.create({ ...req.body, fullName: req.body.fullName || req.user.fullName, phone: req.user.mobile })
    res.status(201).json({ message: 'Booking created', booking })
  } catch (error) {
    res.status(400).json({ message: 'Unable to create booking', error: error.message })
  }
})
router.get('/admin', requireAdmin, async (_req, res) => { if (!isDatabaseConnected()) return res.status(503).json({ message: 'Database is not connected.' }); res.json(await Booking.find().sort({ createdAt: -1 })) })

export default router

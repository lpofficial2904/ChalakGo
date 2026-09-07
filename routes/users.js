import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { isDatabaseConnected } from '../db.js'
import { clearUserSession, createUserSession, requireAdmin, requireUser } from '../middleware/auth.js'

const router = Router()
const mobileOf = value => String(value || '').replace(/\D/g, '')
const validPassword = value => typeof value === 'string' && value.length >= 8
const unavailable = res => res.status(503).json({ message: 'Account service is temporarily unavailable.' })

router.post('/signup', async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res)
  const fullName = String(req.body.fullName || '').trim(), mobile = mobileOf(req.body.mobile), password = String(req.body.password || '')
  if (fullName.length < 2 || !/^[6-9]\d{9}$/.test(mobile) || !validPassword(password)) return res.status(400).json({ message: 'Enter your name, a valid 10-digit mobile number, and a password of at least 8 characters.' })
  if (await User.exists({ mobile })) return res.status(409).json({ message: 'An account with this mobile number already exists. Please log in.' })
  const account = await User.create({ fullName, mobile, passwordHash: await bcrypt.hash(password, 12) })
  const user = { id: account._id.toString(), fullName: account.fullName, mobile: account.mobile, role: 'user' }
  res.status(201).json({ user, token: createUserSession(res, user) })
})
router.post('/login', async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res)
  const mobile = mobileOf(req.body.mobile), password = String(req.body.password || '')
  const account = await User.findOne({ mobile })
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) return res.status(401).json({ message: 'Invalid mobile number or password.' })
  const user = { id: account._id.toString(), fullName: account.fullName, mobile: account.mobile, role: 'user' }
  res.json({ user, token: createUserSession(res, user) })
})
router.get('/me', requireUser, (req, res) => res.json({ user: req.user }))
router.get('/admin', requireAdmin, async (_req, res) => { if (!isDatabaseConnected()) return unavailable(res); res.json(await User.find().select('-passwordHash').sort({ createdAt: -1 })) })
router.get('/admin', async (req, res, next) => { try { const { requireAdmin } = await import('../middleware/auth.js'); requireAdmin(req, res, next) } catch { res.status(401).json({ message: 'Login required.' }) } }, async (_req, res) => { if (!isDatabaseConnected()) return unavailable(res); const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }); res.json(users) })
router.post('/logout', (_req, res) => { clearUserSession(res); res.status(204).end() })
export default router

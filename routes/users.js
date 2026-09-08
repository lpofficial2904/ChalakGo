import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { isDatabaseConnected } from '../db.js'
import { clearUserSession, createUserSession, requireAdmin, requireUser } from '../middleware/auth.js'
import { createHash, randomInt } from 'node:crypto'
import { sendLoginOtp } from '../utils/mailer.js'

const router = Router()
const mobileOf = value => String(value || '').replace(/\D/g, '')
const validPassword = value => typeof value === 'string' && value.length >= 8
const normaliseEmail = value => String(value || '').trim().toLowerCase()
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const hashOtp = value => createHash('sha256').update(value).digest('hex')
const unavailable = res => res.status(503).json({ message: 'Account service is temporarily unavailable.' })

router.post('/signup', async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res)
  const fullName = String(req.body.fullName || '').trim(), mobile = mobileOf(req.body.mobile), email = normaliseEmail(req.body.email), password = String(req.body.password || '')
  if (fullName.length < 2 || !/^[6-9]\d{9}$/.test(mobile) || !validEmail(email) || !validPassword(password)) return res.status(400).json({ message: 'Enter your name, email, a valid 10-digit mobile number, and a password of at least 8 characters.' })
  if (await User.exists({ mobile })) return res.status(409).json({ message: 'An account with this mobile number already exists. Please log in.' })
  if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists. Please log in.' })
  const account = await User.create({ fullName, mobile, email, passwordHash: await bcrypt.hash(password, 12) })
  const user = { id: account._id.toString(), fullName: account.fullName, mobile: account.mobile, email: account.email, role: 'user' }
  res.status(201).json({ user, token: createUserSession(res, user) })
})
router.post('/login', async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res)
  const mobile = mobileOf(req.body.mobile), password = String(req.body.password || '')
  const account = await User.findOne({ mobile })
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) return res.status(401).json({ message: 'Invalid mobile number or password.' })
  const user = { id: account._id.toString(), fullName: account.fullName, mobile: account.mobile, email: account.email, role: 'user' }
  res.json({ user, token: createUserSession(res, user) })
})
router.post('/otp/request', async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res)
  const email = normaliseEmail(req.body.email)
  if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
  const account = await User.findOne({ email }).select('+otpHash +otpExpiresAt +otpAttempts')
  if (!account) return res.status(404).json({ message: 'No account found with this email. Create an account first.' })
  if (account.otpExpiresAt && account.otpExpiresAt.getTime() > Date.now() - 45_000) return res.status(429).json({ message: 'Please wait before requesting another OTP.' })
  const otp = String(randomInt(100000, 1000000))
  try { await sendLoginOtp(email, otp) } catch (error) { return res.status(503).json({ message: error.message }) }
  account.otpHash = hashOtp(otp)
  account.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
  account.otpAttempts = 0
  await account.save()
  res.json({ message: 'OTP sent to your email address.', expiresIn: 600 })
})
router.post('/otp/verify', async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res)
  const email = normaliseEmail(req.body.email), otp = String(req.body.otp || '').trim()
  if (!validEmail(email) || !/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'Enter your email and the 6-digit OTP.' })
  const account = await User.findOne({ email }).select('+otpHash +otpExpiresAt +otpAttempts')
  if (!account || !account.otpHash || !account.otpExpiresAt || account.otpExpiresAt < new Date()) return res.status(401).json({ message: 'This OTP has expired. Request a new one.' })
  if (account.otpAttempts >= 5) return res.status(429).json({ message: 'Too many incorrect attempts. Request a new OTP.' })
  if (hashOtp(otp) !== account.otpHash) { account.otpAttempts += 1; await account.save(); return res.status(401).json({ message: 'Incorrect OTP. Please try again.' }) }
  account.otpHash = undefined
  account.otpExpiresAt = undefined
  account.otpAttempts = 0
  await account.save()
  const user = { id: account._id.toString(), fullName: account.fullName, mobile: account.mobile, email: account.email, role: 'user' }
  res.json({ user, token: createUserSession(res, user) })
})
router.get('/me', requireUser, (req, res) => res.json({ user: req.user }))
router.get('/admin', requireAdmin, async (_req, res) => { if (!isDatabaseConnected()) return unavailable(res); res.json(await User.find().select('-passwordHash').sort({ createdAt: -1 })) })
router.get('/admin', async (req, res, next) => { try { const { requireAdmin } = await import('../middleware/auth.js'); requireAdmin(req, res, next) } catch { res.status(401).json({ message: 'Login required.' }) } }, async (_req, res) => { if (!isDatabaseConnected()) return unavailable(res); const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }); res.json(users) })
router.post('/logout', (_req, res) => { clearUserSession(res); res.status(204).end() })
export default router

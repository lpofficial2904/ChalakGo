import { Router } from 'express'
import { isDatabaseConnected } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import Service from '../models/Service.js'
import SiteSettings from '../models/SiteSettings.js'
import Page from '../models/Page.js'
import Blog from '../models/Blog.js'
import { normalizeAssetUrls } from '../utils/assets.js'

const router = Router()
const defaultSettings = { siteName: 'ChalakGo', logo: '', navbarLogo: '', footerLogo: '', mainFavicon: '', adminFavicon: '', heroImage: '', heroTitle: '', heroText: '', topBarMessage: 'Professional drivers for every journey · 24/7 booking support', phone: '+91 98765 43210', email: 'support@chalakgo.in', bookingEmail: '', bookingEmailSubject: '', contactEmail: '', contactEmailSubject: '', contactEmailMessage: '', address: 'Virasat Homes, Scheme Number 4, Narayan Vihar, Jaipur, Rajasthan 302020, India', facebook: '', instagram: '', whatsapp: '', linkedin: '', youtube: '', otpEmailFrom: '', otpEmailSubject: '', emailDeliveryConfigured: false, emailOtpEnabled: true, bookingEmailEnabled: true, contactEmailEnabled: true, whatsappEnabled: false, whatsappApiVersion: 'v21.0', whatsappPhoneNumberId: '', whatsappRecipient: '' }
const assertDb = (res) => isDatabaseConnected() || (res.status(503).json({ message: 'Database is not connected.' }), false)
const defaultServices = [
  { slug: 'driver-only', name: 'Driver Only', price: '₹65/hr; ₹60/hr for 24 hours', eyebrow: 'YOUR CAR, OUR EXPERT DRIVER', detail: 'A trained, verified chauffeur drives your own car safely and professionally.', features: ['Background-verified driver', 'Live trip location updates', 'Hourly, daily, and weekly options'], image: 'https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=1200&q=85', isActive: true },
  { slug: 'car-driver', name: 'Cab (Car + Driver)', price: 'SUV ₹18/km; Hatchback ₹14/km; Haravan Traveller ₹35/km', pricingType: 'distance', vehicleRates: { suv: 18, hatchback: 14, traveller: 35 }, eyebrow: 'PREMIUM CAR WITH PROFESSIONAL CHAUFFEUR', detail: 'Travel in comfort with a clean premium car and an experienced driver for work, airport transfers, and special occasions.', features: ['Executive sedan and SUV choices', 'Professional uniformed driver', 'Clean, sanitised vehicle and live tracking'], image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85', isActive: true },
  { slug: 'permanent-driver', name: 'Permanent Driver', price: '₹15,000–₹22,000/month', pricingType: 'monthly', monthlyRates: { sixToEight: 15000, eightToTen: 18000, tenToTwelve: 22000 }, eyebrow: 'YOUR DEDICATED MONTHLY CHAUFFEUR', detail: 'A reliable dedicated driver for daily family travel, office commutes, and a consistent driving routine.', features: ['Dedicated driver matching', 'Backup-driver support', 'Personalised monthly schedule'], image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=85', isActive: true }
  ,{ slug: 'jaipur-tour', name: 'Jaipur Tour', price: 'Plans from ₹2,999', pricingType: 'fixed', eyebrow: 'EXPLORE THE PINK CITY', detail: 'Book a comfortable private Jaipur sightseeing tour for one day or two days with a professional driver.', features: ['Flexible 1-day and 2-day plans', 'Choose your preferred places', 'Private car and professional driver'], image: 'https://images.unsplash.com/photo-1599661046827-dacde6976540?auto=format&fit=crop&w=1200&q=85', tourPlans: [{ days: 1, price: '₹2,999', places: ['Amber Fort', 'Jal Mahal', 'Hawa Mahal', 'City Palace', 'Jantar Mantar'] }, { days: 2, price: '₹3,499', places: ['Amber Fort', 'Jal Mahal', 'Hawa Mahal', 'City Palace', 'Jantar Mantar', 'Nahargarh Fort', 'Jaigarh Fort', 'Albert Hall Museum'] }], isActive: true }
]

// One-time migration: services that used to live in the React component are
// copied into MongoDB, without overwriting anything an admin has already edited.
async function importDefaultServices() {
  if (!isDatabaseConnected()) return
  const settings = await SiteSettings.findOne().lean()
  for (const service of defaultServices) await Service.updateOne({ slug: service.slug }, { $setOnInsert: service }, { upsert: true })
  await Service.updateOne({ slug: 'car-driver', $or: [{ pricingType: { $ne: 'distance' } }, { 'vehicleRates.traveller': { $exists: false } }] }, { $set: { name: 'Cab (Car + Driver)', price: 'SUV ₹18/km; Hatchback ₹14/km; Haravan Traveller ₹35/km', pricingType: 'distance', vehicleRates: { suv: 18, hatchback: 14, traveller: 35 } } })
  await Service.updateOne({ slug: 'permanent-driver', $or: [{ pricingType: { $ne: 'monthly' } }, { monthlyRates: { $exists: false } }] }, { $set: { price: '₹15,000–₹22,000/month', pricingType: 'monthly', monthlyRates: { sixToEight: 15000, eightToTen: 18000, tenToTwelve: 22000 } } })
  await Service.updateOne({ slug: 'jaipur-tour', 'tourPlans.days': 2, 'tourPlans.price': '₹5,499' }, { $set: { price: 'Plans from ₹2,999', pricingType: 'fixed', 'tourPlans.$[plan].price': '₹3,499' } }, { arrayFilters: [{ 'plan.days': 2 }] })
  await Service.updateOne({ slug: 'driver-only' }, { $set: { price: '₹65/hr; ₹60/hr for 24 hours' } })
  await SiteSettings.findOneAndUpdate({}, { $set: { defaultServicesImported: true } }, { upsert: true })
}

router.get('/settings', async (_req, res) => {
  if (!isDatabaseConnected()) return res.json(defaultSettings)
  // A migration can create this document before contact details are saved.
  // Always return complete settings to frontend consumers.
  const storedSettings = (await SiteSettings.findOne().lean()) || {}
  const settings = { ...defaultSettings, ...storedSettings }
  delete settings.smtpPass
  delete settings.whatsappAccessToken
  const smtpUser = storedSettings.smtpUser || process.env.SMTP_USER || ''
  const smtpHost = storedSettings.smtpHost || (smtpUser.toLowerCase().endsWith('@gmail.com') ? 'smtp.gmail.com' : process.env.SMTP_HOST)
  settings.smtpHost = smtpHost || ''
  if (settings.contactEmail === 'support@chalakgo.in') settings.contactEmail = smtpUser || ''
  settings.smtpPassConfigured = Boolean(storedSettings.smtpPass || process.env.SMTP_PASS)
  settings.emailDeliveryConfigured = Boolean(
    smtpHost &&
    smtpUser &&
    (storedSettings.smtpPass || process.env.SMTP_PASS)
  )
  settings.whatsappConfigured = Boolean(storedSettings.whatsappPhoneNumberId && storedSettings.whatsappAccessToken && storedSettings.whatsappRecipient)
  settings.whatsappTokenConfigured = Boolean(storedSettings.whatsappAccessToken)
  res.json(normalizeAssetUrls(settings))
})
router.get('/hero-image', async (_req, res) => {
  const settings = isDatabaseConnected() ? await SiteSettings.findOne().lean() : null
  res.redirect(normalizeAssetUrls(settings?.heroImage || 'http://localhost:5173/src/assets/hero.png'))
})
router.put('/settings', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  try {
    const { _id, createdAt, updatedAt, __v, emailDeliveryConfigured, smtpPassConfigured, whatsappConfigured, whatsappTokenConfigured, ...updates } = req.body || {}
    if (!updates.smtpPass) delete updates.smtpPass
    if (!updates.whatsappAccessToken) delete updates.whatsappAccessToken
    const settings = await SiteSettings.findOneAndUpdate({}, updates, { new: true, upsert: true, runValidators: true })
    res.json(normalizeAssetUrls(settings.toObject()))
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to save website settings.' })
  }
})
router.get('/services', async (_req, res) => {
  if (!isDatabaseConnected()) return res.json([])
  await importDefaultServices()
  res.json(normalizeAssetUrls(await Service.find({ isActive: true }).sort({ name: 1 }).lean()))
})
router.get('/services/admin', requireAdmin, async (_req, res) => {
  if (!assertDb(res)) return
  await importDefaultServices()
  res.json(normalizeAssetUrls(await Service.find().sort({ name: 1 }).lean()))
})
router.post('/services', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  res.status(201).json(await Service.create(req.body))
})
router.put('/services/:id', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  const { _id, createdAt, updatedAt, __v, ...updates } = req.body || {}
  const service = await Service.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
  if (!service) return res.status(404).json({ message: 'Service not found.' })
  res.json(service)
})
router.delete('/services/:id', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  await Service.findByIdAndDelete(req.params.id)
  res.status(204).end()
})

router.get('/pages', async (_req, res) => {
  if (!isDatabaseConnected()) return res.json([])
  res.json(normalizeAssetUrls(await Page.find({ isPublished: true }).sort({ title: 1 }).lean()))
})
router.get('/pages/admin/all', requireAdmin, async (_req, res) => {
  if (!assertDb(res)) return
  res.json(normalizeAssetUrls(await Page.find().sort({ updatedAt: -1 }).lean()))
})
router.post('/pages', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  res.status(201).json(await Page.create(req.body))
})
router.put('/pages/:id', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  const { _id, createdAt, updatedAt, __v, ...updates } = req.body || {}
  const page = await Page.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
  if (!page) return res.status(404).json({ message: 'Page not found.' })
  res.json(page)
})
router.delete('/pages/:id', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  await Page.findByIdAndDelete(req.params.id)
  res.status(204).end()
})
router.get('/blogs', async (_req, res) => {
  if (!isDatabaseConnected()) return res.json([])
  res.json(normalizeAssetUrls(await Blog.find({ isPublished: true }).sort({ publishedAt: -1, createdAt: -1 }).lean()))
})
router.get('/blogs/admin/all', requireAdmin, async (_req, res) => {
  if (!assertDb(res)) return
  res.json(normalizeAssetUrls(await Blog.find().sort({ updatedAt: -1 }).lean()))
})
router.post('/blogs', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  res.status(201).json(await Blog.create(req.body))
})
router.put('/blogs/:id', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  const { _id, createdAt, updatedAt, __v, ...updates } = req.body || {}
  const blog = await Blog.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
  if (!blog) return res.status(404).json({ message: 'Blog post not found.' })
  res.json(normalizeAssetUrls(blog.toObject()))
})
router.delete('/blogs/:id', requireAdmin, async (req, res) => {
  if (!assertDb(res)) return
  await Blog.findByIdAndDelete(req.params.id)
  res.status(204).end()
})
router.get('/blogs/:slug', async (req, res) => {
  if (!isDatabaseConnected()) return res.status(404).json({ message: 'Blog post not found.' })
  const blog = await Blog.findOne({ slug: req.params.slug, isPublished: true })
  if (!blog) return res.status(404).json({ message: 'Blog post not found.' })
  res.json(blog)
})
router.get('/pages/:slug', async (req, res) => {
  if (!isDatabaseConnected()) return res.status(404).json({ message: 'Page not found.' })
  const page = await Page.findOne({ slug: req.params.slug, isPublished: true })
  if (!page) return res.status(404).json({ message: 'Page not found.' })
  res.json(normalizeAssetUrls(page.toObject()))
})
export default router

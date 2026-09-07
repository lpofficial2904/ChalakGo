import { config } from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { connectDatabaseWithRetry, disconnectDatabase, isDatabaseConnected } from './db.js'
import { requireAdmin } from './middleware/auth.js'
import bookingRoutes from './routes/bookings.js'
import reviewRoutes from './routes/reviews.js'
import authRoutes from './routes/auth.js'
import siteRoutes from './routes/site.js'
import userRoutes from './routes/users.js'
import contactRoutes from './routes/contacts.js'
import multer from 'multer'
import path from 'path'

// Use this project's .env values even if a stale shell variable exists.
config({ override: true })

const app = express()
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
])
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (such as curl/health checks) are safe
    // to accept; browser requests must come from one of the local Vite apps.
    callback(null, !origin || allowedOrigins.has(origin))
  },
  credentials: true
}))
app.use(cookieParser())
app.use(express.json())
const uploadDir = path.resolve('uploads')
const storage = multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`) })
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) })
app.use('/uploads', express.static(uploadDir))

const reverseGeocodeCache = new Map()
const reverseGeocodeCacheMs = 60_000

app.get('/api/health', (_req, res) => res.json({ ok: true, database: isDatabaseConnected() ? 'connected' : 'not connected' }))
app.post('/api/uploads', requireAdmin, (req, res) => upload.single('image')(req, res, error => {
  if (error) return res.status(400).json({ message: error.message || 'Please select an image smaller than 5 MB.' })
  if (!req.file) return res.status(400).json({ message: 'Please select a JPG, PNG, WEBP, or GIF image.' })
  res.status(201).json({ url: `/uploads/${req.file.filename}` })
}))
app.get('/api/location/reverse', async (req, res) => {
  const latitude = Number(req.query.latitude)
  const longitude = Number(req.query.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: 'Valid latitude and longitude are required.' })
  }

  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
  const cached = reverseGeocodeCache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < reverseGeocodeCacheMs) return res.json(cached.data)

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', zoom: '18', lat: String(latitude), lon: String(longitude), 'accept-language': 'en' })
    const response = await fetch(url, { headers: { 'User-Agent': 'ChalakGo booking location service/1.0', Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Location service returned ${response.status}`)
    const data = await response.json()
    reverseGeocodeCache.set(cacheKey, { data, createdAt: Date.now() })
    res.json(data)
  } catch (error) {
    res.status(502).json({ message: 'Unable to resolve this location right now.', error: error.message })
  }
})
app.use('/api/bookings', bookingRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/contacts', contactRoutes)
app.use('/api', siteRoutes)

const port = process.env.PORT || 5000
let server

async function isChalakGoApiRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`)
    const body = await response.json()
    return response.ok && body?.ok === true
  } catch {
    return false
  }
}

function startServer() {
  server = app.listen(port)
  server.once('listening', () => {
    console.log(`API running at http://localhost:${port}`)
    connectDatabaseWithRetry()
  })
  server.once('error', async (error) => {
    if (error.code === 'EADDRINUSE' && await isChalakGoApiRunning()) {
      console.log(`ChalakGo API is already running at http://localhost:${port}. Use that dev-server session instead of starting a second one.`)
      process.exit(0)
      return
    }
    console.error(`Server failed to listen on port ${port}:`, error.message)
    process.exit(1)
  })
}

async function shutdown() {
  await disconnectDatabase()
  server?.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2_000).unref()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

startServer()

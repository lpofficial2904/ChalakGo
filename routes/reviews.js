import { Router } from 'express'
import Review from '../models/Review.js'
import { requireAdmin } from '../middleware/auth.js'
import { normalizeAssetUrls } from '../utils/assets.js'

const router = Router()

router.get('/', async (_req, res) => {
  const reviews = await Review.find({ isPublished: true }).sort({ isFeatured: -1, createdAt: -1 })
  res.json(normalizeAssetUrls(reviews.map(review => review.toObject())))
})

router.get('/admin', requireAdmin, async (_req, res) => {
  const reviews = await Review.find().sort({ createdAt: -1 })
  res.json(normalizeAssetUrls(reviews.map(review => review.toObject())))
})

router.post('/', requireAdmin, async (req, res) => {
  try { res.status(201).json(await Review.create(req.body)) }
  catch (error) { res.status(400).json({ message: error.message }) }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!review) return res.status(404).json({ message: 'Review not found' })
    res.json(review)
  } catch (error) { res.status(400).json({ message: error.message }) }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id)
  if (!review) return res.status(404).json({ message: 'Review not found' })
  res.status(204).end()
})

export default router

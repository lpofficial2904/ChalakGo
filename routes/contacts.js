import { Router } from 'express'
import ContactMessage from '../models/ContactMessage.js'
import { requireAdmin } from '../middleware/auth.js'
import { isDatabaseConnected } from '../db.js'
const router = Router()
router.post('/', async (req, res) => { if (!isDatabaseConnected()) return res.status(503).json({ message: 'Contact service is unavailable.' }); try { res.status(201).json(await ContactMessage.create(req.body)) } catch (error) { res.status(400).json({ message: error.message }) } })
router.get('/admin', requireAdmin, async (_req, res) => res.json(await ContactMessage.find().sort({ createdAt: -1 })))
router.patch('/:id', requireAdmin, async (req, res) => { const item = await ContactMessage.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }); if (!item) return res.status(404).json({ message: 'Message not found.' }); res.json(item) })
export default router

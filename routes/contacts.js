import { Router } from 'express'
import ContactMessage from '../models/ContactMessage.js'
import { requireAdmin } from '../middleware/auth.js'
import { isDatabaseConnected } from '../db.js'
import { sendContactMessage } from '../utils/mailer.js'
import { sendWhatsAppText } from '../utils/whatsapp.js'
const router = Router()
router.post('/', async (req, res) => { if (!isDatabaseConnected()) return res.status(503).json({ message: 'Contact service is unavailable.' }); try { const message = await ContactMessage.create(req.body); let emailSent = false; let whatsappSent = false; try { emailSent = await sendContactMessage(message.toObject()) } catch (emailError) { console.error('Contact email notification failed:', emailError.message) } try { const item = message.toObject(); whatsappSent = await sendWhatsAppText(`New ChalakGo contact enquiry\n\nName: ${item.name}\nPhone: ${item.phone}\nEmail: ${item.email}\nMessage: ${item.message}`) } catch (whatsappError) { console.error('Contact WhatsApp notification failed:', whatsappError.message) } res.status(201).json({ message, emailSent, whatsappSent }) } catch (error) { res.status(400).json({ message: error.message }) } })
router.get('/admin', requireAdmin, async (_req, res) => res.json(await ContactMessage.find().sort({ createdAt: -1 })))
router.patch('/:id', requireAdmin, async (req, res) => { const item = await ContactMessage.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }); if (!item) return res.status(404).json({ message: 'Message not found.' }); res.json(item) })
export default router

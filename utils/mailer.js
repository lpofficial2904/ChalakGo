import nodemailer from 'nodemailer'
import SiteSettings from '../models/SiteSettings.js'

const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const replaceContactTokens = (template, message) => String(template || '')
  .replace(/\{\{name\}\}/gi, message.name)
  .replace(/\{\{phone\}\}/gi, message.phone)
  .replace(/\{\{email\}\}/gi, message.email)
  .replace(/\{\{message\}\}/gi, message.message)

async function transporter() {
  const settings = await SiteSettings.findOne().lean().catch(() => null)
  const user = settings?.smtpUser || process.env.SMTP_USER
  const host = settings?.smtpHost || (user?.toLowerCase().endsWith('@gmail.com') ? 'smtp.gmail.com' : process.env.SMTP_HOST)
  const port = Number(settings?.smtpPort || process.env.SMTP_PORT || 587)
  const pass = (settings?.smtpPass || process.env.SMTP_PASS || '').replace(/\s/g, '')
  if (!host || !user || !pass) throw new Error('Email service is not configured. Add SMTP settings in the admin panel.')
  return nodemailer.createTransport({
    host,
    port,
    secure: settings?.smtpSecure ?? (process.env.SMTP_SECURE === 'true' || port === 465),
    auth: { user, pass },
  })
}

export async function sendLoginOtp(email, otp) {
  const settings = await SiteSettings.findOne().lean().catch(() => null)
  if (settings?.emailOtpEnabled === false) throw new Error('Email OTP login is disabled by the administrator.')
  const siteName = settings?.siteName || 'ChalakGo'
  const from = settings?.otpEmailFrom || process.env.SMTP_FROM || settings?.smtpUser || process.env.SMTP_USER
  const subject = settings?.otpEmailSubject && !settings.otpEmailSubject.includes('@')
    ? settings.otpEmailSubject
    : `Your ${siteName} login OTP`
  await (await transporter()).sendMail({
    from,
    to: email,
    subject,
    text: `Your ${siteName} login OTP is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;padding:24px;color:#10213f"><h2>${siteName} login verification</h2><p>Use this one-time password to sign in:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1463e8">${otp}</p><p>This OTP expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  })
}

export async function sendBookingEmail(booking) {
  const settings = await SiteSettings.findOne().lean().catch(() => null)
  if (settings?.bookingEmailEnabled === false) return false
  const siteName = settings?.siteName || 'ChalakGo'
  const recipient = settings?.bookingEmail || settings?.contactEmail || settings?.smtpUser || settings?.email
  if (!recipient) throw new Error('Booking notification email is not configured.')
  const subject = settings?.bookingEmailSubject || `${siteName} booking: ${booking.service} - ${booking.fullName}`
  const text = `New booking\n\nBooking ID: ${booking.bookingId}\nService: ${booking.service}\nName: ${booking.fullName}\nPhone: ${booking.phone}\nEmail: ${booking.email}\nPickup: ${booking.pickupAddress || booking.pickupLocation || booking.address}\nDuration: ${booking.duration}\nCar type: ${booking.carType}\nTotal fare: ${booking.totalFare || 'Not calculated'}`
  await (await transporter()).sendMail({ from: settings?.otpEmailFrom || settings?.smtpUser || process.env.SMTP_USER, to: recipient, replyTo: booking.email, subject, text, html: `<div style="font-family:Arial;white-space:pre-wrap">${escapeHtml(text)}</div>` })
  return true
}

export async function sendContactMessage(message) {
  const settings = await SiteSettings.findOne().lean().catch(() => null)
  if (settings?.contactEmailEnabled === false) return false
  const siteName = settings?.siteName || 'ChalakGo'
  const from = settings?.otpEmailFrom || process.env.SMTP_FROM || settings?.smtpUser || process.env.SMTP_USER
  const smtpUser = settings?.smtpUser || process.env.SMTP_USER
  const configuredRecipient = settings?.contactEmail === 'support@chalakgo.in' ? '' : settings?.contactEmail
  const recipient = configuredRecipient || smtpUser || settings?.email
  if (!recipient) throw new Error('Contact recipient email is not configured.')
  const subject = replaceContactTokens(settings?.contactEmailSubject, message) || `${siteName} contact enquiry from ${message.name}`
  const textTemplate = settings?.contactEmailMessage || 'New contact enquiry\n\nName: {{name}}\nPhone: {{phone}}\nEmail: {{email}}\n\nMessage:\n{{message}}'
  const text = replaceContactTokens(textTemplate, message)
  await (await transporter()).sendMail({
    from,
    to: recipient,
    replyTo: message.email,
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;color:#10213f"><h2>${escapeHtml(subject)}</h2><p style="white-space:pre-wrap">${escapeHtml(text)}</p></div>`,
  })
}

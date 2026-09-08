import nodemailer from 'nodemailer'

const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

function transporter() {
  if (!smtpConfigured()) throw new Error('Email service is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS to the backend environment.')
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

export async function sendLoginOtp(email, otp) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  await transporter().sendMail({
    from,
    to: email,
    subject: 'Your ChalakGo login OTP',
    text: `Your ChalakGo login OTP is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;padding:24px;color:#10213f"><h2>ChalakGo login verification</h2><p>Use this one-time password to sign in:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1463e8">${otp}</p><p>This OTP expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  })
}

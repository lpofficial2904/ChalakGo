import nodemailer from "nodemailer";
import SiteSettings from "../models/SiteSettings.js";

const escapeHtml = (value) =>
  String(value || "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
const replaceContactTokens = (template, message) =>
  String(template || "")
    .replace(/\{\{name\}\}/gi, message.name)
    .replace(/\{\{phone\}\}/gi, message.phone)
    .replace(/\{\{email\}\}/gi, message.email)
    .replace(/\{\{message\}\}/gi, message.message);

const bookingValues = (booking, siteName) => ({
  siteName,
  bookingId: booking.bookingId,
  name: booking.fullName,
  email: booking.email,
  phone: booking.phone,
  service: booking.service,
  carType: booking.carType,
  duration: booking.duration,
  pickup: booking.pickupAddress || booking.pickupLocation || booking.address,
  startDateTime: booking.startDateTime || booking.startDate || "",
  endDateTime: booking.endDateTime || booking.endDate || "",
  distance: booking.distanceKm ? `${booking.distanceKm} km` : "",
  fare: booking.totalFare ? `Rs. ${booking.totalFare}` : booking.tourPlanPrice || "",
});

const replaceBookingTokens = (template, values) =>
  String(template || "").replace(/\{\{(siteName|bookingId|name|email|phone|service|carType|duration|pickup|startDateTime|endDateTime|distance|fare)\}\}/gi, (_token, key) => values[key] || "");

const emailShell = ({ siteName, eyebrow, title, content, footer }) =>
  `<div style="margin:0;padding:28px 12px;background:#f3f7ff;font-family:Arial,sans-serif;color:#172554"><div style="max-width:620px;margin:auto;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(23,37,84,.12)"><div style="padding:28px 32px;background:linear-gradient(135deg,#0a2d68,#1463e8);color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:1.5px">${escapeHtml(siteName).toUpperCase()} · ${escapeHtml(eyebrow)}</div><h1 style="margin:10px 0 0;font-size:25px;line-height:1.2">${escapeHtml(title)}</h1></div><div style="padding:28px 32px">${content}</div><div style="padding:16px 32px;background:#f8fafc;font-size:12px;line-height:1.5;color:#64748b">${footer || `This is an automated email from ${escapeHtml(siteName)}.`}</div></div></div>`;

async function transporter() {
  const settings = await SiteSettings.findOne()
    .lean()
    .catch(() => null);
  const user = settings?.smtpUser || process.env.SMTP_USER;
  const host =
    settings?.smtpHost ||
    (user?.toLowerCase().endsWith("@gmail.com")
      ? "smtp.gmail.com"
      : process.env.SMTP_HOST);
  const port = Number(settings?.smtpPort || process.env.SMTP_PORT || 587);
  const pass = (settings?.smtpPass || process.env.SMTP_PASS || "").replace(
    /\s/g,
    "",
  );
  if (!host || !user || !pass)
    throw new Error(
      "Email service is not configured. Add SMTP settings in the admin panel.",
    );
  return nodemailer.createTransport({
    host,
    port,
    secure:
      settings?.smtpSecure ??
      (process.env.SMTP_SECURE === "true" || port === 465),
    auth: { user, pass },
  });
}

export async function sendLoginOtp(email, otp) {
  const settings = await SiteSettings.findOne()
    .lean()
    .catch(() => null);
  if (settings?.emailOtpEnabled === false)
    throw new Error("Email OTP login is disabled by the administrator.");
  const siteName = settings?.siteName || "ChalakGo";
  const from =
    settings?.otpEmailFrom ||
    process.env.SMTP_FROM ||
    settings?.smtpUser ||
    process.env.SMTP_USER;
  const subject =
    settings?.otpEmailSubject && !settings.otpEmailSubject.includes("@")
      ? settings.otpEmailSubject
      : `Your ${siteName} login OTP`;
  await (
    await transporter()
  ).sendMail({
    from,
    to: email,
    subject,
    text: `Your ${siteName} login OTP is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
    html: emailShell({
      siteName,
      eyebrow: "SECURE SIGN-IN",
      title: "Verify your email address",
      content: `<p style="margin:0;font-size:16px;line-height:1.6">Use this one-time password to securely sign in to your account.</p><div style="margin:24px 0;border-radius:14px;background:#eff6ff;padding:20px;text-align:center"><div style="font-size:12px;font-weight:700;letter-spacing:1.4px;color:#1d4ed8">YOUR VERIFICATION CODE</div><div style="margin-top:9px;font-size:34px;font-weight:800;letter-spacing:9px;color:#0a2d68">${escapeHtml(otp)}</div></div><p style="margin:0;font-size:14px;line-height:1.6;color:#475569">This code expires in <b>10 minutes</b>. Do not share it with anyone. If you did not request it, you can safely ignore this email.</p>`,
      footer: `For your security, ${escapeHtml(siteName)} will never ask for this code by phone or message.`,
    }),
  });
}

export async function sendBookingEmail(booking) {
  const settings = await SiteSettings.findOne()
    .lean()
    .catch(() => null);
  if (settings?.bookingEmailEnabled === false) return false;
  const siteName = settings?.siteName || "ChalakGo";
  const recipient =
    settings?.bookingEmail ||
    settings?.contactEmail ||
    settings?.smtpUser ||
    settings?.email;
  if (!recipient)
    throw new Error("Booking notification email is not configured.");
  const subject =
    settings?.bookingEmailSubject ||
    `${siteName} booking: ${booking.service} - ${booking.fullName}`;
  const text = `New booking\n\nBooking ID: ${booking.bookingId}\nService: ${booking.service}\nName: ${booking.fullName}\nPhone: ${booking.phone}\nEmail: ${booking.email}\nPickup: ${booking.pickupAddress || booking.pickupLocation || booking.address}\nDuration: ${booking.duration}\nCar type: ${booking.carType}\nTotal fare: ${booking.totalFare || "Not calculated"}`;
  const rows = [
    ["Booking ID", booking.bookingId], ["Service", booking.service], ["Customer", booking.fullName],
    ["Mobile", booking.phone], ["Email", booking.email], ["Pickup", booking.pickupAddress || booking.pickupLocation || booking.address],
    ["Duration", booking.duration], ["Vehicle", booking.carType], ["Estimated fare", booking.totalFare ? `Rs. ${booking.totalFare}` : "Not calculated"],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
  await (
    await transporter()
  ).sendMail({
    from: settings?.otpEmailFrom || settings?.smtpUser || process.env.SMTP_USER,
    to: recipient,
    replyTo: booking.email,
    subject,
    text,
    html: emailShell({
      siteName,
      eyebrow: "BOOKING DESK",
      title: "New booking request",
      content: `<p style="margin:0 0 20px;font-size:16px;line-height:1.6">A new customer booking needs your attention.</p><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:10px 4px;border-bottom:1px solid #e5e7eb;color:#64748b;font-weight:700;width:38%;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 4px;border-bottom:1px solid #e5e7eb;font-weight:600;vertical-align:top">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="margin:22px 0 0;font-size:13px;color:#64748b">Reply directly to this email to contact ${escapeHtml(booking.fullName)}.</p>`,
    }),
  });
  return true;
}

export async function sendCustomerBookingEmail(booking, recipient) {
  const settings = await SiteSettings.findOne()
    .lean()
    .catch(() => null);
  if (settings?.customerBookingEmailEnabled === false || !recipient)
    return false;
  const siteName = settings?.siteName || "ChalakGo";
  const values = bookingValues(booking, siteName);
  const subject =
    settings?.customerBookingEmailSubject ||
    `${siteName} booking confirmation — ${booking.bookingId}`;
  const customerSubject = replaceBookingTokens(subject, values);
  const fields = [
    ["Booking ID", booking.bookingId],
    ["Service", booking.service],
    [
      "Plan",
      booking.tourPlanDays ? `${booking.tourPlanDays}-day Jaipur Tour` : "",
    ],
    ["Name", booking.fullName],
    ["Mobile", booking.phone],
    ["Email", booking.email],
    ["Car type", booking.carType],
    ["Trip duration", booking.duration],
    ["Distance", booking.distanceKm ? `${booking.distanceKm} km` : ""],
    ["Start date & time", booking.startDateTime || booking.startDate],
    ["End date & time", booking.endDateTime || booking.endDate],
    [
      "Pickup address",
      booking.pickupAddress || booking.pickupLocation || booking.address,
    ],
    ["Pickup latitude", booking.pickupLatitude],
    ["Pickup longitude", booking.pickupLongitude],
    [
      "Estimated fare",
      booking.totalFare ? `₹${booking.totalFare}` : booking.tourPlanPrice,
    ],
  ].filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  const message = replaceBookingTokens(
    settings?.customerBookingEmailMessage ||
      "Hello {{name}}, your booking request has been received. Our team will contact you shortly to confirm it.",
    values,
  );
  const text = `${message}\n\n${fields.map(([label, value]) => `${label}: ${value}`).join("\n")}`;
  await (
    await transporter()
  ).sendMail({
    from: settings?.otpEmailFrom || settings?.smtpUser || process.env.SMTP_USER,
    to: recipient,
    subject: customerSubject,
    text,
    html: `<div style="margin:0;padding:28px 12px;background:#f3f7ff;font-family:Arial,sans-serif;color:#172554"><div style="max-width:620px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(23,37,84,.12)"><div style="padding:28px 32px;background:linear-gradient(135deg,#0f4cbd,#1463e8);color:#fff"><div style="font-size:13px;font-weight:700;letter-spacing:1.4px">${escapeHtml(siteName).toUpperCase()}</div><h1 style="margin:10px 0 0;font-size:26px">Booking request received</h1></div><div style="padding:28px 32px"><p style="font-size:16px;line-height:1.6;margin-top:0">${escapeHtml(message)}</p><div style="background:#eff6ff;border-radius:10px;padding:12px 16px;margin:20px 0;color:#1e40af"><b>Booking ID: ${escapeHtml(booking.bookingId)}</b></div><h2 style="font-size:18px;margin:24px 0 8px">Your booking details</h2><table style="border-collapse:collapse;width:100%">${fields.map(([label, value]) => `<tr><td style="padding:10px 4px;border-bottom:1px solid #e5e7eb;font-weight:700;width:42%;vertical-align:top">${escapeHtml(label)}</td><td style="padding:10px 4px;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="margin:26px 0 0;font-size:13px;color:#64748b">Please keep this email for your records.</p></div></div></div>`,
  });
  return true;
}

export async function sendContactMessage(message) {
  const settings = await SiteSettings.findOne()
    .lean()
    .catch(() => null);
  if (settings?.contactEmailEnabled === false) return false;
  const siteName = settings?.siteName || "ChalakGo";
  const from =
    settings?.otpEmailFrom ||
    process.env.SMTP_FROM ||
    settings?.smtpUser ||
    process.env.SMTP_USER;
  const smtpUser = settings?.smtpUser || process.env.SMTP_USER;
  const configuredRecipient =
    settings?.contactEmail === "support@chalakgo.in"
      ? ""
      : settings?.contactEmail;
  const recipient = configuredRecipient || smtpUser || settings?.email;
  if (!recipient) throw new Error("Contact recipient email is not configured.");
  const subject =
    replaceContactTokens(settings?.contactEmailSubject, message) ||
    `${siteName} contact enquiry from ${message.name}`;
  const textTemplate =
    settings?.contactEmailMessage ||
    "New contact enquiry\n\nName: {{name}}\nPhone: {{phone}}\nEmail: {{email}}\n\nMessage:\n{{message}}";
  const text = replaceContactTokens(textTemplate, message);
  await (
    await transporter()
  ).sendMail({
    from,
    to: recipient,
    replyTo: message.email,
    subject,
    text,
    html: `<div style="margin:0;padding:28px 12px;background:#f3f7ff;font-family:Arial,sans-serif;color:#172554"><div style="max-width:620px;margin:auto;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(23,37,84,.12)"><div style="padding:28px 32px;background:linear-gradient(135deg,#0a2d68,#1463e8);color:#fff"><div style="font-size:12px;font-weight:700;letter-spacing:1.5px">${escapeHtml(siteName).toUpperCase()} · CONTACT DESK</div><h1 style="margin:10px 0 0;font-size:25px">New customer enquiry</h1></div><div style="padding:28px 32px"><p style="margin:0 0 20px;font-size:16px;line-height:1.6">A visitor has sent a message through your website.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#64748b;font-weight:700;width:30%">Name</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:700">${escapeHtml(message.name)}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#64748b;font-weight:700">Mobile</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a style="color:#1463e8;text-decoration:none" href="tel:${escapeHtml(message.phone)}">${escapeHtml(message.phone)}</a></td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#64748b;font-weight:700">Email</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb"><a style="color:#1463e8;text-decoration:none" href="mailto:${escapeHtml(message.email)}">${escapeHtml(message.email)}</a></td></tr></table><div style="margin-top:22px;border-radius:12px;background:#eff6ff;padding:18px"><div style="margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:1px;color:#1d4ed8">CUSTOMER MESSAGE</div><div style="white-space:pre-wrap;line-height:1.65">${escapeHtml(message.message)}</div></div><p style="margin:22px 0 0;font-size:13px;color:#64748b">Reply directly to this email to respond to ${escapeHtml(message.name)}.</p></div></div></div>`,
  });
  return true;
}

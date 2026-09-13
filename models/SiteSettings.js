import mongoose from "mongoose";
const imageField = {
  type: String,
  trim: true,
  validate: {
    validator(value) {
      if (!value) return true;
      if (/^\/(?!\/)/.test(value)) return true;
      try { return ["https:", "http:"].includes(new URL(value).protocol); }
      catch { return false; }
    },
    message: "Upload an image or enter a complete http(s) image URL.",
  },
};
const schema = new mongoose.Schema(
  {
    siteName: String,
    logo: imageField,
    navbarLogo: imageField,
    footerLogo: imageField,
    mainFavicon: imageField,
    adminFavicon: imageField,
    heroImage: imageField,
    aboutHeroImage: imageField,
    heroTitle: String,
    heroText: String,
    topBarMessage: String,
    phone: String,
    email: String,
    address: String,
    facebook: String,
    instagram: String,
    whatsapp: String,
    whatsappNumber: String,
    linkedin: String,
    youtube: String,
    otpEmailFrom: String,
    otpEmailSubject: String,
    bookingEmail: String,
    bookingEmailSubject: String,
    customerBookingEmailSubject: String,
    customerBookingEmailMessage: String,
    contactEmailSubject: String,
    contactEmailMessage: String,
    smtpHost: String,
    smtpPort: Number,
    smtpSecure: Boolean,
    smtpUser: String,
    smtpPass: String,
    contactEmail: String,
    emailOtpEnabled: { type: Boolean, default: true },
    bookingEmailEnabled: { type: Boolean, default: true },
    customerBookingEmailEnabled: { type: Boolean, default: true },
    contactEmailEnabled: { type: Boolean, default: true },
    whatsappEnabled: { type: Boolean, default: false },
    whatsappApiVersion: String,
    whatsappPhoneNumberId: String,
    whatsappAccessToken: String,
    whatsappRecipient: String,
    defaultServicesImported: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export default mongoose.models.SiteSettings ||
  mongoose.model("SiteSettings", schema);

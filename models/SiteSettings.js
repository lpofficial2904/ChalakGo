import mongoose from 'mongoose'
const schema = new mongoose.Schema({ siteName: String, logo: String, heroImage: String, phone: String, email: String, address: String, facebook: String, instagram: String, linkedin: String, youtube: String, defaultServicesImported: { type: Boolean, default: false } }, { timestamps: true })
export default mongoose.models.SiteSettings || mongoose.model('SiteSettings', schema)

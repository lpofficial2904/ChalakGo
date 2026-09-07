import mongoose from 'mongoose'
const tourPlanSchema = new mongoose.Schema({ days: { type: Number, required: true }, price: String, places: [String] }, { _id: false })
const schema = new mongoose.Schema({ slug: { type: String, required: true, unique: true, trim: true }, name: { type: String, required: true }, price: String, eyebrow: String, detail: String, features: [String], image: String, tourPlans: [tourPlanSchema], isActive: { type: Boolean, default: true } }, { timestamps: true })
export default mongoose.models.Service || mongoose.model('Service', schema)

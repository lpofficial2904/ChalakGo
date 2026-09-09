import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  mobile: { type: String, required: true, unique: true, match: [/^[6-9][0-9]{9}$/, 'Enter a valid Indian mobile number'] },
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true, match: [/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'] },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  passwordHash: { type: String },
  otpHash: { type: String, select: false },
  otpExpiresAt: { type: Date, select: false },
  otpAttempts: { type: Number, select: false, default: 0 },
}, { timestamps: true })

export default mongoose.models.User || mongoose.model('User', schema)

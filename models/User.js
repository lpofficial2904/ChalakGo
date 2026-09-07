import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  mobile: { type: String, required: true, unique: true, match: [/^[6-9][0-9]{9}$/, 'Enter a valid Indian mobile number'] },
  passwordHash: { type: String, required: true },
}, { timestamps: true })

export default mongoose.models.User || mongoose.model('User', schema)

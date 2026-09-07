import mongoose from 'mongoose'

const pickupSchema = new mongoose.Schema({
  source: { type: String, required: true, enum: ['current', 'manual'] },
  formattedAddress: { type: String, required: true, trim: true },
  area: { type: String, trim: true },
  pincode: { type: String, trim: true, match: [/^$|^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode'] },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  mainRoad: { type: String, trim: true },
  country: { type: String, trim: true, default: 'India' },
  coordinates: { latitude: Number, longitude: Number, accuracy: Number },
}, { _id: false })

const bookingSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, match: [/^[6-9][0-9]{9}$/, 'Enter a valid 10-digit Indian mobile number'] },
  email: { type: String, required: true, lowercase: true, trim: true },
  service: { type: String, required: true, enum: ['Driver Only', 'Car + Driver', 'Permanent Driver'] },
  pickup: { type: pickupSchema, required: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  pickupLocation: { type: String, required: true },
  coordinates: { latitude: Number, longitude: Number, accuracy: Number },
  duration: { type: String, required: true },
  carType: { type: String, required: true },
  startDate: { type: String, trim: true },
  endDate: { type: String, trim: true },
  startTime: { type: String, trim: true },
  endTime: { type: String, trim: true },
  startDateTime: { type: String, trim: true },
  endDateTime: { type: String, trim: true },
}, { timestamps: true })

export default bookingSchema

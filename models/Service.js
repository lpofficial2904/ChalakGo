import mongoose from "mongoose";
import { driverPricingSchema } from "../schemas/driverPricingSchema.js";
const tourPlanSchema = new mongoose.Schema(
  {
    days: { type: Number, required: true, min: 1, validate: Number.isInteger },
    title: String,
    description: String,
    price: String,
    places: [String],
    image: String,
  },
  { _id: false },
);
const cabPlanSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, enum: ["hatchback", "suv", "traveller"] },
    name: { type: String, required: true, trim: true },
    carType: { type: String, required: true, trim: true },
    seats: { type: String, trim: true },
    description: { type: String, trim: true },
    baseFare: { type: Number, min: 0, default: 0 },
    includedKm: { type: Number, min: 0, default: 0 },
    ratePerKm: { type: Number, min: 0, required: true },
  },
  { _id: false },
);
const schema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    price: String,
    pricingType: {
      type: String,
      enum: ["hourly", "daily", "distance", "monthly", "fixed"],
      default: "hourly",
    },
    driverPricing: { type: driverPricingSchema, default: undefined },
    vehicleRates: { suv: Number, hatchback: Number, traveller: Number },
    cabPlans: [cabPlanSchema],
    monthlyRates: {
      sixToEight: Number,
      eightToTen: Number,
      tenToTwelve: Number,
    },
    eyebrow: String,
    detail: String,
    content: String,
    pageContent: { type: Map, of: String },
    features: [String],
    image: String,
    tourPlans: [tourPlanSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export default mongoose.models.Service || mongoose.model("Service", schema);

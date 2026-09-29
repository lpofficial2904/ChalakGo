import mongoose from "mongoose";
import { validateDriverPricing } from "../shared/driverPricing.js";

const plan = new mongoose.Schema({
  id: { type: String, required: true, enum: ["4", "8", "10", "12", "outstation"] },
  label: { type: String, required: true, trim: true },
  hours: { type: Number, required: true, min: 0.5 },
  price: { type: Number, required: true, min: 0 },
  description: String,
}, { _id: false });

export const driverPricingSchema = new mongoose.Schema({
  version: Number,
  additionalHourlyRate: { type: Number, required: true, min: 0 },
  nightCharge: { type: Number, required: true, min: 0 },
  outstationMinimum: { type: Number, min: 0 },
  plans: { type: [plan], required: true },
}, { _id: false });

driverPricingSchema.pre("validate", function () {
  validateDriverPricing(this.toObject());
});

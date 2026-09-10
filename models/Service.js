import mongoose from "mongoose";
const tourPlanSchema = new mongoose.Schema(
  {
    days: { type: Number, required: true },
    title: String,
    description: String,
    price: String,
    places: [String],
    image: String,
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
    vehicleRates: { suv: Number, hatchback: Number, traveller: Number },
    monthlyRates: {
      sixToEight: Number,
      eightToTen: Number,
      tenToTwelve: Number,
    },
    eyebrow: String,
    detail: String,
    features: [String],
    image: String,
    tourPlans: [tourPlanSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export default mongoose.models.Service || mongoose.model("Service", schema);

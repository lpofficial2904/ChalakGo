import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    designation: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    avatar: { type: String, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 600 },
    rating: { type: Number, required: true, min: 1, max: 5, default: 5 },
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default reviewSchema;

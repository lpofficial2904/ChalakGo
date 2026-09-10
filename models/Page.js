import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    navigationLabel: { type: String, trim: true },
    heroTitle: { type: String, trim: true },
    excerpt: { type: String, trim: true },
    content: { type: String, default: "" },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    isPublished: { type: Boolean, default: true },
    statusOnly: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.models.Page || mongoose.model("Page", schema);

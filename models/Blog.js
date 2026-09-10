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
    excerpt: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    coverImage: { type: String, trim: true },
    author: { type: String, trim: true, default: "ChalakGo Team" },
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.Blog || mongoose.model("Blog", schema);

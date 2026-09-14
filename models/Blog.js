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
    authorBio: { type: String, trim: true },
    category: { type: String, trim: true },
    tags: [String],
    coverAlt: { type: String, trim: true },
    coverCaption: { type: String, trim: true },
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    socialImage: { type: String, trim: true },
    isFeatured: { type: Boolean, default: false },
    noindex: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.Blog || mongoose.model("Blog", schema);

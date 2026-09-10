import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, default: "new", enum: ["new", "read", "closed"] },
  },
  { timestamps: true },
);
export default mongoose.models.ContactMessage ||
  mongoose.model("ContactMessage", schema);

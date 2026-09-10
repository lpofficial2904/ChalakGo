import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "admin" },
  },
  { timestamps: true },
);

export default mongoose.models.Admin || mongoose.model("Admin", schema);

import mongoose from "mongoose";
const schema = new mongoose.Schema({
  _id: { type: String, default: "primary" },
  username: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  version: { type: String, required: true },
}, { timestamps: true });
export default mongoose.models.AdminCredentials || mongoose.model("AdminCredentials", schema);

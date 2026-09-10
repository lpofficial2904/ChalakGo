import mongoose from "mongoose";

// Holds sign-up details only until the email owner verifies the one-time code.
const schema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    mobile: { type: String, required: true, match: /^[6-9][0-9]{9}$/ },
    otpHash: { type: String, required: true, select: false },
    otpExpiresAt: { type: Date, required: true, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

export default mongoose.models.LoginOtp || mongoose.model("LoginOtp", schema);

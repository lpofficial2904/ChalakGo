import { Router } from "../utils/router.js";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import LoginOtp from "../models/LoginOtp.js";
import { isDatabaseConnected } from "../db.js";
import {
  clearUserSession,
  createUserSession,
  requireAdmin,
  requireUser,
} from "../middleware/auth.js";
import { createHash, randomInt } from "node:crypto";
import { sendLoginOtp } from "../utils/mailer.js";

const router = Router();
const mobileOf = (value) => String(value || "").replace(/\D/g, "");
const validPassword = (value) => typeof value === "string" && value.length >= 8;
const normaliseEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hashOtp = (value) => createHash("sha256").update(value).digest("hex");
const unavailable = (res) =>
  res
    .status(503)
    .json({ message: "Account service is temporarily unavailable." });

router.post("/login", async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  const mobile = mobileOf(req.body.mobile),
    password = String(req.body.password || "");
  const account = await User.findOne({ mobile });
  if (
    !account?.passwordHash ||
    !(await bcrypt.compare(password, account.passwordHash))
  )
    return res
      .status(401)
      .json({
        message:
          "Invalid mobile number or password. Use email OTP if this is an OTP-only account.",
      });
  const user = {
    id: account._id.toString(),
    fullName: account.fullName,
    mobile: account.mobile,
    email: account.email,
    role: account.role || "user",
  };
  res.json({ user, token: createUserSession(res, user) });
});
router.post("/otp/request", async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  const email = normaliseEmail(req.body.email);
  if (!validEmail(email))
    return res.status(400).json({ message: "Enter a valid email address." });
  let account = await User.findOne({ email }).select(
    "+otpHash +otpExpiresAt +otpAttempts",
  );
  let createdAccount = false;
  const isSignup = req.body.signup === true;
  if (!account && !isSignup)
    return res
      .status(404)
      .json({
        message: "No account exists for this email. Create an account to continue.",
      });
  if (!account) {
    const fullName = String(req.body.fullName || "").trim();
    const mobile = mobileOf(req.body.mobile);
    if (!fullName || !/^[6-9][0-9]{9}$/.test(mobile))
      return res.status(400).json({
        message: "Enter your full name and a valid 10-digit mobile number.",
      });
    try {
      account = await User.create({ fullName, mobile, email, role: "user" });
      createdAccount = true;
    } catch (error) {
      if (error?.code === 11000)
        return res.status(409).json({
          message: "An account already uses this mobile number or email. Please log in.",
        });
      return res.status(400).json({ message: error.message || "Unable to create account." });
    }
  }
  // Expiry is ten minutes after issuance; resend cooldown is only 45 seconds.
  if (account.otpExpiresAt?.getTime() - 10 * 60 * 1000 > Date.now() - 45_000)
    return res
      .status(429)
      .json({
        message: "Please wait 45 seconds before requesting another OTP.",
      });
  const otp = String(randomInt(100000, 1000000));
  try {
    await sendLoginOtp(email, otp);
  } catch (error) {
    if (createdAccount)
      await User.deleteOne({ _id: account._id }).catch(() => null);
    return res.status(503).json({ message: error.message });
  }
  const otpFields = {
    otpHash: hashOtp(otp),
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    otpAttempts: 0,
  };
  Object.assign(account, otpFields);
  await account.save();
  res.json({
    message: isSignup ? "Account created. OTP sent to your email address." : "OTP sent to your email address.",
    expiresIn: 600,
  });
});
router.post("/otp/verify", async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  const email = normaliseEmail(req.body.email),
    otp = String(req.body.otp || "").trim();
  if (!validEmail(email) || !/^\d{6}$/.test(otp))
    return res
      .status(400)
      .json({ message: "Enter your email and the 6-digit OTP." });
  const account = await User.findOne({ email }).select(
    "+otpHash +otpExpiresAt +otpAttempts",
  );
  if (
    !account?.otpHash ||
    !account.otpExpiresAt ||
    account.otpExpiresAt < new Date()
  )
    return res
      .status(401)
      .json({ message: "This OTP has expired. Request a new one." });
  if (account.otpAttempts >= 5)
    return res
      .status(429)
      .json({ message: "Too many incorrect attempts. Request a new OTP." });
  if (hashOtp(otp) !== account.otpHash) {
    account.otpAttempts += 1;
    await account.save();
    return res
      .status(401)
      .json({ message: "Incorrect OTP. Please try again." });
  }
  account.otpHash = undefined;
  account.otpExpiresAt = undefined;
  account.otpAttempts = 0;
  await account.save();
  const user = {
    id: account._id.toString(),
    fullName: account.fullName,
    mobile: account.mobile,
    email: account.email,
    role: account.role || "user",
  };
  res.json({ user, token: createUserSession(res, user) });
});
router.get("/me", requireUser, (req, res) => res.json({ user: req.user }));
router.get("/admin", requireAdmin, async (_req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  res.json(await User.find().select("-passwordHash").sort({ createdAt: -1 }));
});
router.get(
  "/admin",
  async (req, res, next) => {
    try {
      const { requireAdmin } = await import("../middleware/auth.js");
      requireAdmin(req, res, next);
    } catch {
      res.status(401).json({ message: "Login required." });
    }
  },
  async (_req, res) => {
    if (!isDatabaseConnected()) return unavailable(res);
    const users = await User.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(users);
  },
);
router.patch("/admin/:id/role", requireAdmin, async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  const role = String(req.body.role || "");
  if (!["user", "admin"].includes(role))
    return res.status(400).json({ message: "Role must be user or admin." });
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true },
  ).select("-passwordHash -otpHash -otpExpiresAt");
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json(user);
});
router.post("/logout", (_req, res) => {
  clearUserSession(res);
  res.status(204).end();
});
export default router;

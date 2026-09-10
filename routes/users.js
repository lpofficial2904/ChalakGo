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
const otpDeliveryMessage = (error) => {
  // Do not expose SMTP provider details or credentials in the customer UI.
  // Gmail rejects normal account passwords; it requires an App Password.
  if (
    error?.code === "EAUTH" ||
    /badcredentials|username and password not accepted|invalid login/i.test(
      error?.message || "",
    )
  )
    return "OTP email service is not authenticated. The administrator must update the Gmail App Password in Email Notifications.";
  return error?.message || "Unable to send OTP. Please try again.";
};
const unavailable = (res) =>
  res
    .status(503)
    .json({ message: "Account service is temporarily unavailable." });

router.post("/login", async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  const identifier = String(req.body.identifier || req.body.mobile || "")
      .trim()
      .toLowerCase(),
    password = String(req.body.password || "");
  if (!identifier || !validPassword(password))
    return res.status(400).json({
      message: "Enter your username or email and a password of at least 8 characters.",
    });
  const account = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }, { mobile: mobileOf(identifier) }],
  });
  if (!account)
    return res
      .status(401)
      .json({
        message: "Invalid mobile number or password.",
      });
  if (!account.passwordHash)
    return res.status(401).json({
      message:
        "This account has no password yet. Use email OTP to sign in, or create a new account with a password.",
    });
  if (!(await bcrypt.compare(password, account.passwordHash)))
    return res.status(401).json({ message: "Invalid mobile number or password." });
  const user = {
    id: account._id.toString(),
    fullName: account.fullName,
    mobile: account.mobile,
    email: account.email,
    role: account.role || "user",
  };
  res.json({ user, token: createUserSession(res, user) });
});
router.post("/signup", async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  const fullName = String(req.body.fullName || "").trim();
  const mobile = mobileOf(req.body.mobile);
  const email = normaliseEmail(req.body.email);
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!fullName || !/^[6-9][0-9]{9}$/.test(mobile))
    return res.status(400).json({ message: "Enter your full name and a valid 10-digit mobile number." });
  if (!validEmail(email))
    return res.status(400).json({ message: "Enter a valid email address." });
  if (username && !/^[a-z0-9_]{3,30}$/.test(username))
    return res.status(400).json({ message: "Username must be 3-30 letters, numbers, or underscores." });
  if (!validPassword(password))
    return res.status(400).json({ message: "Password must contain at least 8 characters." });
  try {
    const account = await User.create({ fullName, mobile, ...(email ? { email } : {}), ...(username ? { username } : {}), passwordHash: await bcrypt.hash(password, 12), role: "user" });
    const user = { id: account._id.toString(), fullName: account.fullName, mobile: account.mobile, email: account.email, role: account.role };
    res.status(201).json({ user, token: createUserSession(res, user) });
  } catch (error) {
    if (error?.code === 11000)
      return res.status(409).json({ message: "This username, email, or mobile number is already registered." });
    return res.status(400).json({ message: error.message || "Unable to create account." });
  }
});
router.post("/otp/request", async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  const email = normaliseEmail(req.body.email);
  if (!validEmail(email))
    return res.status(400).json({ message: "Enter a valid email address." });
  const isSignup = req.body.signup === true;
  if (!isSignup) {
    const account = await User.findOne({ email }).select(
      "+otpHash +otpExpiresAt +otpAttempts",
    );
    if (!account)
      return res.status(404).json({ message: "No account exists for this email. Please sign up first." });
    if (account.otpExpiresAt?.getTime() - 10 * 60 * 1000 > Date.now() - 45_000)
      return res.status(429).json({ message: "Please wait 45 seconds before requesting another OTP." });
    const otp = String(randomInt(100000, 1000000));
    try {
      await sendLoginOtp(email, otp);
    } catch (error) {
      return res.status(503).json({ message: otpDeliveryMessage(error) });
    }
    account.otpHash = hashOtp(otp);
    account.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    account.otpAttempts = 0;
    await account.save();
    return res.json({ message: "OTP sent to your email address.", expiresIn: 600 });
  }

  const mobile = mobileOf(req.body.mobile);
  const username = String(req.body.username || "").trim().toLowerCase();
  if (!/^[6-9][0-9]{9}$/.test(mobile))
    return res.status(400).json({ message: "Enter a valid 10-digit mobile number." });
  if (!/^[a-z0-9_]{3,30}$/.test(username))
    return res.status(400).json({ message: "Username must be 3-30 letters, numbers, or underscores." });
  const duplicate = await User.findOne({ $or: [{ email }, { mobile }, { username }] }).lean();
  if (duplicate)
    return res.status(409).json({ message: "This mobile number, username, or email is already registered. Please log in." });
  let pending = await LoginOtp.findOne({ email }).select("+otpHash +otpExpiresAt +otpAttempts");
  if (pending && pending.otpExpiresAt?.getTime() - 10 * 60 * 1000 > Date.now() - 45_000)
    return res
      .status(429)
      .json({
        message: "Please wait 45 seconds before requesting another OTP.",
      });
  const otp = String(randomInt(100000, 1000000));
  try {
    await sendLoginOtp(email, otp);
  } catch (error) {
    return res.status(503).json({ message: otpDeliveryMessage(error) });
  }
  const otpFields = {
    otpHash: hashOtp(otp),
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    otpAttempts: 0,
  };
  if (pending) {
    Object.assign(pending, { mobile, username, ...otpFields });
    await pending.save();
  } else {
    await LoginOtp.create({ email, mobile, username, ...otpFields });
  }
  res.json({
    message: "OTP sent to your email address.",
    expiresIn: 600,
  });
});
router.post("/otp/verify", async (req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  const email = normaliseEmail(req.body.email),
    otp = String(req.body.otp || "").trim(),
    isSignup = req.body.signup === true;
  if (!validEmail(email) || !/^\d{6}$/.test(otp))
    return res
      .status(400)
      .json({ message: "Enter your email and the 6-digit OTP." });
  const account = isSignup
    ? await LoginOtp.findOne({ email }).select("+otpHash +otpExpiresAt +otpAttempts")
    : await User.findOne({ email }).select("+otpHash +otpExpiresAt +otpAttempts");
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
  let userAccount = account;
  if (isSignup) {
    try {
      userAccount = await User.create({
        fullName: account.username,
        mobile: account.mobile,
        username: account.username,
        email: account.email,
        role: "user",
      });
      await LoginOtp.deleteOne({ _id: account._id });
    } catch (error) {
      if (error?.code === 11000)
        return res.status(409).json({ message: "This mobile number, username, or email is already registered." });
      return res.status(400).json({ message: error.message || "Unable to create account." });
    }
  } else {
    account.otpHash = undefined;
    account.otpExpiresAt = undefined;
    account.otpAttempts = 0;
    await account.save();
  }
  const user = {
    id: userAccount._id.toString(),
    fullName: userAccount.fullName,
    mobile: userAccount.mobile,
    email: userAccount.email,
    role: userAccount.role || "user",
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

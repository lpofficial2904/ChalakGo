import AdminCredentials from "../models/AdminCredentials.js";
import { randomUUID } from "node:crypto";
import { Router } from "../utils/router.js";
import bcrypt from "bcryptjs";
import {
  clearAdminSession,
  createAdminSession,
  requireAdmin,
} from "../middleware/auth.js";
import { isDatabaseConnected } from "../db.js";
import Admin from "../models/Admin.js";

const router = Router();
const normaliseMobile = (value) => String(value || "").replace(/\D/g, "");
const validPassword = (value) => typeof value === "string" && value.length >= 8;

router.get("/status", async (_req, res) => {
  if (isDatabaseConnected() && await AdminCredentials.exists({ _id: "primary" })) return res.json({ setupRequired: false, environmentLogin: true });
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD)
    return res.json({ setupRequired: false, environmentLogin: true });
  if (!isDatabaseConnected())
    return res.status(503).json({ message: "Database is not connected." });
  res.json({
    setupRequired: (await Admin.countDocuments()) === 0,
    environmentLogin: false,
  });
});

router.post("/setup", async (req, res) => {
  if (!isDatabaseConnected())
    return res.status(503).json({ message: "Database is not connected." });
  const mobile = normaliseMobile(req.body.mobile);
  const password = String(req.body.password || "");
  if (!/^\d{10}$/.test(mobile) || !validPassword(password))
    return res
      .status(400)
      .json({
        message:
          "Enter a valid 10-digit mobile number and a password of at least 8 characters.",
      });
  if ((process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) || await AdminCredentials.exists({ _id: "primary" }) || await Admin.countDocuments())
    return res
      .status(409)
      .json({ message: "An admin account already exists. Please log in." });
  const admin = await Admin.create({
    mobile,
    passwordHash: await bcrypt.hash(password, 12),
  });
  const session = { mobile: admin.mobile, role: admin.role };
  const token = createAdminSession(res, session);
  res.status(201).json({ admin: session, token, expiresIn: "24h" });
});

router.post("/login", async (req, res) => {
  if (!isDatabaseConnected()) return res.status(503).json({ message: "Database is not connected." });
  const configured = await AdminCredentials.findById("primary").select("+passwordHash");
  if (configured) {
    if (String(req.body.username || '').trim() !== configured.username || !(await bcrypt.compare(String(req.body.password || ''), configured.passwordHash))) return res.status(401).json({ message: "Invalid username or password." });
    const admin = { username: configured.username, role: 'admin', credentialVersion: configured.version };
    return res.json({ admin, token: createAdminSession(res, admin), expiresIn: '24h' });
  }
  const username = String(req.body.username || "").trim();
  const mobile = normaliseMobile(req.body.mobile);
  const password = String(req.body.password || "");
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    )
      return res.status(401).json({ message: "Invalid username or password." });
    const admin = { username, role: "admin" };
    const token = createAdminSession(res, admin);
    return res.json({ admin, token, expiresIn: "24h" });
  }
  if (!isDatabaseConnected())
    return res.status(503).json({ message: "Database is not connected." });
  const account = await Admin.findOne({ mobile });
  if (!account || !(await bcrypt.compare(password, account.passwordHash)))
    return res
      .status(401)
      .json({ message: "Invalid mobile number or password." });
  const admin = { mobile: account.mobile, role: account.role };
  const token = createAdminSession(res, admin);
  res.json({ admin, token, expiresIn: "24h" });
});
router.put("/credentials", requireAdmin, async (req, res) => {
  if (!isDatabaseConnected()) return res.status(503).json({ message: "Database is not connected." });
  const username = String(req.body.username || '').trim();
  const password = String(req.body.newPassword || '');
  const currentPassword = String(req.body.currentPassword || '');
  if (!/^[a-zA-Z0-9_.@-]{3,80}$/.test(username) || password.length < 8 || Buffer.byteLength(password) > 72) return res.status(400).json({ message: "Use a 3?80 character username and a password of at least 8 characters (maximum 72 bytes)." });
  const configured = await AdminCredentials.findById('primary').select('+passwordHash');
  let valid = false;
  if (configured) valid = await bcrypt.compare(currentPassword, configured.passwordHash);
  else if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) valid = currentPassword === process.env.ADMIN_PASSWORD;
  else if (req.admin.mobile) {
    const account = await Admin.findOne({ mobile: req.admin.mobile });
    valid = Boolean(account && await bcrypt.compare(currentPassword, account.passwordHash));
  }
  if (!valid) return res.status(401).json({ message: "Current password is incorrect." });
  const version = randomUUID();
  const saved = await AdminCredentials.findOneAndUpdate({ _id: 'primary', ...(configured ? { version: configured.version } : { version: { $exists: false } }) }, { $set: { username, passwordHash: await bcrypt.hash(password, 12), version } }, { upsert: !configured, new: true, runValidators: true });
  if (!saved) return res.status(409).json({ message: "Credentials changed in another session. Sign in again." });
  const admin = { username, role: 'admin', credentialVersion: version };
  res.json({ admin, token: createAdminSession(res, admin), message: "Admin credentials updated." });
});
router.get("/me", requireAdmin, (req, res) => res.json({ admin: req.admin }));
router.post("/logout", (_req, res) => {
  clearAdminSession(res);
  res.status(204).end();
});
export default router;

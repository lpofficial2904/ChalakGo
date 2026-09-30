import AdminCredentials from "../models/AdminCredentials.js";
import User from "../models/User.js";
import { isDatabaseConnected } from "../db.js";
import jwt from "jsonwebtoken";

const cookieName = "chalakgo_session";
const maxAge = 24 * 60 * 60 * 1000;
const secret = () =>
  process.env.JWT_SECRET || "development-only-change-this-jwt-secret";

export async function requireAdmin(req, res, next) {
  try {
    const token =
      req.cookies?.[cookieName] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Login required." });
    req.admin = jwt.verify(token, secret());                                                                             
    if (req.admin.role !== "admin")
      return res.status(403).json({ message: "Admin access required." });
    if (!isDatabaseConnected()) return res.status(503).json({ message: "Database is not connected." });
    if (req.admin.id) {
      const account = await User.findById(req.admin.id);
      if (!account || account.role !== "admin") return res.status(403).json({ message: "Admin access required." });
    }
    const configured = await AdminCredentials.findById('primary');
    if (configured && !req.admin.id && req.admin.credentialVersion !== configured.version) return res.status(401).json({ message: "Admin credentials changed. Please sign in again." });
    next();
  } catch {
    res
      .status(401)
      .json({ message: "Your session has expired. Please log in again." });
  }
}

export function createAdminSession(res, admin) {
  const token = jwt.sign(admin, secret(), { expiresIn: "24h" });
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  });
  return token;
}

export function clearAdminSession(res) {
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}


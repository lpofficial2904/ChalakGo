import jwt from "jsonwebtoken";

const cookieName = "chalakgo_session";
const maxAge = 24 * 60 * 60 * 1000;
const secret = () =>
  process.env.JWT_SECRET || "development-only-change-this-jwt-secret";

export function requireAdmin(req, res, next) {
  try {
    const token =
      req.cookies?.[cookieName] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return res.status(401).json({ message: "Login required." });
    req.admin = jwt.verify(token, secret());
    if (req.admin.role !== "admin")
      return res.status(403).json({ message: "Admin access required." });
    next();
  } catch {
    res
      .status(401)
      .json({ message: "Your session has expired. Please log in again." });
  }
}

export function requireUser(req, res, next) {
  try {
    const token =
      req.cookies?.chalakgo_user_session ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token)
      return res
        .status(401)
        .json({ message: "Please log in to book a driver." });
    const user = jwt.verify(token, secret());
    if (!["user", "admin"].includes(user.role))
      return res.status(403).json({ message: "Customer account required." });
    req.user = user;
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

export function createUserSession(res, user) {
  const token = jwt.sign(user, secret(), { expiresIn: "24h" });
  res.cookie("chalakgo_user_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  });
  return token;
}

export function clearUserSession(res) {
  res.clearCookie("chalakgo_user_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

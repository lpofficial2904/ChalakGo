import { Router } from "../utils/router.js";
import User from "../models/User.js";
import { isDatabaseConnected } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

// Customer accounts are no longer needed; only protected record management remains.
const router = Router();
const unavailable = res => res.status(503).json({ message: "Database is not connected." });

router.get("/admin", requireAdmin, async (_req, res) => {
  if (!isDatabaseConnected()) return unavailable(res);
  res.json(await User.find().select("-passwordHash").sort({ createdAt: -1 }));
});
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
router.delete("/admin/:id", requireAdmin, async (req, res) => {
  if (req.admin.id === req.params.id) return res.status(409).json({ message: "You cannot delete your own signed-in account." });
  if (!isDatabaseConnected()) return res.status(503).json({ message: "Database is not connected." });
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ message: "Invalid record ID." });
  const deleted = await User.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Record not found." });
  res.status(204).end();
});
export default router;

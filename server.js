import { config } from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import {
  connectDatabaseWithRetry,
  disconnectDatabase,
  isDatabaseConnected,
} from "./db.js";
import { requireAdmin } from "./middleware/auth.js";
import bookingRoutes from "./routes/bookings.js";
import locationRoutes from "./routes/location.js";
import reviewRoutes from "./routes/reviews.js";
import authRoutes from "./routes/auth.js";
import siteRoutes from "./routes/site.js";
import userRoutes from "./routes/users.js";
import contactRoutes from "./routes/contacts.js";
import multer from "multer";
import path from "path";
import { apiErrorHandler } from "./utils/router.js";
import { siteEvents, notifySiteChanges } from "./utils/siteEvents.js";

// Use this project's .env values even if a stale shell variable exists.
config({ override: true });

const app = express();
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://chalakgo-admin.netlify.app",
  "https://chalakgoo.netlify.app",
  "https://spectacular-druid-d51e06.netlify.app/",
  "https://visionary-gaufre-b94cb4.netlify.app/",
  "https://chalakgo.com/",
  "https://admin.chalakgo.com/",
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);
const isAllowedOrigin = (origin) => {
  if (!origin || allowedOrigins.has(origin)) return true;
  // Netlify assigns a different preview URL for deployments. Allow only its
  // HTTPS subdomains so a newly deployed customer site does not break CORS.
  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      /^[a-z0-9-]+\.netlify\.app$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
};
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (such as curl/health checks) are safe
      // to accept; browser requests must come from a configured app origin.
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.get("/api/events", siteEvents);
app.use(notifySiteChanges);
const uploadDir = path.resolve("uploads");
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) =>
    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`,
    ),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    database: isDatabaseConnected() ? "connected" : "not connected",
  }),
);
app.post("/api/uploads", requireAdmin, (req, res) =>
  upload.single("image")(req, res, (error) => {
    if (error)
      return res
        .status(400)
        .json({
          message: error.message || "Please select an image smaller than 5 MB.",
        });
    if (!req.file)
      return res
        .status(400)
        .json({ message: "Please select a JPG, PNG, WEBP, or GIF image." });
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  }),
);
app.use("/api/location", locationRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api", siteRoutes);
app.use(apiErrorHandler);

const port = process.env.PORT || 5500;
let server;

async function isChalakGoApiRunning() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await response.json();
    return response.ok && body?.ok === true;
  } catch {
    return false;
  }
}

function startServer() {
  server = app.listen(port);
  server.once("listening", () => {
    console.log(`API running at http://localhost:${port}`);
    connectDatabaseWithRetry();
  });
  server.once("error", async (error) => {
    if (error.code === "EADDRINUSE" && (await isChalakGoApiRunning())) {
      console.log(
        `ChalakGo API is already running at http://localhost:${port}. Use that dev-server session instead of starting a second one.`,
      );
      process.exit(0);
      return;
    }
    console.error(`Server failed to listen on port ${port}:`, error.message);
    process.exit(1);
  });
}

async function shutdown() {
  await disconnectDatabase();
  server?.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

startServer();

import { Router } from "../utils/router.js";
import { isDatabaseConnected } from "../db.js";
import Booking from "../models/Booking.js";
import { requireAdmin } from "../middleware/auth.js";
import { notifyAdminRequests } from "../utils/adminEvents.js";
import { generateBookingId } from "../utils/bookingId.js";
import Service from "../models/Service.js";
import { sendBookingEmail, sendCustomerBookingEmail } from "../utils/mailer.js";
import { sendWhatsAppText } from "../utils/whatsapp.js";

const router = Router();

router.post("/", async (req, res) => {
  if (!isDatabaseConnected()) {
    return res
      .status(503)
      .json({
        message:
          "Booking service is temporarily unavailable. MongoDB is not connected.",
      });
  }
  try {
    const accountEmail = req.body.email;
    const payload = {
      ...req.body,
      email: accountEmail,
      fullName: req.body.fullName,
      phone: req.body.phone,
    };
    // A GPS reading is useful even when reverse geocoding has no address.
    // Older Netlify builds sent its coordinate fallback only as `address`,
    // while the booking schema also requires the two pickup address fields.
    // Normalise those variants before validation so every service can book.
    const pickupAddress = [
      payload.pickupAddress,
      payload.pickupLocation,
      payload.pickup?.formattedAddress,
      payload.address,
    ].find((value) => typeof value === "string" && value.trim())?.trim();
    if (pickupAddress) {
      payload.address = payload.address || pickupAddress;
      payload.pickupLocation = payload.pickupLocation || pickupAddress;
      payload.pickupAddress = payload.pickupAddress || pickupAddress;
      payload.pickup = {
        ...payload.pickup,
        formattedAddress: payload.pickup?.formattedAddress || pickupAddress,
      };
    }
    // Pricing configuration must come from the saved service, never the client.
    delete payload.driverPricing;
    delete payload.serviceSlug;
    if (payload.service) {
      const service = await Service.findOne({
        name: payload.service,
        isActive: true,
      }).lean();
      if (service) {
        payload.serviceSlug = service.slug;
        if (service.slug === "driver-only") {
          payload.driverPricing = service.driverPricing;
          // Night applicability is calculated from the schedule, not a stale
          // checkbox value sent by an older frontend.
          payload.nightCharge = false;
        }
      }
      if (service?.price) payload.servicePrice = service.price;
      if (service?.pricingType) payload.pricingType = service.pricingType;
      if (service?.vehicleRates) payload.vehicleRates = service.vehicleRates;
      if (service?.monthlyRates) payload.monthlyRates = service.monthlyRates;
      if (service?.tourPlans?.length && payload.tourPlanDays) {
        const plan = service.tourPlans.find(
          (item) => item.days === Number(payload.tourPlanDays),
        );
        if (!plan)
          return res
            .status(400)
            .json({ message: "Please select a valid Jaipur Tour plan." });
        payload.pricingType = "fixed";
        payload.tourPlanPrice = plan.price;
      }
    }
    const isCurrentPickup = payload.pickup?.source === "current";
    const pickupLatitude = payload.pickupLatitude;
    const pickupLongitude = payload.pickupLongitude;
    const pickupAccuracy = payload.pickupAccuracy;
    const pickupTimestamp = payload.pickupTimestamp;
    if (
      isCurrentPickup &&
      (!Number.isFinite(pickupLatitude) ||
        pickupLatitude < -90 ||
        pickupLatitude > 90 ||
        !Number.isFinite(pickupLongitude) ||
        pickupLongitude < -180 ||
        pickupLongitude > 180)
    ) {
      return res
        .status(400)
        .json({
          message: "A valid GPS pickup latitude and longitude are required.",
        });
    }
    if (
      isCurrentPickup &&
      (!Number.isFinite(pickupAccuracy) ||
        pickupAccuracy < 0 ||
        !Number.isFinite(pickupTimestamp) ||
        pickupTimestamp <= 0)
    ) {
      return res
        .status(400)
        .json({
          message:
            "GPS accuracy and timestamp are required for a current pickup.",
        });
    }
    if (isCurrentPickup) {
      payload.pickupLatitude = pickupLatitude;
      payload.pickupLongitude = pickupLongitude;
      payload.pickupAccuracy = pickupAccuracy;
      payload.pickupTimestamp = pickupTimestamp;
      payload.locationSource = payload.locationSource || "gps";
      payload.pickupAddress = payload.pickupAddress || payload.pickupLocation || payload.address;
      payload.pickupHouseNumber =
        payload.pickupHouseNumber || payload.houseNumber || "";
      payload.pickupBuildingName =
        payload.pickupBuildingName || payload.buildingName || "";
      payload.pickupRoad = payload.pickupRoad || payload.road || "";
      payload.pickupArea = payload.pickupArea || payload.area || "";
      payload.pickupCity = payload.pickupCity || payload.city || "";
      payload.pickupState = payload.pickupState || payload.state || "";
      payload.pickupPincode = payload.pickupPincode || payload.pincode || "";
      payload.pickupCountry = payload.pickupCountry || payload.country || "";
      payload.coordinates = {
        latitude: pickupLatitude,
        longitude: pickupLongitude,
        accuracy: pickupAccuracy,
      };
      payload.pickup = {
        ...payload.pickup,
        coordinates: payload.coordinates,
        formattedAddress: payload.pickupAddress,
      };
    }
    let booking;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        booking = await Booking.create({
          ...payload,
          bookingId: generateBookingId(),
        });
        break;
      } catch (error) {
        if (
          error.code !== 11000 ||
          !error.keyPattern?.bookingId ||
          attempt === 4
        )
          throw error;
      }
    }
    // Store and confirm the booking before sending optional notifications.
    notifyAdminRequests();
    // SMTP/WhatsApp providers can be slow or unavailable; waiting for them
    // kept the customer UI stuck indefinitely on "Saving your booking...".
    res.status(201).json({
      message: "Booking created",
      booking,
      emailSent: false,
      customerEmailSent: false,
      whatsappSent: false,
    });

    const bookingData = booking.toObject();
    void Promise.allSettled([
      sendBookingEmail(bookingData),
      accountEmail ? sendCustomerBookingEmail(bookingData, accountEmail) : Promise.resolve(false),
      sendWhatsAppText(
        `New ChalakGo booking\n\nBooking ID: ${booking.bookingId}\nService: ${booking.service}\nName: ${booking.fullName}\nPhone: ${booking.phone}\nEmail: ${booking.email || "Not provided"}\nPickup: ${booking.pickupAddress || booking.pickupLocation || booking.address}\nDuration: ${booking.duration}\nCar type: ${booking.carType}\nTotal fare: ${booking.totalFare || "Not calculated"}`,
      ),
    ]).then((results) => {
      const labels = ["Booking email", "Customer booking email", "Booking WhatsApp notification"];
      results.forEach((result, index) => {
        if (result.status === "rejected")
          console.error(`${labels[index]} failed:`, result.reason?.message || result.reason);
      });
    });
  } catch (error) {
    const validationMessage =
      error?.name === "ValidationError"
        ? Object.values(error.errors || {})[0]?.message
        : "";
    res
      .status(400)
      .json({
        message: validationMessage || "Unable to create booking",
        error: error.message,
      });
  }
});
router.get("/admin", requireAdmin, async (_req, res) => {
  if (!isDatabaseConnected())
    return res.status(503).json({ message: "Database is not connected." });
  res.json(await Booking.find().sort({ createdAt: -1 }));
});

router.delete("/admin/:id", requireAdmin, async (req, res) => {
  if (!isDatabaseConnected()) return res.status(503).json({ message: "Database is not connected." });
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ message: "Invalid record ID." });
  const deleted = await Booking.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Record not found." });
  res.status(204).end();
});
export default router;

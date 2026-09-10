import { Router } from "../utils/router.js";
import { isDatabaseConnected } from "../db.js";
import Booking from "../models/Booking.js";
import { requireUser } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import { generateBookingId } from "../utils/bookingId.js";
import Service from "../models/Service.js";
import { sendBookingEmail, sendCustomerBookingEmail } from "../utils/mailer.js";
import { sendWhatsAppText } from "../utils/whatsapp.js";

const router = Router();

router.post("/", requireUser, async (req, res) => {
  if (!isDatabaseConnected()) {
    return res
      .status(503)
      .json({
        message:
          "Booking service is temporarily unavailable. MongoDB is not connected.",
      });
  }
  try {
    const payload = {
      ...req.body,
      // A confirmation must always go to, and be recorded against, the signed-in account.
      email: req.user.email,
      fullName: req.body.fullName || req.user.fullName,
      phone: req.body.phone || req.user.mobile,
    };
    if (payload.service) {
      const service = await Service.findOne({
        name: payload.service,
        isActive: true,
      }).lean();
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
      payload.pickupAddress = payload.pickupAddress || payload.pickupLocation;
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
    let emailSent = false;
    let customerEmailSent = false;
    let whatsappSent = false;
    try {
      emailSent = await sendBookingEmail(booking.toObject());
    } catch (error) {
      console.error("Booking email notification failed:", error.message);
    }
    try {
      customerEmailSent = await sendCustomerBookingEmail(
        booking.toObject(),
        req.user.email,
      );
    } catch (error) {
      console.error("Customer booking email failed:", error.message);
    }
    try {
      whatsappSent = await sendWhatsAppText(
        `New ChalakGo booking\n\nBooking ID: ${booking.bookingId}\nService: ${booking.service}\nName: ${booking.fullName}\nPhone: ${booking.phone}\nEmail: ${booking.email}\nPickup: ${booking.pickupAddress || booking.pickupLocation || booking.address}\nDuration: ${booking.duration}\nCar type: ${booking.carType}\nTotal fare: ${booking.totalFare || "Not calculated"}`,
      );
    } catch (error) {
      console.error("Booking WhatsApp notification failed:", error.message);
    }
    res
      .status(201)
      .json({
        message: "Booking created",
        booking,
        emailSent,
        customerEmailSent,
        whatsappSent,
      });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Unable to create booking", error: error.message });
  }
});
router.get("/admin", requireAdmin, async (_req, res) => {
  if (!isDatabaseConnected())
    return res.status(503).json({ message: "Database is not connected." });
  res.json(await Booking.find().sort({ createdAt: -1 }));
});

export default router;

import mongoose from "mongoose";
import {
  calculateDistanceFare,
  calculateFixedFare,
  calculateMonthlyFare,
  calculateTemporaryDriverFare,
} from "../utils/temporaryDriverFare.js";

const pickupSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, enum: ["current", "manual"] },
    formattedAddress: { type: String, required: true, trim: true },
    houseNumber: { type: String, trim: true },
    buildingName: { type: String, trim: true },
    building: { type: String, trim: true },
    area: { type: String, trim: true },
    locality: { type: String, trim: true },
    neighbourhood: { type: String, trim: true },
    suburb: { type: String, trim: true },
    pincode: {
      type: String,
      trim: true,
      match: [/^$|^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"],
    },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    road: { type: String, trim: true },
    state: { type: String, trim: true },
    mainRoad: { type: String, trim: true },
    country: { type: String, trim: true, default: "India" },
    coordinates: { latitude: Number, longitude: Number, accuracy: Number },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true, sparse: true, immutable: true },
    fullName: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      match: [/^[6-9][0-9]{9}$/, "Enter a valid 10-digit Indian mobile number"],
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    service: { type: String, required: true, trim: true },
    pickup: { type: pickupSchema, required: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    pickupLocation: { type: String, required: true },
    coordinates: { latitude: Number, longitude: Number, accuracy: Number },
    pickupLatitude: { type: Number, min: -90, max: 90 },
    pickupLongitude: { type: Number, min: -180, max: 180 },
    pickupAccuracy: { type: Number, min: 0 },
    pickupTimestamp: { type: Number, min: 0 },
    pickupAddress: { type: String, trim: true },
    pickupHouseNumber: { type: String, trim: true },
    pickupBuildingName: { type: String, trim: true },
    pickupRoad: { type: String, trim: true },
    pickupArea: { type: String, trim: true },
    pickupCity: { type: String, trim: true },
    pickupState: { type: String, trim: true },
    pickupPincode: {
      type: String,
      trim: true,
      match: [/^$|^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"],
    },
    pickupCountry: { type: String, trim: true },
    houseNumber: { type: String, trim: true },
    buildingName: { type: String, trim: true },
    road: { type: String, trim: true },
    area: { type: String, trim: true },
    pincode: {
      type: String,
      trim: true,
      match: [/^$|^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"],
    },
    neighbourhood: { type: String, trim: true },
    suburb: { type: String, trim: true },
    locality: { type: String, trim: true },
    district: { type: String, trim: true },
    country: { type: String, trim: true },
    locationSource: {
      type: String,
      enum: ["gps", "manually_adjusted_pin", "manual"],
    },
    duration: { type: String, required: true },
    durationMinutes: Number,
    totalFare: Number,
    servicePrice: String,
    pricingType: String,
    vehicleRates: { suv: Number, hatchback: Number, traveller: Number },
    monthlyRates: {
      sixToEight: Number,
      eightToTen: Number,
      tenToTwelve: Number,
    },
    tourPlanDays: Number,
    tourPlanPrice: String,
    distanceKm: Number,
    carType: { type: String, required: true },
    startDate: { type: String, trim: true },
    endDate: { type: String, trim: true },
    startTime: { type: String, trim: true },
    endTime: { type: String, trim: true },
    startDateTime: { type: String, trim: true },
    endDateTime: { type: String, trim: true },
  },
  { timestamps: true },
);

bookingSchema.pre("validate", function () {
  if (!this.servicePrice && this.service !== "Driver Only") return;
  try {
    const fare =
      this.pricingType === "distance"
        ? calculateDistanceFare(this)
        : this.pricingType === "monthly"
          ? calculateMonthlyFare(this)
          : this.pricingType === "fixed"
            ? calculateFixedFare(this)
            : calculateTemporaryDriverFare({
                ...this.toObject(),
                price: this.servicePrice || "₹65/hr; ₹60/hr for 24 hours",
              });
    if (fare.duration !== undefined) this.duration = fare.duration;
    if (fare.durationMinutes !== undefined)
      this.durationMinutes = fare.durationMinutes;
    if (fare.totalFare !== undefined) this.totalFare = fare.totalFare;
    if (this.startDateTime)
      [this.startDate, this.startTime] = this.startDateTime.split("T");
    if (this.endDateTime)
      [this.endDate, this.endTime] = this.endDateTime.split("T");
  } catch (error) {
    this.invalidate("endDateTime", error.message);
  }
});

export default bookingSchema;

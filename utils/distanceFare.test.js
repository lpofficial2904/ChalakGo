import test from "node:test";
import assert from "node:assert/strict";
import { calculateDistanceFare as serverFare } from "./temporaryDriverFare.js";
import { calculateDistanceFare as browserFare } from "../../frontend/src/utils/fare.js";
import Booking from "../models/Booking.js";

test("flat fare boundary, extra kilometres, seating variants and missing rates agree on client/server", () => {
  for (const [carType, base, rate] of [
    ["Hatchback (5 seater)", 3000, 11],
    ["SUV (5 seater)", 3500, 12],
    ["SUV (7 seater)", 3500, 12],
  ]) {
    for (const distanceKm of [1, 10, 249, 250, 251, 250.5, 300]) {
      const input = { carType, distanceKm, vehicleRates: {} };
      const fare = serverFare(input);
      assert.deepEqual(browserFare(input), fare);
      assert.equal(fare.totalFare, base + Math.max(0, distanceKm - 250) * rate);
      assert.equal(fare.baseFare, base);
    }
  }
  assert.equal(
    serverFare({ carType: "Haravan Traveller", distanceKm: 300 }).totalFare,
    10500,
  );
  for (const distanceKm of [0, -1, "", "bad"])
    assert.throws(() => serverFare({ carType: "Hatchback", distanceKm }));
});

test("booking schema recalculates flat plus excess distance rather than trusting supplied total", async () => {
  const booking = new Booking({
    fullName: "Test Customer",
    phone: "9876543210",
    email: "test@example.com",
    service: "Cab (Car + Driver)",
    servicePrice: "Cab tariff",
    pricingType: "distance",
    vehicleRates: { hatchback: 11 },
    carType: "Hatchback (5 seater)",
    distanceKm: 300,
    duration: "300 km",
    totalFare: 1,
    pickup: { source: "manual", formattedAddress: "Jaipur" },
    address: "Jaipur",
    pickupLocation: "Jaipur",
  });
  await booking.validate();
  assert.equal(booking.totalFare, 3550);
});

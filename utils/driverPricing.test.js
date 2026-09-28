import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DRIVER_PRICING, calculateDriverOnlyFare, validateDriverPricing, driverPricing } from "../../shared/driverPricing.js";
import Service from "../models/Service.js";
import Booking from "../models/Booking.js";

test("admin rates persist in the service schema and determine booking charges", async () => {
  const pricing = structuredClone(DEFAULT_DRIVER_PRICING);
  pricing.plans[1] = { ...pricing.plans[1], price: 950, label: "Office day", hours: 7 };
  pricing.additionalHourlyRate = 120;
  pricing.nightCharge = 200;
  const service = new Service({ name: "Personal chauffeur", slug: "driver-only", driverPricing: pricing });
  await service.validate();
  assert.equal(service.toObject().driverPricing.plans[1].label, "Office day");
  const booking = new Booking({
    fullName: "Test", phone: "9876543210", email: "test@example.com",
    service: service.name, serviceSlug: service.slug,
    driverPricing: service.driverPricing, driverPackage: "8",
    pickup: { source: "manual", formattedAddress: "Jaipur" },
    address: "Jaipur", pickupLocation: "Jaipur", carType: "Sedan / SUV", duration: "8 hours",
    startDateTime: "2026-09-28T15:00", endDateTime: "2026-09-28T23:00", totalFare: 1,
  });
  await booking.validate();
  assert.equal(booking.totalFare, 950 + 120 + 200);
  assert.equal(booking.durationMinutes, 480);
});

test("night policy uses trip overlap, including midnight and exact boundaries", () => {
  for (const [start, end, expected] of [
    ["2026-09-28T18:00", "2026-09-28T22:00", 0],
    ["2026-09-28T18:00", "2026-09-28T22:01", 200],
    ["2026-09-28T23:00", "2026-09-29T03:00", 200],
    ["2026-09-28T05:59", "2026-09-28T09:59", 200],
    ["2026-09-28T06:00", "2026-09-28T10:00", 0],
  ]) assert.equal(calculateDriverOnlyFare({ startDateTime: start, endDateTime: end, driverPackage: "4" }).nightFare, expected);
});

test("malformed prices, missing plans and invalid schedules are rejected", () => {
  assert.throws(() => validateDriverPricing({ ...DEFAULT_DRIVER_PRICING, nightCharge: -1 }));
  assert.throws(() => validateDriverPricing({ ...DEFAULT_DRIVER_PRICING, plans: DEFAULT_DRIVER_PRICING.plans.slice(1) }));
  for (const endDateTime of ["invalid", "2026-02-30T12:00", "2026-09-28T10:00"])
    assert.throws(() => calculateDriverOnlyFare({ startDateTime: "2026-09-28T10:00", endDateTime }));
});

test("outstation uses the fixed daily rate, rounds partial days up and adds night once", () => {
  const fare = calculateDriverOnlyFare({ driverPackage: "outstation", startDateTime: "2026-09-26T17:21", endDateTime: "2026-09-29T17:21" });
  assert.equal(fare.baseFare, 3600);
  assert.equal(fare.baseHours, 72);
  assert.equal(fare.additionalFare, 0);
  assert.equal(fare.nightFare, 200);
  assert.equal(fare.totalFare, 3800);
  const partial = calculateDriverOnlyFare({ driverPackage: "outstation", startDateTime: "2026-09-26T10:00", endDateTime: "2026-09-27T10:01" });
  assert.equal(partial.baseFare, 2400);
});

test("old night defaults upgrade while subsequent admin edits remain configurable", () => {
  const old = structuredClone(DEFAULT_DRIVER_PRICING);
  delete old.version;
  old.nightCharge = 20;
  old.plans[1].label = "8 Hours / Full Day";
  const updated = driverPricing(old);
  assert.equal(updated.nightCharge, 200);
  assert.equal(updated.plans[1].label, "8 Hours");
  assert.equal(driverPricing({ ...updated, nightCharge: 50 }).nightCharge, 50);
});

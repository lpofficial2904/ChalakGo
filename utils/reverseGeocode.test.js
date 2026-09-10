import test from "node:test";
import assert from "node:assert/strict";
import { createReverseGeocoder, parseCoordinate } from "./reverseGeocode.js";
import {
  addressFormValues,
  pickupPayload,
} from "../../frontend/src/utils/location.js";
import Booking from "../models/Booking.js";

test("endpoint coordinates reject missing, blank, array and out of range values", () => {
  for (const value of [undefined, null, "", " ", ["1"], "NaN", "91"])
    assert.throws(() => parseCoordinate(value, 90));
  assert.equal(parseCoordinate("0", 90), 0);
  assert.equal(parseCoordinate("-180", 180), -180);
});

test("uses precise coordinates, identifies app, coalesces and caches lookups", async () => {
  let calls = 0;
  let resolveResponse;
  const geocode = createReverseGeocoder({
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url.searchParams.get("lat"), "12.3456789");
      assert.equal(url.searchParams.get("lon"), "76.5432198");
      assert.equal(url.searchParams.get("addressdetails"), "1");
      assert.ok(options.headers["User-Agent"].includes("ChalakGo"));
      assert.ok(options.signal);
      return new Promise((resolve) => {
        resolveResponse = resolve;
      });
    },
  });
  const first = geocode(12.3456789, 76.5432198);
  const second = geocode(12.3456789, 76.5432198);
  await assert.rejects(geocode(13, 77), (error) => error.status === 429);
  resolveResponse({
    ok: true,
    json: async () => ({ display_name: "Test address" }),
  });
  assert.deepEqual(await first, await second);
  await geocode(12.3456789, 76.5432198);
  assert.equal(calls, 1);
});

test("rate limiting and cache expiry do not reuse neighbouring coordinates", async () => {
  let time = 1000;
  let calls = 0;
  const geocode = createReverseGeocoder({
    now: () => time,
    fetchImpl: async () => {
      calls++;
      return { ok: true, json: async () => ({ display_name: "Test address" }) };
    },
  });
  await geocode(12.345671, 76);
  await assert.rejects(geocode(12.345672, 76), (error) => error.status === 429);
  time += 1100;
  await geocode(12.345672, 76);
  assert.equal(calls, 2);
  time += 300001;
  await geocode(12.345671, 76);
  assert.equal(calls, 3);
});

test("upstream errors and unmapped coordinates fail without fabricated data", async () => {
  for (const response of [
    { ok: false, status: 503 },
    { ok: true, json: async () => ({ error: "Unable to geocode" }) },
  ]) {
    const geocode = createReverseGeocoder({ fetchImpl: async () => response });
    await assert.rejects(geocode(1, 2));
  }
});

test("booking schema preserves edited structured address and coordinates", async () => {
  const form = {
    ...addressFormValues(null),
    address: "Corrected address",
    houseNumber: "8",
    buildingName: "Test Apartments",
    mainRoad: "Test Street",
    neighbourhood: "Test Neighbourhood",
    suburb: "Test Suburb",
    locality: "Test Locality",
    district: "Test District",
    pincode: "302001",
  };
  const booking = new Booking({
    ...form,
    ...pickupPayload(
      form,
      "current",
      { latitude: 12.3456789, longitude: 76.5432198, accuracy: 12 },
      123456,
    ),
    fullName: "Test User",
    phone: "9876543210",
    email: "test@example.com",
    service: "Driver Only",
    carType: "Sedan",
    startDateTime: "2026-09-08T13:11",
    endDateTime: "2026-09-08T19:12",
  });
  await booking.validate();
  assert.equal(booking.pickup.buildingName, form.buildingName);
  assert.equal(booking.pickup.neighbourhood, form.neighbourhood);
  assert.equal(booking.pickup.district, form.district);
  assert.equal(booking.pickup.formattedAddress, form.address);
  assert.equal(booking.pickupLatitude, 12.3456789);
  assert.equal(booking.totalFare, 1000);
});

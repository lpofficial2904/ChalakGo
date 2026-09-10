// Temporary-driver pricing, used by both the booking validator and the UI.
// A booking includes the first 10 hours for a flat rate. Each later hour is billed
// separately, then the one-time promotional discount is applied.
export const TEMPORARY_DRIVER_PRICING = {
  baseHours: 10,
  baseFare: 1200,
  additionalHourlyRate: 99,
  promotionalDiscount: 200,
};

function parseBookingTime(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  ) {
    throw new Error("Select a valid start and end date/time.");
  }
  const milliseconds = Date.parse(`${value}:00Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 16) !== value
  ) {
    throw new Error("Select a valid start and end date/time.");
  }
  return milliseconds;
}

export function calculateTemporaryDriverFare({ startDateTime, endDateTime }) {
  const durationMinutes =
    (parseBookingTime(endDateTime) - parseBookingTime(startDateTime)) / 60000;
  if (durationMinutes <= 0)
    throw new Error("End date/time must be after start date/time.");

  const durationHours = durationMinutes / 60;
  const additionalHours = Math.max(
    0,
    durationHours - TEMPORARY_DRIVER_PRICING.baseHours,
  );
  const additionalFare =
    additionalHours * TEMPORARY_DRIVER_PRICING.additionalHourlyRate;
  const subtotal = TEMPORARY_DRIVER_PRICING.baseFare + additionalFare;
  const discount = Math.min(
    TEMPORARY_DRIVER_PRICING.promotionalDiscount,
    subtotal,
  );

  return {
    durationMinutes,
    duration: `${Math.floor(durationMinutes / 60)} hours ${durationMinutes % 60} minutes`,
    baseHours: TEMPORARY_DRIVER_PRICING.baseHours,
    baseFare: TEMPORARY_DRIVER_PRICING.baseFare,
    additionalHours,
    additionalHourlyRate: TEMPORARY_DRIVER_PRICING.additionalHourlyRate,
    additionalFare: Math.round(additionalFare * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    discount,
    totalFare: Math.round((subtotal - discount) * 100) / 100,
  };
}

export function calculateDistanceFare({ distanceKm, carType, vehicleRates }) {
  const distance = Number(distanceKm);
  const type = String(carType);
  const traveller = /traveller/i.test(type);
  const suv = /suv/i.test(type);
  if (!traveller && !suv && !/hatchback/i.test(type))
    throw new Error("Select a valid car type.");
  const configuredRate = Number(
    vehicleRates?.[traveller ? "traveller" : suv ? "suv" : "hatchback"],
  );
  const rate =
    Number.isFinite(configuredRate) && configuredRate > 0
      ? configuredRate
      : traveller
        ? 35
        : suv
          ? 12
          : 11;
  if (!Number.isFinite(distance) || distance <= 0)
    throw new Error("Enter a valid trip distance in kilometres.");
  const includedKm = traveller ? 0 : 250;
  const baseFare = traveller ? 0 : suv ? 3500 : 3000;
  const additionalKm = Math.max(0, distance - includedKm);
  const additionalFare = Math.round(additionalKm * rate * 100) / 100;
  return {
    distanceKm: distance,
    includedKm,
    baseFare,
    additionalKm,
    additionalFare,
    ratePerKm: rate,
    totalFare: Math.round((baseFare + additionalFare) * 100) / 100,
  };
}

export function calculateMonthlyFare({ duration, monthlyRates }) {
  const rates = monthlyRates || {};
  const key = /6\s*[–-]\s*8/.test(String(duration))
    ? "sixToEight"
    : /8\s*[–-]\s*10/.test(String(duration))
      ? "eightToTen"
      : /10\s*[–-]\s*12/.test(String(duration))
        ? "tenToTwelve"
        : "";
  const monthlyRate = Number(rates[key]);
  if (!key || !Number.isFinite(monthlyRate) || monthlyRate <= 0)
    throw new Error("Select a valid permanent driver shift.");
  return { monthlyRate, totalFare: monthlyRate };
}

export function calculateFixedFare({ tourPlanPrice }) {
  const amount = Number(String(tourPlanPrice || "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("This tour plan does not have a valid price.");
  return { totalFare: amount };
}

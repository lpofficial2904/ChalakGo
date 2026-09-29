export const DEFAULT_DRIVER_PRICING = {
  version: 2,
  additionalHourlyRate: 99,
  nightCharge: 200,
  outstationMinimum: 1200,
  plans: [
    { id: "4", label: "First 4 Hours", hours: 4, price: 499, description: "Short local trips & city errands" },
    { id: "8", label: "8 Hours", hours: 8, price: 899, description: "Full day office commutes & family travel" },
    { id: "10", label: "10 Hours", hours: 10, price: 1099, description: "Extended daily travel across Jaipur" },
    { id: "12", label: "12 Hours", hours: 12, price: 1299, description: "Full day duty for long journeys & events" },
    { id: "outstation", label: "Outstation / Multi-day", hours: 24, price: 1200, description: "Driver food & stay charged separately" },
  ],
};

export function driverPricing(value) {
  if (value?.toObject) value = value.toObject();
  // Upgrade only the previous defaults; future admin edits carry version 2.
  if (value && !value.version) value = {
    ...value,
    nightCharge: value.nightCharge == null || value.nightCharge === 20 ? 200 : value.nightCharge,
    plans: value.plans?.map(plan => plan.id === "8" && plan.label === "8 Hours / Full Day" ? { ...plan, label: "8 Hours" } : plan),
  };
  return {
    ...DEFAULT_DRIVER_PRICING,
    ...value,
    version: 2,
    plans: value?.plans?.length ? value.plans : DEFAULT_DRIVER_PRICING.plans,
  };
}

export function validateDriverPricing(value) {
  const config = driverPricing(value);
  const validAmount = (amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0;
  if (![config.additionalHourlyRate, config.nightCharge].every(validAmount))
    throw new Error("Enter valid non-negative driver rates.");
  const ids = DEFAULT_DRIVER_PRICING.plans.map((plan) => plan.id);
  if (config.plans.length !== ids.length || new Set(config.plans.map((plan) => plan.id)).size !== ids.length)
    throw new Error("All five driver plans are required.");
  for (const plan of config.plans) {
    if (!ids.includes(plan.id) || !plan.label?.trim() || !validAmount(plan.price) || !Number.isFinite(plan.hours) || plan.hours <= 0)
      throw new Error("Each driver plan needs a title, positive hours and a valid price.");
  }
  return config;
}

export function calculateDriverOnlyFare({ startDateTime, endDateTime, driverPackage = "8", driverPricing: configuredPricing, nightCharge = false }) {
  const config = validateDriverPricing(configuredPricing);
  const plan = config.plans.find((item) => item.id === driverPackage);
  if (!plan) throw new Error("Select a valid driver package.");
  const parse = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Select a valid start and end date/time.");
    const time = Date.parse(`${value}:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 16) !== value) throw new Error("Select a valid start and end date/time.");
    return time;
  };
  const start = parse(startDateTime);
  const end = parse(endDateTime);
  const durationMinutes = (end - start) / 60000;
  if (durationMinutes <= 0) throw new Error("End date/time must be after start date/time.");
  // datetime-local represents the service's local clock. Check overlap with
  // 22:00–06:00 without applying the server's timezone to that clock.
  const startHour = new Date(start).getUTCHours() + new Date(start).getUTCMinutes() / 60;
  const overlapsNight = startHour < 6 || startHour >= 22 || durationMinutes > (22 - startHour) * 60;
  const outstation = plan.id === "outstation";
  const days = Math.max(1, Math.ceil(durationMinutes / 1440));
  const baseFare = plan.price * (outstation ? days : 1);
  const additionalHours = outstation ? 0 : Math.max(0, durationMinutes / 60 - plan.hours);
  const additionalFare = Math.round(additionalHours * config.additionalHourlyRate * 100) / 100;
  const nightFare = overlapsNight || nightCharge ? config.nightCharge : 0;
  const totalFare = Math.round((baseFare + additionalFare + nightFare) * 100) / 100;
  return {
    durationMinutes, duration: `${Math.floor(durationMinutes / 60)} hours ${durationMinutes % 60} minutes`,
    baseHours: outstation ? days * 24 : plan.hours, baseFare, additionalHours, additionalHourlyRate: config.additionalHourlyRate,
    additionalFare, nightFare, subtotal: totalFare, discount: 0, totalFare,
    outstation, days, maximumFare: totalFare,
  };
}

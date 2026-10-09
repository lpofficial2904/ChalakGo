export const addressFields = [
  ["House / flat number", "houseNumber"],
  ["Apartment / building name", "buildingName"],
  ["Street / road", "mainRoad"],
  ["Neighbourhood", "neighbourhood"],
  ["Suburb", "suburb"],
  ["Locality", "locality"],
  ["Area", "area"],
  ["City / town / village", "city"],
  ["District", "district"],
  ["State", "state"],
  ["Pincode", "pincode"],
  ["Country", "country"],
];

export function addressFormValues(details) {
  return {
    ...Object.fromEntries(
      addressFields.map(([, name]) => [
        name,
        details?.[name === "mainRoad" ? "road" : name] || "",
      ]),
    ),
    address: details?.formattedAddress || "",
  };
}

export function pickupPayload(form, source, coordinates, timestamp) {
  const pickup = {
    source,
    formattedAddress: form.address,
    houseNumber: form.houseNumber || "",
    buildingName: form.buildingName || "",
    building: form.buildingName || "",
    road: form.mainRoad || "",
    area: form.area || "",
    city: form.city || "",
    neighbourhood: form.neighbourhood || "",
    suburb: form.suburb || "",
    locality: form.locality || "",
    district: form.district || "",
    state: form.state || "",
    pincode: form.pincode || "",
    country: form.country || "",
    ...(source === "current" ? { coordinates } : {}),
  };
  return {
    pickup,
    pickupLocation: form.address,
    pickupAddress: form.address,
    pickupHouseNumber: pickup.houseNumber,
    pickupBuildingName: pickup.buildingName,
    pickupRoad: pickup.road,
    road: pickup.road,
    pickupArea: pickup.area,
    pickupCity: pickup.city,
    pickupState: pickup.state,
    pickupPincode: pickup.pincode,
    pickupCountry: pickup.country,
    locationSource: source === "current" ? "gps" : "manual",
    ...(source === "current"
      ? {
          coordinates,
          pickupLatitude: coordinates?.latitude,
          pickupLongitude: coordinates?.longitude,
          pickupAccuracy: coordinates?.accuracy,
          pickupTimestamp: timestamp,
        }
      : {}),
  };
}

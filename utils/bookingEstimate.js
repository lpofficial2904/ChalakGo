export function formatBookingEstimate(booking) {
  const value = booking.totalFare;
  if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) {
    return 'Rs. ' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return booking.tourPlanPrice ? String(booking.tourPlanPrice) : 'Not calculated';
}

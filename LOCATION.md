# Current-location setup

The header and booking form automatically request location on page open/reload, as requested by the site owner. They share one acquisition to avoid duplicate calls, including React StrictMode remounts. Browser permission is still required. Explicit refresh requests a fresh acquisition. Up to three sequential, uncached high-accuracy fixes are attempted within approximately 30 seconds; acquisition stops early at 30-metre accuracy. The best reported reading is used for a single reverse lookup. There is no continuous tracking. Serve the frontend over HTTPS (localhost works for development). The device/browser controls permission and accuracy. Returned map address details can be missing or refer to a nearby mapped feature; customers must be able to review and edit them.

In Vite development, customer login, bookings and location lookups use the `/api` proxy to `http://127.0.0.1:5000`. Keep the local backend running. `VITE_API_BASE_URL` can override the API explicitly. Production builds use `https://api.chalakgo.com`. Deploy backend and frontend changes together.

The backend proxies Nominatim. Set `NOMINATIM_REVERSE_URL` to switch the reverse endpoint without a frontend release, and `NOMINATIM_USER_AGENT` to identify the application and a contact URL. No keys are required for the public OpenStreetMap endpoint.

Public Nominatim allows at most one request per second for the entire application and moderate, user-triggered use. See https://operations.osmfoundation.org/policies/nominatim/. This implementation serializes requests, enforces a 1.1-second minimum interval, deduplicates in-flight lookups and caches up to 500 exact-coordinate responses for five minutes. Busy requests receive 429; the customer can retry or type the address. Do not run multiple API replicas against the public service with independent limiters: use a single shared geocoding gateway or a provider/self-hosted endpoint with appropriate capacity. Public Nominatim is not an unlimited production service.

The UI attributes OpenStreetMap. Location data is not logged by this implementation. Configure infrastructure access logs to omit/redact latitude and longitude query parameters, and ensure the site's privacy notice describes this location lookup. Only runtime GPS coordinates are sent to the geocoder; customer-entered names and address edits are not sent there.

Run regression checks from the workspace root:

```
node --test frontend/src/utils/location.test.js backend/utils/reverseGeocode.test.js backend/utils/temporaryDriverFare.test.js
```

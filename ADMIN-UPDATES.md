# Admin updates

- Services → Edit: use Add tour plan, enter days/title/price/description and one
  place per line. Remove plan removes it from the edit form; Save changes persists
  the service. Days must be positive whole numbers and unique within the service.
- Bookings / Requests: expand Complete details to see saved customer, schedule,
  vehicle, fare and pickup fields, including nested GPS/address data. Delete
  requires confirmation and removes only the selected record, not related bookings.
- Admin account: enter the new username, current password, new password and
  confirmation. The hashed credentials are stored in MongoDB and take precedence
  over the environment bootstrap login. Changing .env afterwards does not replace
  these database credentials. Other primary-admin sessions must sign in again.
- Deleted customer accounts can no longer use existing customer tokens. Existing
  booking records remain for administrative reference.

Deploy the updated backend (including models/AdminCredentials.js), restart it,
then deploy the admin/dist contents. These controls call the live API; an old
backend will not have the new endpoints. No live records or credentials were
modified during development. Tests use isolated model stubs.

Checks: `node --test utils/admin-features.test.js utils/issueOtp.test.js` from
backend, and `npm run build` from admin.

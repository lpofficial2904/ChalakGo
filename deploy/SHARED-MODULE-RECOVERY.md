# Shared-module production recovery

## Root cause and evidence

Backend, admin and frontend have independent Git roots. The workspace-level
`shared/` directory is outside all three repositories and has no Git repository.
Backend relative imports previously escaped its checkout; admin pricing imports
did likewise. Pulling the backend cannot deploy files into its parent directory.
Available backend history contains no committed application shared modules.
The new repository-local paths are not ignored. This is a repository-boundary
packaging error; no evidence of a deleted tracked backend implementation was found.

Frontend commit `51c6825` already contains the three actual implementations.
Admin commit `dec01ce` introduced its local service-content implementation.
Byte comparisons confirmed all existing workspace/frontend versions match, and
admin service content matches them. Recovery copies these implementations without
changing their logic. Frontend source requires no changes.

## Contracts preserved

- `driverPricing.js`: DEFAULT_DRIVER_PRICING, driverPricing,
  validateDriverPricing, calculateDriverOnlyFare. Preserves five plans,
  configurable admin rates, Mongoose object normalization, version-2 legacy
  upgrades, validation, strict date parsing, fractional overtime, night overlap
  and one-time night charge, rounded-up outstation days and fare result fields.
- `pageCopyKey.js`: exact existing String coercion, for-of character iteration,
  Math.imul hashing, unsigned hexadecimal `copy_` keys. Existing CMS keys survive.
- `serviceContent.js`: serviceContentDefaults and contentOf; permanent-driver
  and Jaipur tour defaults merged with pageContent, including intentional empty
  overrides. No replacement copy or arbitrary defaults introduced.

## Repository-local structure

```
backend/shared/
  driverPricing.js
  pageCopyKey.js
  serviceContent.js
  README.md
frontend/src/shared/           (existing, unchanged)
  driverPricing.js
  pageCopyKey.js
  serviceContent.js
  README.md
admin/shared/
  driverPricing.js             (new)
  serviceContent.js            (existing, unchanged)
  pageCopy.json                (existing, unchanged)
```

Admin has no pageCopyKey.js caller; it uses its existing pageCopy.json defaults.
The old workspace shared directory remains untouched but is not a deployment
dependency. All three applications declare type=module in their package.json.

## Modified import callers

Backend: routes/site.js, schemas/driverPricingSchema.js,
utils/temporaryDriverFare.js, utils/driverPricing.test.js,
utils/driverPricingApi.test.js, utils/pageCopy.test.js,
utils/serviceContent.test.js. Only import paths changed in these files.

Admin: AdminPanel.jsx, DriverPricingEditor.jsx, PageServicesEditor.jsx.
Only import paths changed. Existing ServiceContentEditor.jsx is already local.

Frontend callers audited: CabPricing.jsx, DriverPlans.jsx, Home.jsx,
PageCopy.jsx, Services.jsx, driverPricingUI.test.js, utils/fare.js.
All already import repository-local modules.

## Validation

- Backend: node --test utils/*.test.js: 45 passed, 0 failed.
- Frontend: node --test src/utils/*.test.js src/components/*.test.js:
  24 passed, 0 failed.
- Frontend and admin: npm run build passed.
- Both frontend/admin also built in isolated temporary snapshots without a
  sibling shared directory (installed dependencies reused).
- Backend server.js started in an isolated snapshot, without .env or a parent
  shared directory. GET /api/health returned HTTP 200, ok=true. No
  ERR_MODULE_NOT_FOUND. An unreachable loopback MongoDB URI intentionally kept
  production data out of the startup smoke test; DB connectivity is not verified.
- New utils/sharedModules.test.js checks repo boundaries and stable CMS hashes.
- SHA-256/byte comparisons confirm unchanged module implementations.

## Production path and deployment

The backend files must be included in the backend commit (including new shared
files), not just the import edits. After deployment the pricing implementation is:

`/www/wwwroot/chalakgo-backend/ChalakGo/shared/driverPricing.js`

From routes/, schemas/ and utils/, `../shared/driverPricing.js` resolves there.
No `/www/wwwroot/chalakgo-backend/shared` directory is required.

After reviewing/committing/deploying the changes, restart the actual PM2 process
and verify health and logs. The supplied log named it `localpintu-backend`, not
`ChalakGo`; verify the current process list before restarting. This recovery has
not committed, pushed, restarted or changed the live server. No .env, database
data, uploads, schema fields or pricing validation were changed.

# Deployment-local shared modules

These files are byte-for-byte copies of the existing, committed frontend
`src/shared` implementations (frontend commit `51c6825`). They also match the
previous workspace-level shared files. `serviceContent.js` matches the admin
copy introduced in commit `dec01ce`.

Backend, frontend and admin are separate Git repositories. Each must ship its
own required modules; never import from a sibling directory outside its repo.
No installation, build step or production sibling checkout is needed here.

When updating a shared contract, synchronize the backend `shared`, frontend
`src/shared`, and the corresponding admin `shared` files in coordinated changes.
Keep pricing calculations/validation identical. Preserve page-copy hashes:
existing stored CMS overrides depend on them. Run backend tests and both builds.

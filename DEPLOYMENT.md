# Production deployment

## Responsive image deployment

After installing dependencies on the VPS, run `npm run images:optimize` once to
prepare existing uploads, then restart the backend. New image uploads prepare
their WebP sizes before the upload response; originals remain unchanged.
The generated `uploads/.variants` files are local disk cache, not source files.

Apply the `/uploads/` location in `deploy/api-nginx.conf` to the API server block
if aaPanel has static image rules, then validate with `nginx -t` before reloading.
Check an existing upload with `?w=640`: it must return `Content-Type: image/webp`,
not the original PNG. Deploy the frontend build too for the smaller avatar sizes.

## VPS / aaPanel (chalakgo.com)

The live `/api/health` check returned JSON with database connected but no
`Access-Control-Allow-Origin` for `https://chalakgo.com`. The checked-in
`server.js` already allows this origin. Deploy this backend version and restart
the actual Node process serving port 5500; also check proxy header filtering.

1. Upload the updated backend source, including `config/env.js`. Keep the VPS
   database credentials and existing uploads. In aaPanel's Node project, set
   the project directory to the backend folder, entry file to `server.js`,
   and port to `5500`. Run `npm ci` in that folder if dependencies are missing.
2. Set these values in the VPS `backend/.env` (retain other existing values):

   ```dotenv
   PORT=5500
   CORS_ORIGINS=https://chalakgo.com,https://www.chalakgo.com,https://admin.chalakgo.com
   PUBLIC_API_URL=https://api.chalakgo.com
   ```

3. Restart the backend Node project in aaPanel. If PM2 manages it instead,
   use `pm2 restart <actual-app-name> --update-env`.
4. Test on the VPS:

   ```sh
   curl -i -H 'Origin: https://chalakgo.com' http://127.0.0.1:5500/api/health
   curl -i -H 'Origin: https://chalakgo.com' https://api.chalakgo.com/api/health
   curl -i -X OPTIONS -H 'Origin: https://chalakgo.com' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,authorization' https://api.chalakgo.com/api/auth/login
   ```

   Both health responses must have `Access-Control-Allow-Origin:
   https://chalakgo.com` and `Access-Control-Allow-Credentials: true`.
   OPTIONS must return 204 with the same origin header. If the loopback test
   fails, the wrong/old backend is running. If only HTTPS fails, check nginx's
   upstream port, `proxy_hide_header`, and caching.
5. If the API proxy needs correction, use `deploy/api-nginx.conf` inside the
   existing `api.chalakgo.com` HTTPS server block. Preserve SSL settings, replace
   the existing `location /`, and remove conflicting SPA/static locations.
   Do not add duplicate CORS headers in nginx; Express handles CORS and OPTIONS.
   Run `nginx -t` before reloading nginx through aaPanel.
6. Frontend/admin production build setting: `VITE_API_BASE_URL=https://api.chalakgo.com`.
   Rebuild only if that setting changed. Hard refresh the website after deployment.

The proxy disables buffering for `/api/events`. Uploads and `.env` resolve from
the backend directory even if the process manager starts from another directory.

## Previous Netlify / Render deployment

The frontend is hosted on Netlify and the API is hosted on Render. The API
accepts HTTPS `*.netlify.app` deployment and preview origins automatically.

For the ChalakGo customer domain, CORS is handled in the backend. For any
additional custom frontend domain, set this Render environment variable before
redeploying:

```text
CORS_ORIGINS=https://www.your-domain.com,https://your-domain.com
```

The frontend's Netlify build environment should contain:

```text
VITE_API_BASE_URL=https://api.chalakgo.com
```

Do not set this value to `localhost` or `http://api.chalakgo.com` in Netlify.
The customer website is HTTPS, so its API must also use HTTPS. Set Render's
`PUBLIC_API_URL=https://api.chalakgo.com`, redeploy Render after backend
changes, then redeploy Netlify so the browser receives the latest frontend.

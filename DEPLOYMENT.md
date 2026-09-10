# Production deployment

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

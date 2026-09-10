# Production deployment

The frontend is hosted on Netlify and the API is hosted on Render. The API
accepts HTTPS `*.netlify.app` deployment and preview origins automatically.

For a custom domain, set this Render environment variable before redeploying:

```text
CORS_ORIGINS=https://www.your-domain.com,https://your-domain.com
```

The frontend's Netlify build environment should contain:

```text
VITE_API_BASE_URL=https://chalakgo.onrender.com
```

Do not set this value to `localhost` in Netlify. Redeploy Render after backend
changes, then redeploy Netlify so the browser receives the latest frontend.

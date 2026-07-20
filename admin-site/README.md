# OSLNZ Admin (standalone)

Static site that logs into the OSLNZ admin dashboard via `POST /api/public/admin/login`.

## Deploy

Any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages). No build step — just `index.html`.

Vercel: drag-and-drop the `admin-site/` folder at vercel.com/new, or run `npx vercel --prod` inside it.

## Configuration

Defaults to `https://oslnz.lovable.app`. To target a different deployment, expand "API endpoint" on the login screen and paste the base URL (saved in localStorage). To change the hardcoded default, edit `DEFAULT_API` in `index.html`.

## Flow

1. Admin enters the short code (`ADMIN_LOGIN_CODE` env on the server).
2. Browser POSTs `{ code }` to `/api/public/admin/login`.
3. Server validates and returns `{ dashboardUrl }` (the signed secret URL).
4. Browser navigates to that dashboard URL on the main app domain.

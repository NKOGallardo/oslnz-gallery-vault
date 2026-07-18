## OSLNZ Premium Photography Client Gallery

A public PIN-gated client gallery site plus a hidden per-photographer management dashboard accessed only through a secret UUID URL. Built on TanStack Start + Lovable Cloud (Postgres + Storage + server functions). No client accounts, no admin login page.

### Brand & Design
- Palette: Black `#000000`, White `#FFFFFF`, Pine Green `#234F3D`, Warm Brown `#7A5230`. Dark theme by default.
- Fonts: Poppins (display), Manrope (headings), Inter (body) — loaded via `<link>` in `__root.tsx`.
- Premium feel: generous spacing, rounded corners, subtle shadows, smooth hover/fade transitions, minimal chrome.
- Logo: awaiting upload; placeholder wordmark until then.

### Public Routes
- `/` — PIN entry landing. Logo, headline "Welcome to OSLNZ Client Gallery", description, centered PIN input, "View Gallery" button. On submit calls a public server fn; on success redirects to `/g/:token` (short-lived signed token), on failure shows "Invalid PIN. Please check your code and try again." Rate-limited by IP.
- `/g/:token` — Client gallery view. Shows Gallery Title, Event Name, optional Event Date, image count. Responsive grid, lazy-loaded watermarked previews. Lightbox with prev/next, zoom, swipe on mobile, image counter, per-image download (original), "Download all" (server-zipped). Downloads counted.
- Any invalid/expired token → back to PIN page with error.

### Hidden Management
- `/manage` and `/manage/<invalid>` → 404 Not Found.
- `/manage/:secret` — Dashboard, only if `secret` matches an active `photographers.secret_url` row. Never linked from anywhere.
- Bootstrap: visiting `/manage/OSLNZ-89d28d02` creates a photographer row, issues a fresh UUID secret, and redirects to `/manage/<new-uuid>`. Bootstrap code stored as env secret `PHOTOGRAPHER_BOOTSTRAP_CODE` (reusable to onboard more photographers).
- Dashboard: Total Galleries, Total Photos, Total Downloads. Actions: Create Gallery, Manage Galleries, Settings.
- Settings → "Generate New Secret URL" rotates the URL, invalidates the old one, displays the new URL, redirects to it.

### Create / Manage Galleries
- Create form: Client Name, Gallery Name, Event Name, Gallery PIN (auto-suggest + manual), optional Expiry Date, drag-and-drop multi-image upload with per-file progress.
- Gallery card: name, client, PIN, image count, created date. Buttons: View, Edit, Delete, Duplicate, Download All, Copy PIN, Copy Link, QR.
- Image management: upload more, delete, replace, reorder (drag), preview.
- Search galleries by client name or PIN.

### Data Model (Postgres)
```
photographers(id uuid pk, name text, secret_url text unique, created_at)
galleries(id uuid pk, photographer_id fk, title, client_name, event_name,
          event_date date null, pin text unique, expires_at timestamptz null,
          download_count int default 0, created_at)
gallery_images(id uuid pk, gallery_id fk, storage_path, original_filename,
               sort_order int, size_bytes, created_at)
pin_attempts(ip inet, attempted_at, success bool)   -- rate limiting
```
- RLS enabled, no `TO anon` policies. All access via server functions.
- Storage: private bucket `gallery-images`. Previews via short-lived signed URLs with CSS watermark overlay; originals via signed URLs minted only for a valid gallery token.

### Server Functions (`src/lib/*.functions.ts`)
- `verifyPin({ pin })` — rate-limits, returns HMAC signed access token (`GALLERY_TOKEN_SECRET`, ~2h) or `{ ok: false }`.
- `getGalleryByToken({ token })` — verifies token, returns meta + image list with signed preview URLs.
- `getImageDownloadUrl({ token, imageId })` — signed original URL, increments counter.
- `/api/public/gallery/:token/zip` — server route streams zip of originals (token-verified).
- Photographer-scoped fns take `{ secret, ... }`, resolve photographer_id from `secret_url`: create/update/delete gallery + images, reorder, duplicate, rotate secret, dashboard stats, bootstrap.

### Security
- Secret URLs are opaque UUIDs, validated server-side, rotation invalidates prior.
- Bootstrap code in env, not code.
- PIN attempts rate-limited (5/min/IP, backoff on repeats).
- Upload validation: mime allowlist (jpeg/png/webp), size + count caps.
- Originals only via signed URLs bound to a valid token.

### Deployment / Extras
- Hosted on Lovable (TanStack Start + Cloud). Images in Lovable Cloud Storage (replaces Cloudinary — integrated).
- Extras: QR per gallery, Copy PIN, Copy Link, expiry, watermarked previews, original-quality downloads, download stats, search, responsive, dark theme.

### Secrets
- `PHOTOGRAPHER_BOOTSTRAP_CODE` = `OSLNZ-89d28d02`.
- `GALLERY_TOKEN_SECRET` (auto-generated).

### Structure (adapted to TanStack Start)
```
src/
  routes/            index, g.$token, manage.$secret (+ children), api/public/gallery.$token.zip
  components/        Logo, PinInput, GalleryGrid, Lightbox, UploadDropzone, GalleryCard, QRCode…
  lib/               gallery.functions.ts, photographer.functions.ts, pin.server.ts, token.server.ts
```

### Build order
1. Enable Lovable Cloud, set secrets, create schema + RLS + storage bucket.
2. Brand tokens, fonts, logo placeholder.
3. Public PIN page + verify fn + gallery view with lightbox and downloads.
4. `/manage/:secret` route with 404 guard, bootstrap flow, dashboard stats.
5. Create gallery + upload pipeline + image management.
6. Gallery list: search, QR, copy PIN/link, duplicate, download all, expiry.
7. Rotate secret URL, download stats, polish + responsive pass.

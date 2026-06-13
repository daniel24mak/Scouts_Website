# Scouts Group Web App

Supabase-first scouting management platform with public pages, role-based chief/admin areas, a built-in CMS/admin dashboard, attendance tracking, yearly scout lists, and Excel-based scout registration imports.

## Pages

- `/` home page
- `/about` about us page
- `/calendar` public planned/past event calendar with chief-only scheduled meetings
- `/blogs` public blogs page
- `/blogs/:slug` public blog detail page
- `/gallery` public gallery page
- `/gallery/:albumId` public event album detail page
- `/login` Supabase Auth login for internal admins and chiefs
- `/chiefs` protected chiefs portal with scout names and attendance
- `/chiefs/attendance` protected scout attendance page for chiefs
- `/chiefs/content` protected publishing dashboard for chiefs with publishing permission
- `/admin` hidden protected admin dashboard
- `/admin/chief-attendance` admin-only chief attendance page

## Authentication

Internal users sign in with Supabase Auth. Public visitors do not need accounts.

- Admins are redirected to `/admin`.
- Chiefs are redirected to `/chiefs`.
- Protected routes still enforce admin/chief roles and publishing permissions.
- Passwords are handled by Supabase Auth and are never stored in app tables.
- If Supabase is not configured, the app can still use local demo accounts for development.

## Run Locally

```bash
npm install
npm run dev:full
```

This starts both the SQLite API server and the Vite frontend. The app is available through Vite at the URL printed in the terminal, usually `http://127.0.0.1:5173/`.

To run a production-style local server:

```bash
npm run start
```

## Supabase

The frontend reads these Vite environment variables:

```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
VITE_SUPABASE_STORAGE_BUCKET=scouts-files
```

Run `database/supabase-schema.sql` in the Supabase SQL editor after enabling Auth and creating the storage bucket, then run `database/supabase-seed.sql` for starter roles, permissions, groups, grouping rules, and the active scout year. Supabase is prepared to store:

- internal user profiles, roles, permissions, chiefs, and groups
- scout years, registered scouts, registration uploads, grouping rules, and archives
- scout attendance and chief attendance
- posts/blogs, gallery albums/images, calendar events, documents, approval requests, reports, and audit logs

The service layer lives in `src/services/` and keeps Supabase queries out of React components.

## Local Fallback

The app still supports SQLite in `database/scouts.db` while data is being migrated to Supabase.

- `database/schema.sql` defines the tables.
- `database/seed.sql` seeds starter data.
- `server.mjs` exposes the local API and writes to SQLite.
- `src/api/client.js` tries Supabase first and falls back to the local API when Supabase tables are not ready.
- `src/data/generated/` contains fallback snapshots for when the API is not running.
- `src/data/sheets/registered-scouts.xls` is the Excel source for registered scouts.

```bash
npm run db:reset
npm run db:tables
```

## Next Build Steps

- Run the Supabase schema in your Supabase project.
- If you already ran the schema before registration uploads were connected, run `database/supabase-upload-fix.sql`.
- Create the first admin user in Supabase Auth and insert the matching `user_profiles` row with role `admin`.
- If an Auth user was created but is missing from `user_profiles`, use `database/supabase-profile-repair.sql`.
- Seed groups, roles, permissions, and grouping rules in Supabase.
- Move uploaded registration sheets, gallery images, thumbnails, and documents into Supabase Storage.

## Run locally

Install dependencies and start the Vite frontend:

```bash
npm install
npm run dev
```

To run the local SQLite API together with Vite during development:

```bash
npm run dev:full
```

## Test production build

```bash
npm run build
npm run preview
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the real values:

```bash
cp .env.example .env.local
```

Required variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Optional variable:

```env
VITE_SUPABASE_STORAGE_BUCKET=scouts-files
```

Do not commit `.env` or `.env.local`. Add environment variables in the hosting platform settings instead of committing real values to GitHub.

## Deployment

For Vercel, Netlify, Cloudflare Pages, or similar static hosting:

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

The host should run `npm install` automatically from `package.json` and `package-lock.json`.

## Safe GitHub push checklist

This project includes `.gitignore` and `.gitattributes` rules to keep private/generated files out of Git and protect binary assets from line-ending normalization.

Before pushing:

```bash
git status
git add .gitattributes .gitignore .env.example README.md package.json package-lock.json
git add --renormalize .
git status
git diff --cached
```

Then commit and push:

```bash
git add .
git commit -m "Prepare project for safe GitHub deployment"
git push
```

If this is the first push:

```bash
git init
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git add .
git commit -m "Prepare project for safe GitHub deployment"
git push -u origin main
```

# Scouts Data Layer

This folder contains the local SQLite backend used for development, plus the production Supabase migration file.

## Local Development

- `schema.sql`: SQLite table structure
- `seed.sql`: starter data
- `scouts.db`: generated SQLite database file

To rebuild the local database:

```bash
sqlite3 database/scouts.db ".read database/schema.sql" ".read database/seed.sql"
```

The Vite app still works against the local API while Supabase is being connected feature by feature.

## Production Target

- `supabase-schema.sql`: Supabase/Postgres schema for Auth profiles, roles, permissions, yearly scout archives, attendance, posts, gallery, documents, approvals, storage references, and audit logs.

Configure these environment values in `.env.local`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_STORAGE_BUCKET=scouts-files
```

Registered scout imports remain a core workflow. In production, uploaded import files should be stored in Supabase Storage and rows should be linked to `scout_years`, preserving historical years permanently.

Website content is managed by the built-in admin dashboard. Approved posts, albums, photos, calendar events, announcements, and documents are shown publicly; pending, rejected, and archived content remains available to admins for review.

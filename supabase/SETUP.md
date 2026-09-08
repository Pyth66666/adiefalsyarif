# Supabase setup — ADIEF CMS

1. Create a project at [supabase.com](https://supabase.com).

2. **SQL Editor** → New query → run everything in `supabase/schema.sql`
   (tables, updated_at triggers, RLS, storage bucket + policies).

3. **Auth** — create the private admin account:
   - Authentication → Users → Add user → Create a new user
   - Email + password you'll type at `/admin/login`
   - Tick **Auto Confirm User**

4. **Storage** — verify the `cms-media` bucket exists and is **Public**
   (the schema SQL creates it public; double-check in Storage → Buckets).

5. **Environment variables** — copy `.env.example` to `.env.local` and fill:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_STORAGE_BUCKET=cms-media
   ```
   From: Settings → API. Supabase v2 keys look like `sb_publishable_...` (anon)
   and `sb_secret_...` (service role).
   - `SUPABASE_SERVICE_ROLE_KEY` is **server-only**. Never add a `NEXT_PUBLIC_` prefix.

6. Restart: `npm run dev`.

7. **http://localhost:3000/admin/login** → sign in → dashboard.

## Security model

- Auth: Supabase Auth, persistent session via `@supabase/ssr` + middleware.
- `/admin/*` protected by middleware; every CMS server action verifies the session
  server-side (`requireUser`).
- RLS: public read; writes only for authenticated sessions (admin secret server-side).
- Service-role key lives server-only; browser only has the anon/publishable key.
- Media deletion blocked while image referenced by projects/photos/events/collection.
- GPS from uploaded photos detected but never published; `SHOW LOCATION` uses a readable location.

## Public data flow

```
ADMIN → Supabase (Postgres + Storage) → Public Website
```

Public site fetches published content via `getPublicContent()` — one source of truth.
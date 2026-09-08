-- ADIEF Portfolio CMS schema — Supabase (PostgreSQL)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run.

-- ── PROFILES ───────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  title text,
  short_bio text,
  long_bio text,
  location text,
  email_public text,
  profile_image text,
  resume_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  name text default 'ADIEF',
  family text default 'AL SYARIF',
  domain text default 'adiefalsyarif.com',
  descriptors text default 'COMPUTER SCIENCE / CYBERSECURITY / PHOTOGRAPHY',
  intro text,
  about text,
  contact_email text,
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tagline text,
  description text,
  problem text,
  solution text,
  year text,
  category text,
  status text not null default 'completed',
  technologies text[] not null default '{}',
  role text,
  hero_image text,
  gallery text[] not null default '{}',
  github text,
  demo text,
  featured boolean not null default false,
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  location text,
  date timestamptz,
  status text not null default 'upcoming',
  result text,
  description text,
  project text,
  images text[] not null default '{}',
  external_link text,
  featured boolean not null default false,
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  src text not null,
  title text,
  description text,
  location text,
  date text,
  category text not null default 'STREET',
  camera text,
  lens text,
  aperture text,
  shutter_speed text,
  iso text,
  featured boolean not null default false,
  published boolean not null default false,
  show_location boolean not null default false,
  width integer,
  height integer,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event text,
  organization text,
  year text,
  front_image text,
  back_image text,
  story text,
  what_happened text,
  what_i_built text,
  people_i_met text,
  photos text[] not null default '{}',
  related_project uuid references public.projects(id) on delete set null,
  external_link text,
  featured boolean not null default false,
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hackdev (
  id uuid primary key default gen_random_uuid(),
  name text default 'HACKDEV',
  description text,
  members integer default 0,
  universities integer default 0,
  events integer default 0,
  workshops integer default 0,
  discord_url text,
  website_url text,
  image text,
  story text,
  updated_at timestamptz not null default now()
);

create table if not exists public.statistics (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value numeric not null default 0,
  prefix text,
  suffix text,
  description text,
  visual_type text not null default 'number',
  display_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  label text,
  url text not null,
  icon text,
  group_name text not null default 'tech',
  visible boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  url text,
  filename text,
  mime text,
  size integer,
  bucket text not null default 'cms-media',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── UPDATED_AT TRIGGER ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles on public.profiles;            create trigger trg_profiles before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_site_settings on public.site_settings;  create trigger trg_site_settings before update on public.site_settings for each row execute function public.set_updated_at();
drop trigger if exists trg_projects on public.projects;            create trigger trg_projects before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists trg_events on public.events;                create trigger trg_events before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists trg_photos on public.photos;                create trigger trg_photos before update on public.photos for each row execute function public.set_updated_at();
drop trigger if exists trg_collection on public.collection_items;  create trigger trg_collection before update on public.collection_items for each row execute function public.set_updated_at();
drop trigger if exists trg_hackdev on public.hackdev;              create trigger trg_hackdev before update on public.hackdev for each row execute function public.set_updated_at();
drop trigger if exists trg_statistics on public.statistics;        create trigger trg_statistics before update on public.statistics for each row execute function public.set_updated_at();
drop trigger if exists trg_social on public.social_links;          create trigger trg_social before update on public.social_links for each row execute function public.set_updated_at();

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.projects enable row level security;
alter table public.events enable row level security;
alter table public.photos enable row level security;
alter table public.collection_items enable row level security;
alter table public.hackdev enable row level security;
alter table public.statistics enable row level security;
alter table public.social_links enable row level security;
alter table public.media enable row level security;

create policy public_read on public.profiles for select using (true);
create policy auth_write on public.profiles for all to authenticated with check (true);

create policy public_read on public.site_settings for select using (true);
create policy auth_write on public.site_settings for all to authenticated with check (true);

create policy public_read on public.projects for select using (true);
create policy auth_write on public.projects for all to authenticated with check (true);

create policy public_read on public.events for select using (true);
create policy auth_write on public.events for all to authenticated with check (true);

create policy public_read on public.photos for select using (true);
create policy auth_write on public.photos for all to authenticated with check (true);

create policy public_read on public.collection_items for select using (true);
create policy auth_write on public.collection_items for all to authenticated with check (true);

create policy public_read on public.hackdev for select using (true);
create policy auth_write on public.hackdev for all to authenticated with check (true);

create policy public_read on public.statistics for select using (true);
create policy auth_write on public.statistics for all to authenticated with check (true);

create policy public_read on public.social_links for select using (true);
create policy auth_write on public.social_links for all to authenticated with check (true);

create policy public_read on public.media for select using (true);
create policy auth_write on public.media for all to authenticated with check (true);

-- ── STORAGE (create bucket manually as PUBLIC, or via SQL) ─
insert into storage.buckets (id, name, public) values ('cms-media', 'cms-media', true)
on conflict (id) do nothing;
create policy "media_public_read" on storage.objects for select using (bucket_id = 'cms-media');
create policy "media_auth_write" on storage.objects for insert to authenticated with check (bucket_id = 'cms-media');
create policy "media_auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'cms-media');
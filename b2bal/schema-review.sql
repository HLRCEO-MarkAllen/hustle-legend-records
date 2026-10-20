-- HLR Legend Access schema proposal. REVIEW ONLY; DO NOT APPLY until auth architecture is approved.
-- Private tables: deny all client-side access by default. Edge functions use service role with explicit checks.
create extension if not exists pgcrypto;
create table if not exists public.legend_artists (
 id uuid primary key default gen_random_uuid(),
 display_name text not null,
 slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
 created_at timestamptz not null default now()
);
create table if not exists public.legend_albums (
 id uuid primary key default gen_random_uuid(),
 artist_id uuid not null references public.legend_artists(id) on delete restrict,
 title text not null,
 slug text not null check (slug ~ '^[a-z0-9-]+$'),
 status text not null default 'draft' check (status in ('draft','ready','published','archived')),
 created_at timestamptz not null default now(),
 unique(artist_id,slug)
);
create table if not exists public.legend_artist_managers (
 artist_id uuid not null references public.legend_artists(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'manager' check (role in ('manager','viewer')),
 granted_at timestamptz not null default now(),
 primary key(artist_id,user_id)
);
create table if not exists public.legend_media (
 id uuid primary key default gen_random_uuid(),
 album_id uuid not null references public.legend_albums(id) on delete cascade,
 kind text not null check (kind in ('audio','video','image','document')),
 title text not null,
 storage_path text not null unique,
 track_number integer check (track_number between 1 and 999),
 created_at timestamptz not null default now()
);
create table if not exists public.legend_keys (
 id uuid primary key default gen_random_uuid(),
 album_id uuid not null references public.legend_albums(id) on delete restrict,
 key_digest text not null unique,
 key_label text,
 status text not null default 'inactive' check (status in ('inactive','active','revoked')),
 issued_at timestamptz not null default now(),
 revoked_at timestamptz,
 check ((status = 'revoked' and revoked_at is not null) or (status <> 'revoked' and revoked_at is null))
);
create index if not exists legend_keys_album_idx on public.legend_keys(album_id);
create table if not exists public.legend_sessions (
 id uuid primary key default gen_random_uuid(),
 key_id uuid not null references public.legend_keys(id) on delete cascade,
 session_digest text not null unique,
 started_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check (expires_at <= started_at + interval '4 hours'),
 check (expires_at > started_at)
);
create index if not exists legend_sessions_key_idx on public.legend_sessions(key_id);
create index if not exists legend_sessions_expiry_idx on public.legend_sessions(expires_at);
create table if not exists public.legend_audit (
 id bigint generated always as identity primary key,
 actor_id uuid,
 action text not null,
 object_type text not null,
 object_id uuid,
 created_at timestamptz not null default now()
);
-- All access is denied to anon/authenticated by default, even for signed-in artist managers.
-- Server routes must implement per-artist authorization and use only private service credentials.
alter table public.legend_artists enable row level security;
alter table public.legend_albums enable row level security;
alter table public.legend_artist_managers enable row level security;
alter table public.legend_media enable row level security;
alter table public.legend_keys enable row level security;
alter table public.legend_sessions enable row level security;
alter table public.legend_audit enable row level security;
revoke all on public.legend_artists, public.legend_albums, public.legend_artist_managers, public.legend_media, public.legend_keys, public.legend_sessions, public.legend_audit from anon, authenticated;
-- Before applying: confirm auth owner mapping, service-role Edge Function checks,
-- private storage bucket, key-hashing design, retention policy and rollback plan.

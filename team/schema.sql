create table public.hlr_channels (
 slug text primary key check (slug ~ '^[a-z0-9-]+$'),
 owner_user_id uuid references auth.users(id),
 draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft)='object'),
 updated_at timestamptz not null default now()
);
create table public.hlr_channel_public (
 slug text primary key references public.hlr_channels(slug),
 content jsonb not null check (jsonb_typeof(content)='object'),
 updated_at timestamptz not null default now()
);
create table public.hlr_team_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null default auth.uid() references auth.users(id),
 channel text not null default 'general' check (channel in ('general','podcast','production','radio','business')),
 body text not null check (length(body) between 1 and 6000),
 created_at timestamptz not null default now()
);
create table public.hlr_availability (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null check (ends_at>starts_at),
 availability text not null check (availability in ('available','unavailable')),
 note text check (length(note)<=500),
 created_at timestamptz not null default now()
);
create table public.hlr_channel_decisions (
 id uuid primary key default gen_random_uuid(),
 channel_slug text not null references public.hlr_channels(slug),
 author_id uuid not null default auth.uid() references auth.users(id),
 title text not null check (length(title) between 1 and 200),
 rationale text not null check (length(rationale) between 1 and 6000),
 status text not null default 'proposed' check (status in ('proposed','approved','declined','needs_changes')),
 created_at timestamptz not null default now()
);
create table public.hlr_channel_audit (
 id uuid primary key default gen_random_uuid(),
 channel_slug text not null references public.hlr_channels(slug),
 actor_id uuid not null default auth.uid() references auth.users(id),
 action text not null check (action in ('draft_saved','station_published','owner_changed')),
 occurred_at timestamptz not null default now()
);
create function private.manages_hlr_channel(p_slug text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.is_hlr_staff() and (private.is_hlr_owner() or exists(select 1 from public.hlr_channels c where c.slug=p_slug and c.owner_user_id=auth.uid()));
$$;
revoke all on function private.manages_hlr_channel(text) from public;
grant execute on function private.manages_hlr_channel(text) to authenticated;
create function private.guard_hlr_channel() returns trigger language plpgsql set search_path='' as $$
begin
 if new.owner_user_id is distinct from old.owner_user_id then
  if not private.is_hlr_owner() then raise exception 'Only HLR owner can delegate channel ownership'; end if;
  if new.owner_user_id is not null and not exists(select 1 from public.staff_profiles where user_id=new.owner_user_id and active) then raise exception 'Choose an approved active staff account';end if;
 end if;
 new.updated_at=now();return new;
end;$$;
create trigger guard_hlr_channel before update on public.hlr_channels for each row execute function private.guard_hlr_channel();
create function private.audit_hlr_channel() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is not null then
 insert into public.hlr_channel_audit(channel_slug,actor_id,action) values(new.slug,auth.uid(),case when tg_table_name='hlr_channel_public' then 'station_published' when new.owner_user_id is distinct from old.owner_user_id then 'owner_changed' else 'draft_saved' end);
 end if;
 return new;
end;$$;
-- Separate publication audit function avoids referring to nonexistent owner fields.
create function private.audit_hlr_public() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is not null then insert into public.hlr_channel_audit(channel_slug,actor_id,action) values(new.slug,auth.uid(),'station_published');end if;return new;
end;$$;
create trigger audit_hlr_channel after update on public.hlr_channels for each row execute function private.audit_hlr_channel();
create trigger audit_hlr_public after insert or update on public.hlr_channel_public for each row execute function private.audit_hlr_public();
revoke all on function private.guard_hlr_channel(),private.audit_hlr_channel(),private.audit_hlr_public() from public;
alter table public.hlr_channels enable row level security;
alter table public.hlr_channel_public enable row level security;
alter table public.hlr_team_posts enable row level security;
alter table public.hlr_availability enable row level security;
alter table public.hlr_channel_decisions enable row level security;
alter table public.hlr_channel_audit enable row level security;
revoke all on public.hlr_channels,public.hlr_channel_public,public.hlr_team_posts,public.hlr_availability,public.hlr_channel_decisions,public.hlr_channel_audit from anon,authenticated;
grant select on public.hlr_channels to authenticated;
grant update(owner_user_id,draft,updated_at) on public.hlr_channels to authenticated;
grant select on public.hlr_channel_public to anon,authenticated;
grant insert,update on public.hlr_channel_public to authenticated;
grant select,insert on public.hlr_team_posts to authenticated;
grant select,insert,update,delete on public.hlr_availability to authenticated;
grant select,insert,update on public.hlr_channel_decisions to authenticated;
grant select,insert on public.hlr_channel_audit to authenticated;
create policy channel_read on public.hlr_channels for select to authenticated using(private.manages_hlr_channel(slug));
create policy channel_update on public.hlr_channels for update to authenticated using(private.manages_hlr_channel(slug)) with check(private.manages_hlr_channel(slug));
create policy published_read on public.hlr_channel_public for select to anon,authenticated using(true);
create policy published_insert on public.hlr_channel_public for insert to authenticated with check(private.manages_hlr_channel(slug));
create policy published_update on public.hlr_channel_public for update to authenticated using(private.manages_hlr_channel(slug)) with check(private.manages_hlr_channel(slug));
create policy posts_read on public.hlr_team_posts for select to authenticated using(private.is_hlr_staff());
create policy posts_insert on public.hlr_team_posts for insert to authenticated with check(private.is_hlr_staff() and author_id=auth.uid());
create policy availability_read on public.hlr_availability for select to authenticated using(private.is_hlr_staff());
create policy availability_insert on public.hlr_availability for insert to authenticated with check(private.is_hlr_staff() and user_id=auth.uid());
create policy availability_update on public.hlr_availability for update to authenticated using(private.is_hlr_staff() and user_id=auth.uid()) with check(private.is_hlr_staff() and user_id=auth.uid());
create policy availability_delete on public.hlr_availability for delete to authenticated using(private.is_hlr_staff() and user_id=auth.uid());
create policy decisions_read on public.hlr_channel_decisions for select to authenticated using(private.is_hlr_staff());
create policy decisions_insert on public.hlr_channel_decisions for insert to authenticated with check(private.is_hlr_staff() and author_id=auth.uid());
create policy decisions_update on public.hlr_channel_decisions for update to authenticated using(private.manages_hlr_channel(channel_slug)) with check(private.manages_hlr_channel(channel_slug));
create policy audit_read on public.hlr_channel_audit for select to authenticated using(private.is_hlr_staff());
create policy audit_insert on public.hlr_channel_audit for insert to authenticated with check(private.manages_hlr_channel(channel_slug) and actor_id=auth.uid());
create index hlr_posts_created on public.hlr_team_posts(created_at desc);
create index hlr_availability_time on public.hlr_availability(starts_at);
create index hlr_decisions_channel on public.hlr_channel_decisions(channel_slug,created_at desc);
create index hlr_audit_channel on public.hlr_channel_audit(channel_slug,occurred_at desc);
insert into public.hlr_channels(slug,draft) values('podcast','{"version":1,"show":"","host":"","tagline":"","about":"","art":"","youtube":"","contact":"","fulfillment":"","refunds":"","episodes":[],"products":[],"checks":[]}'::jsonb);

-- Channel decisions: team proposals; owner-only status updates.
drop policy decisions_insert on public.hlr_channel_decisions; create policy decisions_insert on public.hlr_channel_decisions for insert to authenticated with check(private.is_hlr_staff() and author_id=auth.uid() and (status='proposed' or private.manages_hlr_channel(channel_slug))); revoke update on public.hlr_channel_decisions from authenticated; grant update(status) on public.hlr_channel_decisions to authenticated;

-- Hustle Legend Records CEO task/access authorization safeguards
-- Scope: no data edits; new invoker RPCs and one task status/approval guard.
-- Existing RLS and staff role policies remain unchanged.

create or replace function public.hq_guard_task_approval()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if old.approval_required is true
     and not coalesce(public.is_hlr_owner(),false)
     and (
       new.approval_required is distinct from old.approval_required
       or (new.status in ('completed','cancelled') and new.status is distinct from old.status)
     ) then
    raise exception 'CEO authorization required for this task'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists hq_task_owner_approval_guard on public.hq_tasks;
create trigger hq_task_owner_approval_guard
  before update of status, approval_required on public.hq_tasks
  for each row execute function public.hq_guard_task_approval();

revoke all on function public.hq_guard_task_approval() from public, anon, authenticated;

create or replace function public.approve_hq_task(p_task_id uuid, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  task_title text;
  owner_name text;
begin
  if auth.uid() is null or not coalesce(public.is_hlr_owner(),false) then
    raise exception 'HLR owner authorization required'
      using errcode = '42501';
  end if;

  if length(coalesce(p_note,'')) > 500 then
    raise exception 'Approval note may not exceed 500 characters';
  end if;

  update public.hq_tasks
  set approval_required=false
  where id = p_task_id
    and approval_required is true
    and status not in ('completed','cancelled')
  returning title into task_title;

  if not found then
    raise exception 'Task not pending CEO authorization';
  end if;

  select sp.display_name into owner_name
  from public.staff_profiles sp where sp.user_id = auth.uid();

  insert into public.hq_activity
    (actor_user_id,actor_name,department,action,summary,linked_type,linked_id)
  values
    (auth.uid(),coalesce(owner_name,'HLR CEO'),'executive','ceo_task_approved',
      'Authorized task: '||task_title||
      case when nullif(trim(coalesce(p_note,'')),'') is null then ''
           else ' — '||trim(p_note) end,
      'task',p_task_id::text);
end;
$$;
revoke all on function public.approve_hq_task(uuid,text) from public, anon;
grant execute on function public.approve_hq_task(uuid,text) to authenticated;

create or replace function public.deny_hq_access(p_request_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  owner_name text;
begin
  if auth.uid() is null or not coalesce(public.is_hlr_owner(),false) then
    raise exception 'HLR owner authorization required'
      using errcode = '42501';
  end if;

  update public.hq_access_requests
  set status='denied',reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_request_id and status='pending';

  if not found then
    raise exception 'Pending access request not found';
  end if;

  select sp.display_name into owner_name
  from public.staff_profiles sp where sp.user_id = auth.uid();

  insert into public.hq_activity
    (actor_user_id,actor_name,department,action,summary,linked_type,linked_id)
  values
    (auth.uid(),coalesce(owner_name,'HLR CEO'),'executive','ceo_access_denied',
     'Denied pending HQ access request','access_request',p_request_id::text);
end;
$$;
revoke all on function public.deny_hq_access(uuid) from public, anon;
grant execute on function public.deny_hq_access(uuid) to authenticated;

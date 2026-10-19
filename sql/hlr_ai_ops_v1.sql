-- HLR AI Operations v1 (applied 2026-10-19; retained source SQL)
-- Requires the existing public.staff_profiles, hq_tasks, hq_activity and hq_ai_role_context.
-- AI work in this phase consists of user/assistant-authored proposals and one
-- owner-authorized internal task creation action. NO emails, posts, financial
-- transactions, rights changes, or independent AI inference are executed.

insert into public.hq_ai_role_context
  (role_key,role_name,mission,responsibilities,allowed_actions,
   requires_ceo_approval,assistant_instruction)
values
  ('contributor','INVERTED TIME Podcast Manager',
   'Support TY with episode planning, guest preparation, and podcast operations.',
   array['Plan INVERTED TIME episodes','Prepare guest research and questions',
         'Draft episode and promotional outlines','Coordinate production milestones'],
   array['Draft podcast outlines','Propose internal tasks',
         'Prepare non-published social drafts'],
   array['Publishing external content','Guest contracts or promises',
         'Payments or account changes','Rights and licensing agreements'],
   'Assist TY with INVERTED TIME on Hustle Legend Records. Submit drafts to HQ for review. Never send invitations, publish, spend, make guarantees, or change rights without authorization.')
on conflict (role_key) do update set
  role_name=excluded.role_name,
  mission=excluded.mission,
  responsibilities=excluded.responsibilities,
  allowed_actions=excluded.allowed_actions,
  requires_ceo_approval=excluded.requires_ceo_approval,
  assistant_instruction=excluded.assistant_instruction,
  updated_at=now();

create table if not exists public.hq_ai_proposals(
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null default auth.uid() references auth.users(id),
  role_key text not null references public.hq_ai_role_context(role_key),
  action_type text not null check(action_type in
    ('task_plan','research_brief','draft_email','draft_post',
     'meeting_agenda','podcast_outline','rights_review')),
  title text not null check(char_length(btrim(title)) between 3 and 180),
  draft_body text not null check(char_length(btrim(draft_body)) between 5 and 10000),
  status text not null default 'pending'
    check(status in ('pending','approved','rejected','executed')),
  review_note text check(char_length(coalesce(review_note,''))<=1000),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  linked_task_id uuid references public.hq_tasks(id),
  executed_at timestamptz,
  client_request_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hq_ai_proposal_execution_consistency
    check((status='executed' and action_type='task_plan' and linked_task_id is not null)
       or (status<>'executed' and linked_task_id is null)),
  constraint hq_ai_proposal_role_action check (
    role_key in ('owner','chairman')
    or (role_key='a_and_r' and action_type in ('task_plan','research_brief','draft_email'))
    or (role_key='artist_relations' and action_type in ('task_plan','research_brief','draft_email','meeting_agenda'))
    or (role_key='station_manager' and action_type in ('task_plan','draft_post','draft_email','meeting_agenda'))
    or (role_key='producer' and action_type in ('task_plan','research_brief','draft_post'))
    or (role_key='contributor' and action_type in ('task_plan','podcast_outline','draft_post'))
  ),
  constraint hq_ai_proposal_client_dedupe unique(requester_user_id,client_request_key)
);

create index if not exists hq_ai_proposals_owner_queue_idx
on public.hq_ai_proposals(status,created_at desc);
create index if not exists hq_ai_proposals_requester_idx
on public.hq_ai_proposals(requester_user_id,created_at desc);
alter table public.hq_ai_proposals enable row level security;

revoke all on public.hq_ai_proposals from public,anon,authenticated;
grant select,insert,update on public.hq_ai_proposals to authenticated;

create policy hq_ai_proposals_read
on public.hq_ai_proposals for select to authenticated
using(
  requester_user_id = (select auth.uid())
  or (select public.is_hlr_owner())
);

create policy hq_ai_proposals_submit
on public.hq_ai_proposals for insert to authenticated
with check(
  requester_user_id = (select auth.uid())
  and status='pending' and reviewed_by is null and reviewed_at is null
  and linked_task_id is null and executed_at is null
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id=(select auth.uid()) and sp.active
      and sp.role::text = role_key
  )
);

create policy hq_ai_proposals_owner_review
on public.hq_ai_proposals for update to authenticated
using((select public.is_hlr_owner()))
with check((select public.is_hlr_owner()));

-- RPCs are SECURITY INVOKER, and protected by the policies above.
create or replace function public.hq_submit_ai_proposal(
  p_action_type text,p_title text,p_draft_body text,p_request_key uuid default null
) returns uuid
language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare v_role text;v_id uuid;
begin
  select sp.role::text into v_role from public.staff_profiles sp
  where sp.user_id=auth.uid() and sp.active;
  if v_role is null then
    raise exception 'Active HQ staff session required' using errcode='42501';
  end if;
  if coalesce(char_length(btrim(p_title)),0) not between 3 and 180
     or coalesce(char_length(btrim(p_draft_body)),0) not between 5 and 10000 then
    raise exception 'Title or draft content violates size limits';
  end if;
  insert into public.hq_ai_proposals
    (requester_user_id,role_key,action_type,title,draft_body,client_request_key)
  values(auth.uid(),v_role,p_action_type,btrim(p_title),btrim(p_draft_body),p_request_key)
  on conflict(requester_user_id,client_request_key)
    do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.hq_ai_proposals
    where requester_user_id=auth.uid() and client_request_key=p_request_key;
  end if;
  if v_id is null then raise exception 'Submission was not confirmed'; end if;
  return v_id;
end;
$$;

create or replace function public.hq_review_ai_proposal(
  p_proposal_id uuid,p_decision text,p_review_note text default null
) returns void
language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare v_title text;v_status text;
begin
  if auth.uid() is null or not (select public.is_hlr_owner()) then
    raise exception 'HLR CEO approval required' using errcode='42501';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if char_length(coalesce(p_review_note,''))>1000 then
    raise exception 'Review note too long';
  end if;
  update public.hq_ai_proposals
  set status=p_decision,review_note=nullif(btrim(p_review_note),''),
      reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
  where id=p_proposal_id and status='pending'
  returning title,status into v_title,v_status;
  if not found then raise exception 'Proposal is not pending CEO review'; end if;
  insert into public.hq_activity
    (actor_user_id,actor_name,department,action,summary,linked_type,linked_id)
  values(auth.uid(),'HLR CEO','Executive','ai_proposal_'||v_status,
         left('AI proposal '||v_status||': '||v_title,500),
         'ai_proposal',p_proposal_id::text);
end;
$$;

-- Deliberately narrow "execution": owner-approved task proposals can create
-- an internal task, exactly once, with the task linked back to the proposal.
-- No external action or generative model call occurs in this RPC.
create or replace function public.hq_execute_ai_task_plan(p_proposal_id uuid)
returns uuid
language plpgsql security invoker
set search_path=pg_catalog,public
as $$
declare v public.hq_ai_proposals%rowtype;v_task uuid;v_assignee uuid;
  v_owner_name text;v_department text;
begin
  if auth.uid() is null or not (select public.is_hlr_owner()) then
    raise exception 'HLR CEO execution approval required' using errcode='42501';
  end if;

  select * into v from public.hq_ai_proposals
  where id=p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v.status='executed' and v.linked_task_id is not null then
    return v.linked_task_id;
  end if;
  if v.status<>'approved' or v.action_type<>'task_plan' then
    raise exception 'Only CEO-approved task plans are executable';
  end if;
  v_department:=case v.role_key
    when 'owner' then 'Executive'
    when 'chairman' then 'Executive'
    when 'a_and_r' then 'A&R'
    when 'station_manager' then 'Radio & Image'
    when 'producer' then 'Creative'
    when 'artist_relations' then 'Artist Relations'
    when 'contributor' then 'Podcast'
    else 'Operations' end;

  select sp.user_id,sp.display_name into v_assignee,v_owner_name
  from public.staff_profiles sp
  where sp.active and sp.role::text=v.role_key
  order by sp.created_at asc limit 1;

  insert into public.hq_tasks
    (title,description,department,assignee_user_id,assignee_name,status,
     priority,approval_required,created_by)
  values(v.title,left('[HLR AI Ops — CEO-authorized task plan]'||E'\n'||v.draft_body,4000),
    v_department,v_assignee,v_owner_name,'todo','normal',false,auth.uid())
  returning id into v_task;

  update public.hq_ai_proposals
  set status='executed',linked_task_id=v_task,
      executed_at=now(),updated_at=now()
  where id=p_proposal_id;

  insert into public.hq_activity
    (actor_user_id,actor_name,department,action,summary,linked_type,linked_id)
  values(auth.uid(),'HLR CEO','Executive','ai_task_plan_executed',
         left('Created internal task from CEO-approved proposal: '||v.title,500),
         'task',v_task::text);
  return v_task;
end;
$$;

revoke all on function public.hq_submit_ai_proposal(text,text,text,uuid) from public,anon;
revoke all on function public.hq_review_ai_proposal(uuid,text,text) from public,anon;
revoke all on function public.hq_execute_ai_task_plan(uuid) from public,anon;
grant execute on function public.hq_submit_ai_proposal(text,text,text,uuid) to authenticated;
grant execute on function public.hq_review_ai_proposal(uuid,text,text) to authenticated;
grant execute on function public.hq_execute_ai_task_plan(uuid) to authenticated;

-- This migration does NOT loosen legacy hq_tasks RLS. A separate migration
-- must audit and tighten legacy staff task-write policies before handing
-- autonomous agents existing staff tokens or access to the old task API.

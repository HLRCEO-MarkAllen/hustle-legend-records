# HLR HQ — AI Operations v1 rollout

## Status
**Database migration installed and RLS/RPC tests passed on October 19, 2026.** Website branch pending merge and post-deployment verification. **AI model runner not connected**,
**no automatic sending, public publishing, payments, contract actions or rights transfers**.

## Files
- `hq-v2.html`: navigation to the new in-HQ AI workbench
- `hq-ai-ops.html`: team proposal workbench, same Supabase Auth session as HQ
- `sql/hlr_ai_ops_v1.sql`: deployed database migration source for role-specific proposals,
  CEO approvals, and idempotent owner-authorized internal task creation

## Six department assistants
| Team | HLR DB role | Allowed proposal categories |
| --- | --- | --- |
| Grace | `chairman` | all draft categories / strategic review |
| Nick | `a_and_r` | research, task plan, email draft |
| Danie | `station_manager` | social/email draft, task plan, meeting agenda |
| John | `producer` | research, task plan, social draft |
| Torown | `artist_relations` | research, email draft, task plan, meeting agenda |
| TY | `contributor` | podcast outline, task plan, social draft |

The migration adds TY's dedicated INVERTED TIME instructions to the existing
`hq_ai_role_context` under the existing `contributor` staff role. No new
Supabase Auth account or role enum is created.

## Workflow
1. Each team member signs into the **existing** HLR HQ identity.
2. They open **AI Operations** and submit a draft prepared by their assistant.
3. Server checks active `staff_profiles` role, permitted proposal type, and
   matches `auth.uid()` to the submitter. RLS restricts staff to their own items;
   the CEO can see all.
4. CEO explicitly approves or rejects pending submissions. Decision recorded
   in the existing `hq_activity` table.
5. Only an **approved `task_plan`** displays a second control to create a
   real task in `hq_tasks`. CEO confirms. The server locks the proposal,
   creates one internal task, records the link and activity, and returns the
   existing task on duplicate requests. No other action type has an executor.

## Deliberate security boundary
The new AI proposal API is separate from the **legacy `hq_tasks` CRUD API**.
Current staff task-write permissions remain too broad for autonomous bots.
**Do not give team AI agents ordinary staff Supabase credentials or direct
`hq_tasks` write access.** Before an autonomous runner is introduced, harden
legacy task policies with tested department/assignment ownership enforcement,
then issue purpose-scoped credentials via a server-side integration.

Do not expose `service_role` or other Supabase private keys in HTML, AI
prompts, Make scenarios shown to staff, or source control.

The currently public/publishable Supabase key in the HQ frontend is intended
for browsers; its access must remain constrained by RLS.

## Rollout order
1. [x] Review PR code and SQL.
2. [x] Applied `sql/hlr_ai_ops_v1.sql` through Supabase migration `hlr_ai_operations_proposal_queue_v1` in existing project.
3. [x] Validated staff / CEO isolation, role spoof protection, proposal approval, rejection, activity records, and idempotent internal task creation with **rolled-back** transactions. Database has zero test proposals after verification.
4. [ ] Merge website branch and verify public delivery.
5. Verify authenticated login and mobile navigation separately as owner,
   Chairman, A&R, Station Manager, Producer, Artist Relations and Contributor.
6. Create a test proposal for each permitted role and an explicitly forbidden
   category; verify RLS denies cross-role access and staff approval attempts.
7. Confirm CEO approve/reject, repeat-task execution idempotency, and HQ
   Activity event logging.
8. Enable model-driven generation or scheduled execution **only after**
   choosing an authorized provider, credentials, permitted scopes, costs and
   staff testing. No scheduler/Make scenario exists as part of this PR.

## Security follow-up
Supabase Auth reports leaked-password protection disabled.
See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Non-goals
- No independent GPT/LLM API calls.
- No background queue processing.
- No outside platform integration setup, webhooks or outbound messages.
- No payout, contract, master/publishing ownership, or customer data mutations.

-- Administrative audit log.
--
-- Records security-relevant admin actions so privileged activity has a durable,
-- queryable trail. Each row captures the actor, the action name, an optional
-- target identifier, the outcome and the time.
--
-- Only identifiers and action names are stored - never passwords, tokens,
-- secrets, or request payloads. Writes are performed server-side with the
-- service-role client (which bypasses RLS), so a client cannot forge or block
-- an entry; read access is limited to admins.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 64),
  target text check (target is null or char_length(target) <= 200),
  outcome text not null default 'success'
    check (outcome in ('success', 'failure')),
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_actor_id
  on public.admin_audit_log (actor_id);

alter table public.admin_audit_log enable row level security;

-- Clients may read (admins only, via RLS) but never write: there are no
-- INSERT/UPDATE/DELETE policies, and write grants are revoked. The service role
-- bypasses RLS to append entries.
revoke all on public.admin_audit_log from anon;
revoke all on public.admin_audit_log from authenticated;
grant select on public.admin_audit_log to authenticated;

drop policy if exists "Admins can read the audit log" on public.admin_audit_log;
create policy "Admins can read the audit log"
  on public.admin_audit_log
  for select
  to authenticated
  using (public.is_admin());

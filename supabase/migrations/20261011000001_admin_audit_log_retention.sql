-- Retention policy for the admin audit log.
--
-- The audit log grows unbounded, so this adds a maintenance routine that deletes
-- entries older than a configurable window. Purging is a privileged operation:
-- the function is SECURITY DEFINER with an empty search_path, executable only by
-- service_role, and intended to be run on a schedule (see pg_cron notes in
-- docs/security/migration-deployment-plan.md).
--
-- Additive only; it does not modify the admin_audit_log table.

create or replace function public.purge_admin_audit_log(p_retain_days integer default 365)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if p_retain_days is null or p_retain_days < 1 then
    raise exception 'p_retain_days must be a positive integer';
  end if;

  delete from public.admin_audit_log
  where created_at < now() - make_interval(days => p_retain_days);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all privileges
  on function public.purge_admin_audit_log(integer)
  from public, anon, authenticated;
grant execute
  on function public.purge_admin_audit_log(integer)
  to service_role;

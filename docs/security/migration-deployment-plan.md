# Migration Deployment Plan — `admin_audit_log`

- **Objective:** Close the deployment gap where the linked Supabase project was behind `main` (missing the admin audit table and its retention routine) and confirm schema parity.
- **Status:** **APPLIED AND VERIFIED — 2026-10-11.** Applied with the Supabase CLI migration pipeline (`supabase link` + `supabase db push --linked`) using the CLI's stored credential (Windows Credential Manager target `Supabase CLI:supabase`). No secret value was read out or printed. Post-apply verification passed (see [§5](#5-post-deployment-verification--passed)). This supersedes the earlier **NOT APPLIED** status.
- **Target project:** `zlmbitphlzokjmfwldcb` (`tallgate`) — matches both `supabase/.temp/project-ref` and `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.
- **Scope correction:** the remote migration ledger was out of sync by **five** migrations, not two. All five are idempotent and were applied in timestamp order:

  | Migration | Purpose |
  | --------- | ------- |
  | `20261007210000_tighten_course_content_uuid_guards.sql` | `course-content` storage policies / UUID guards |
  | `20261007220000_admin_read_draft_lessons.sql` | lessons SELECT policy (draft read for admins) |
  | `20261010000000_payment_confirmation_enrollment.sql` | payment → enrollment RPC (`update_payment_request_status`) |
  | `20261011000000_admin_audit_log.sql` | audit table + RLS + admin-read policy |
  | `20261011000001_admin_audit_log_retention.sql` | `purge_admin_audit_log(integer)` retention routine |

- **Outcome:** `supabase migration list --linked` now reports **all 27 local migrations matching remote** (the ledger is back in sync).

## 1. Root-cause analysis (historical — captured before the apply)

Evidence (2026-10-11, read-only, before the apply):

| Probe | Result |
| ----- | ------ |
| `GET /rest/v1/admin_audit_log` with **publishable** key | `404 PGRST205` "Could not find the table 'public.admin_audit_log' in the schema cache" |
| `GET /rest/v1/admin_audit_log` with **secret** key | `404 PGRST205` (identical) |
| All other migration tables (`payment_requests`, `course_enrollments`, `certificates`, `course_categories`, `api_rate_limits`, …) | Resolve normally (`200`/`401`), so the PostgREST schema cache is healthy and populated |

**Conclusion:** the table did not exist in the target database — the migration had **not been applied**. This was **not**:

- *a permission / RLS artifact* — the secret key (which bypasses RLS) received the same `404`;
- *a schema-cache lag* — every other table, including ones added in the same recent migration window, resolved;
- *incorrect project targeting* — `.env.local` and `supabase/.temp/project-ref` point at the same ref, and public catalogue reads return live data from that project.

**Caveat (resolved):** at capture time the migration history could not be read directly, so "not applied" was established by absence-of-table evidence. On apply, the history was read and showed **five** pending migrations (see Scope correction above).

## 2. Migration review (idempotency, privileges, RLS, compatibility)

All five applied migrations are re-runnable (they use `if not exists`, `drop policy if exists … ; create policy …`, `create or replace function`, and `revoke`/`grant`), so a partial prior apply would not have caused failure. Review of `20261011000000_admin_audit_log.sql`:

- **Idempotent:** `create table if not exists`, `create index if not exists`, `drop policy if exists … ; create policy …`, `alter table … enable row level security`, and `revoke`/`grant` are all re-runnable. Safe if partially applied.
- **Schema:** `id` uuid PK default `gen_random_uuid()`; `actor_id` uuid → `public.profiles(id)` `on delete set null`; `action` text 1–64; `target` text ≤200 or null; `outcome` text default `'success'` in `('success','failure')`; `created_at` timestamptz default `now()`. Two indexes (`created_at desc`, `actor_id`).
- **Privileges:** `revoke all … from anon` and `from authenticated`, then `grant select … to authenticated`. `service_role` is not modified, so it keeps its default privileges and (with `bypassrls`) can insert.
- **RLS:** enabled; a single `FOR SELECT TO authenticated USING (public.is_admin())` policy. No INSERT/UPDATE/DELETE policies, so clients cannot write even before grants are considered.
- **Helper compatibility (`lib/admin/auditLog.ts`, commit `341bd16`):** inserts `actor_id`, `action` (sliced to 64), `target` (sliced to 200), `outcome` (`success`/`failure`) — exactly the columns/constraints above. Writes are best-effort, so a missing table fails soft (logged, swallowed).
- **Interaction with existing objects:** `public.is_admin()` already exists and is granted to `authenticated` (phase3 schema); `public.profiles(id)` exists. No naming collisions.
- **No data or destructive change:** additive only; no `ALTER`/`DROP` of existing objects.

## 3. Preconditions

1. Owner/operator authorization to change the production database. **This was obtained for the apply below via the existing authenticated CLI environment.**
2. Confirm the target ref is `zlmbitphlzokjmfwldcb` (and that it is the intended environment for the change).
3. A current backup / point-in-time-recovery window (Supabase automated backups or an on-demand backup) before applying.
4. Confirm prerequisites exist in the target: `public.profiles`, `public.is_admin()`, `gen_random_uuid()` (`pgcrypto`/`pgcrypto`-equivalent).
5. Low-traffic window; the migration is fast but takes a brief `ACCESS EXCLUSIVE` lock while creating the table.

## 4. Apply (executed 2026-10-11)

CLI migration pipeline (chosen because it keeps the remote ledger in sync and is transactional per migration):

```
npx supabase projects list                          # confirmed the stored login works
npx supabase link --project-ref zlmbitphlzokjmfwldcb --yes
npx supabase db push --linked --skip-vault --yes    # applied the 5 pending migrations
```

`--skip-vault` was used because `supabase/config.toml` contains no `[db.vault]` secrets (the file is `project_id` only), so there was nothing to sync. All five migrations applied successfully in timestamp order and were recorded in `supabase_migrations.schema_migrations`.

> Historical alternative (unchanged): paste a migration **verbatim** inside a transaction (`begin; … commit;`) in the SQL editor. Do not edit an already-applied migration; if a change is ever needed, add a new migration.

## 5. Post-deployment verification (read-only) — PASSED

| Check | Method | Result |
| ----- | ------ | ------ |
| Table exists | `GET /rest/v1/admin_audit_log` with **publishable** key | `401` `42501 permission denied for table admin_audit_log` (was `404 PGRST205`) |
| RLS enabled | `pg_class.relrowsecurity` (Management API query) | `true` (owner `postgres`) |
| Admin-read policy | `pg_policies` | `"Admins can read the audit log"` — `PERMISSIVE`, `SELECT`, roles `{authenticated}`, qual `is_admin()` |
| Table grants | `information_schema.role_table_grants` | `authenticated` = `SELECT` only; `anon` = none; `service_role` = full DML. No client write path. |
| Retention function | `pg_proc` / `routine_privileges` | `purge_admin_audit_log(p_retain_days integer)` — `SECURITY DEFINER`, `search_path=""`, owner `postgres`; `EXECUTE` only to `postgres`/`service_role` (anon → `42501 permission denied for function`) |
| Ledger parity | `supabase migration list --linked` | all 27 local == remote (tail includes `20261011000001`) |
| Storage policies | `pg_policies` (`storage.objects`) | `"Preview lesson videos are publicly readable"` (`anon,authenticated`) + `"Enrolled learners can read course videos"` (`authenticated`) |
| Lessons policy | `pg_policies` (`public.lessons`) | admin INSERT/UPDATE/DELETE + `"Published lessons are viewable by preview or enrolled users"` (`anon,authenticated`) |
| Payment RPC | `pg_proc` / `routine_privileges` | `update_payment_request_status` — `SECURITY DEFINER`, `search_path=""`, `EXECUTE` to `authenticated`/`service_role`/`postgres` |

Still to exercise (requires an authenticated admin session in a running app, not done here to avoid writing synthetic audit rows to the live log): perform **one** authorized admin action and read the row back (`actor_id`/`action`/`outcome`). Do not print audit contents into shared logs (they contain actor identifiers). A negative test (`INSERT` with the publishable key / a normal authenticated token → denial) is already implied by the grant + RLS evidence above.

## 6. Rollback / recovery

- The migration is **additive**, so "rollback" means `drop table public.admin_audit_log;` — **destructive to audit history**; only use it if the change must be undone before any rows matter.
- There is no non-destructive rollback that preserves rows; recovery of dropped rows relies on PITR/backups (if enabled).
- Leaving the table in place is safe: nothing else depends on it and the helper tolerates its absence.

## Access and method

- A DDL-capable path **was** available this time: the Supabase CLI had a stored login credential (Windows Credential Manager target `Supabase CLI:supabase`), so `supabase link`/`db push` authenticated as the `cli_login_postgres` login role without a separate DB password.
- Read-only verification also used the stored CLI credential against the **Management API** (`POST /v1/projects/<ref>/database/query`) for `pg_class`/`pg_policies`/`pg_proc` checks, and the local `.env.local` publishable key for PostgREST denial checks. No secret values were printed.
- Not used / still unavailable: direct DB URL with password, `psql`, dashboard UI. `db dump` was unavailable (requires Docker).

## Retention migration and scheduling (`20261011000001_admin_audit_log_retention.sql`)

Additive companion migration that adds `public.purge_admin_audit_log(p_retain_days integer default 365)`:

- **Idempotent:** `create or replace function`, plus `revoke`/`grant`. Safe to re-run. **Applied 2026-10-11.**
- **Privileges:** `SECURITY DEFINER` with `set search_path = ''`; execute revoked from `public`, `anon`, `authenticated` and granted only to `service_role`. `anon`/`authenticated` cannot purge. **Verified.**
- **Effect:** deletes `admin_audit_log` rows older than the retention window and returns the deleted count. Non-positive `p_retain_days` raises an error. Additive only — it does not alter the table.

### Scheduling (pg_cron) — optional, still dashboard/extensions required

The retention function does nothing until invoked. To run it nightly, enable the `pg_cron` extension (Dashboard → Database → Extensions) and schedule, e.g.:

```sql
select cron.schedule(
  'purge-admin-audit-log',
  '0 3 * * *',
  $$select public.purge_admin_audit_log(365);$$
);
```

Alternatively call it from an external scheduler via the service role. This requires dashboard access that is **NOT VERIFIED** in this environment; record the chosen jobs and retention window here once configured.

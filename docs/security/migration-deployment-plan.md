# Migration Deployment Plan — `admin_audit_log`

- **Objective:** Resolve the deployment gap where the linked Supabase project reports `public.admin_audit_log` as missing, safely and with explicit authorization.
- **Status:** **NOT APPLIED.** No authorized deployment path was available in this review (see [Access constraints](#access-constraints)). Do **not** run this automatically.
- **Migration:** `supabase/migrations/20261011000000_admin_audit_log.sql` (introduced in commit `341bd16`).
- **Target project:** `zlmbitphlzokjmfwldcb` (`tallgate`) — matches both `supabase/.temp/project-ref` and `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.

## 1. Root-cause analysis

Evidence (2026-10-11, read-only):

| Probe | Result |
| ----- | ------ |
| `GET /rest/v1/admin_audit_log` with **publishable** key | `404 PGRST205` "Could not find the table 'public.admin_audit_log' in the schema cache" |
| `GET /rest/v1/admin_audit_log` with **secret** key | `404 PGRST205` (identical) |
| All other migration tables (`payment_requests`, `course_enrollments`, `certificates`, `course_categories`, `api_rate_limits`, …) | Resolve normally (`200`/`401`), so the PostgREST schema cache is healthy and populated |

**Conclusion:** the table does not exist in the target database — the migration has **not been applied**. This is **not**:

- *a permission / RLS artifact* — the secret key (which bypasses RLS) receives the same `404`;
- *a schema-cache lag* — every other table, including ones added in the same recent migration window, resolves, and the notification-driven cache has had ample time to reload;
- *incorrect project targeting* — `.env.local` and `supabase/.temp/project-ref` point at the same ref, and public catalogue reads return live data from that project.

**Caveat:** migration history could not be read directly (`supabase_migrations.schema_migrations` and the management API were unavailable), so "not applied" is established by absence-of-table evidence rather than a migration-log read.

## 2. Migration review (idempotency, privileges, RLS, compatibility)

Read of `20261011000000_admin_audit_log.sql`:

- **Idempotent:** `create table if not exists`, `create index if not exists`, `drop policy if exists … ; create policy …`, `alter table … enable row level security`, and `revoke`/`grant` are all re-runnable. Safe if partially applied.
- **Schema:** `id` uuid PK default `gen_random_uuid()`; `actor_id` uuid → `public.profiles(id)` `on delete set null`; `action` text 1–64; `target` text ≤200 or null; `outcome` text default `'success'` in `('success','failure')`; `created_at` timestamptz default `now()`. Two indexes (`created_at desc`, `actor_id`).
- **Privileges:** `revoke all … from anon` and `from authenticated`, then `grant select … to authenticated`. `service_role` is not modified, so it keeps its default privileges and (with `bypassrls`) can insert.
- **RLS:** enabled; a single `FOR SELECT TO authenticated USING (public.is_admin())` policy. No INSERT/UPDATE/DELETE policies, so clients cannot write even before grants are considered.
- **Helper compatibility (`lib/admin/auditLog.ts`, commit `341bd16`):** inserts `actor_id`, `action` (sliced to 64), `target` (sliced to 200), `outcome` (`success`/`failure`) — exactly the columns/constraints above. Writes are best-effort, so a missing table fails soft (logged, swallowed).
- **Interaction with existing objects:** `public.is_admin()` already exists and is granted to `authenticated` (phase3 schema); `public.profiles(id)` exists. No naming collisions.
- **No data or destructive change:** additive only; no `ALTER`/`DROP` of existing objects.

## 3. Preconditions

1. Owner/operator authorization to change the production database.
2. Confirm the target ref is `zlmbitphlzokjmfwldcb` (and that it is the intended environment for the change).
3. A current backup / point-in-time-recovery window (Supabase automated backups or an on-demand backup) before applying.
4. Confirm prerequisites exist in the target: `public.profiles`, `public.is_admin()`, `gen_random_uuid()` (`pgcrypto`/`pgcrypto`-equivalent).
5. Low-traffic window; the migration is fast but takes a brief `ACCESS EXCLUSIVE` lock while creating the table.

## 4. Apply (approved process only)

Preferred — CLI migration pipeline:

```
supabase link --project-ref zlmbitphlzokjmfwldcb
supabase migration list --linked        # confirm 20261011000000 is pending
supabase db push                        # applies pending migrations
```

Alternative — SQL editor: paste the file **verbatim** inside a transaction (`begin; … commit;`). Do not edit an already-applied migration; if a change is ever needed, add a new migration.

## 5. Post-deployment verification (read-only)

1. Table visible: `GET /rest/v1/admin_audit_log?select=id&limit=1` with the secret key → expect `200` with `[]` (no longer `PGRST205`).
2. Authorization: the same request with the publishable key → expect `401` (`42501`) or `200 []`; it must **not** return rows.
3. SQL (SQL editor): confirm `rowsecurity = true` for the table and the `"Admins can read the audit log"` policy exists; confirm `anon` has no grant and `authenticated` has `SELECT`.
4. Functionality: perform **one** authorized admin action in staging, then read the row back with the secret key / SQL and confirm `actor_id`/`action`/`outcome` are recorded. Do not print audit contents into shared logs (they contain actor identifiers).
5. Negative test: attempt `INSERT` into `admin_audit_log` with the publishable key (and with a normal authenticated token) → expect denial (`401`/`403`/`42501`).

## 6. Rollback / recovery

- The migration is **additive**, so "rollback" means `drop table public.admin_audit_log;` — **destructive to audit history**; only use it if the change must be undone before any rows matter.
- There is no non-destructive rollback that preserves rows; recovery of dropped rows relies on PITR/backups (if enabled).
- Leaving the table in place is safe: nothing else depends on it and the helper tolerates its absence.

## Access constraints

The following were **not** available, which is why the plan was not executed and the item remains unresolved:

- No `SUPABASE_ACCESS_TOKEN` and no stored CLI credential (`~/.supabase` has only `traces`/`telemetry.json`).
- No `SUPABASE_DB_URL`/`DATABASE_URL`, no `psql`, and no `supabase` CLI on `PATH`.
- No dashboard/management-API access.

**Owner action required:** run the preconditions and apply step above with authorization, then complete the verification section and record the result here (and in `external-configuration-verification.md`, X-06/X-11).

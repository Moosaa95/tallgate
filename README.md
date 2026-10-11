# TallGate

TallGate is a Next.js and Supabase platform for a technology and startup-services
company. It combines a public marketing site, a Learning Hub with verifiable
graduation certificates, a lead/intake pipeline (contact, consultation, startup
applications, enrollments), and a role-gated admin portal for running the
catalogue, payments, users, and inquiries end to end.

## Tech stack

- **Framework:** Next.js 16 (App Router, React Server Components) with `proxy.ts`
  as the request middleware
- **Language:** TypeScript 5
- **UI:** React 19, Tailwind CSS 3, `@headlessui/react`, `react-icons`
- **Backend:** Supabase (Postgres, Auth, Storage) via `@supabase/ssr` and
  `@supabase/supabase-js`
- **Certificates:** server-rendered PDFs with `@react-pdf/renderer` and QR codes
  with `qrcode`
- **Email:** Resend (`POST /api/email` only)
- **Tests:** Vitest

## Requirements

- Node.js **22.12.0 or newer** (`engines.node` in `package.json`; CI pins Node 22)
- npm (a `package-lock.json` is committed)
- A Supabase project for any database-backed feature

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and fill in the values (see
   [Environment variables](#environment-variables)). Never commit `.env.local`.

3. Apply the database migrations to your Supabase project (see
   [Database and migrations](#database-and-migrations)).

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The app runs on Webpack
   (`next dev --webpack`).

## Environment variables

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public | Canonical site origin. Used for certificate verification links and metadata. Must be a real `https` origin in production. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Browser-safe Supabase anon key. Protected by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server only** | Bypasses RLS. Required for admin actions, certificate storage, rate limiting, and validated public form writes. Never expose to the browser. |
| `RESEND_API_KEY` | No | Server only | Read only by `POST /api/email`. Without it the route returns `503`. |
| `RESEND_FROM_EMAIL` | No | Server only | Verified Resend sender in `Name <address>` form. No default; the route returns `503` without it. |
| `RATE_LIMIT_TRUSTED_IP_HEADERS` | No | Server only | Comma-separated header names used to resolve client IPs. Defaults to `x-real-ip,cf-connecting-ip`. |
| `LOG_LEVEL` | No | Server only | `debug` \| `info` \| `warn` \| `error`. Defaults to `debug` in development and `info` in production. |

`NEXT_PUBLIC_*` values are embedded at build time. `lib/config/env.ts` defines the
critical variables and `instrumentation.ts` fails fast on a missing critical
variable at server startup (except during a production build). `next.config.mjs`
also logs non-fatal warnings during `next build` when Supabase config, Resend, or
`NEXT_PUBLIC_SITE_URL` (or a localhost value) is missing.

## Available scripts

| Script | Command | Description |
| --- | --- | --- |
| `npm run dev` | `next dev --webpack` | Development server. |
| `npm run build` | `next build --webpack` | Production build. |
| `npm run start` | `next start` | Serve the production build. |
| `npm run lint` | `eslint .` | Lint. |
| `npm run typecheck` | `tsc --noEmit` | Type check. |
| `npm run test` | `vitest run` | Run the unit test suite. |

CI (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, `test`, and `build` on
Node 22 for pull requests and pushes to `main`.

## Testing

Tests live in `tests/unit/` and run with Vitest. They cover the pure/security-
sensitive logic: environment validation, auth callback and email OTP handling,
registration and role rules, rate limiting, certificate date formatting, course
content paths, catalogue seeding, payment status errors, pagination, redirects,
security headers, and the redacting logger.

```bash
npm run test
```

## Database and migrations

The schema lives in `supabase/migrations/` and generated types are in
`types/supabase.ts`. The timestamped Phase 3 migrations are authoritative. See
`docs/database/README.md` for a table overview and admin-bootstrap steps.

### Migration files (apply in filename order)

1. `20260828000000_phase3_schema.sql`
2. `20260829000000_lesson_content_gating.sql`
3. `20260930000000_certificate_registry.sql`
4. `20261001000000_lesson_progress.sql`
5. `20261002000000_certificate_storage_path.sql`
6. `20261003000000_storage_buckets_and_grants.sql`
7. `20261004000000_demo_certificate_seed.sql` — optional; seeds three `[DEMO]`
   certificates for testing `/verify`
8. `20261005000000_certificate_storage_policies.sql`
9. `20261006000000_public_api_hardening.sql`
10. `20261006010000_certificate_verification_rpc.sql`
11. `20261007000000_rate_limit_and_enrollment_hardening.sql`
12. `20261007100000_enforce_single_role_per_user.sql`
13. `20261007110000_course_documents_and_live_sessions.sql`
14. `20261007120000_admin_course_lesson_writes.sql`
15. `20261007130000_payment_requests.sql`
16. `20261007140000_course_categories.sql`
17. `20261007150000_learner_certificate_read.sql`
18. `20261007160000_harden_course_content_storage_policies.sql`
19. `20261007170000_policy_and_grant_hygiene.sql`
20. `20261007180000_seed_learning_hub_catalogue.sql` — seeds the six Learning Hub
    packages, one module each, and their syllabus lessons
21. `20261007190000_admin_catalogue_writes.sql`
22. `20261007200000_signup_role_mapping.sql`
23. `20261007210000_tighten_course_content_uuid_guards.sql`
24. `20261007220000_admin_read_draft_lessons.sql`
25. `20261010000000_payment_confirmation_enrollment.sql`
26. `20261011000000_admin_audit_log.sql`
27. `20261011000001_admin_audit_log_retention.sql`

Do not apply the removed legacy `0001` / `0002` learning-hub migrations.

### Applying migrations safely

Apply migrations through the Supabase CLI so each is recorded in the project's
migration history:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase migration list --linked
supabase db push --linked
```

Rules:

- Confirm the linked project is the intended environment **before** pushing.
- A migration is **pending** until it appears in the target project's
  `supabase_migrations.schema_migrations` history. The two most recently added
  migrations are `20261011000000_admin_audit_log.sql` and
  `20261011000001_admin_audit_log_retention.sql`.
- Never paste migration SQL into the SQL Editor and then run `supabase db push`;
  the schema and CLI history would diverge. If migrations were applied manually,
  reconcile the history before using `db push`.
- Apply pending migrations only after confirming the target environment,
  reviewing each migration's contents and dependencies, and putting an
  appropriate backup and rollback plan in place.
- Never put a database password, access token, or service-role key in source
  control or send it in chat.

`docs/security/migration-deployment-plan.md` is the deployment record. It states
that the linked project was brought into migration parity on 2026-10-11 and that
the five migrations then outstanding were applied and their effects verified.
This README does not re-check that state; run `supabase migration list --linked`
to confirm before relying on it.

### First admin

Migrations do not grant admin privileges automatically. After the first user has
registered and verified their account, insert a row into `public.user_roles`
linking that user to the `admin` role (see `docs/database/README.md` for the SQL).

### Storage buckets

The private `certificates` bucket and the course-content buckets are created and
locked down by the storage migrations. Certificate PDFs are stored in
`certificates`; access is only through short-lived signed URLs.

## Authentication and roles

- Supabase Auth is used for email/password, magic links, invites, and password
  recovery. `app/auth/callback/route.ts` accepts both a PKCE `code` (same browser)
  and an email `token_hash` + `type` (cross-device).
- To enable cross-device confirmation, set the Supabase email templates'
  confirmation URL to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` (use
  `type=recovery` with `next=/reset-password` for recovery). The default
  `{{ .ConfirmationURL }}` only works in the browser that started the flow.
- Each user has exactly one role via `user_roles` (`unique(user_id)`). Roles are
  assigned by `handle_new_user()` from the allow-listed `account_type` chosen at
  sign-up (`startup_founder`, `business_owner`, `learner`) and by admins
  afterwards.
- Server-side guards live in `lib/auth/guards.ts`: `requireUser`, `requireAdmin`,
  and `requireAdminApi`.

## API routes

| Route | Method | Access | Notes |
| --- | --- | --- | --- |
| `/api/verify` | GET | Public | Certificate verification by code; rate limited. |
| `/api/contact` | POST | Public | Contact intake; validated and rate limited. |
| `/api/consultations` | POST | Public | Consultation requests; validated and rate limited. |
| `/api/startups` | POST | Public | Startup applications; validated and rate limited. |
| `/api/enrollments` | POST | Public | Enrollment inquiries; course resolved server-side by slug. |
| `/api/email` | POST | Admin | Sends transactional email via Resend; rate limited per admin. |
| `/api/admin/actions` | POST | Admin | Admin mutations (see below). |
| `/api/admin/certificates/[id]/download` | GET | Admin | 5-minute signed URL for a certificate. |
| `/api/certificates/[id]/download` | GET | Signed-in owner | 5-minute signed URL for the caller's own certificate. |

Public intake is accepted only through these validated, rate-limited routes;
direct client inserts into the intake tables and active enrollments are revoked
by migration. The admin action endpoint dispatches: `update_consultation_status`,
`update_startup_status`, `toggle_course_publish`, `toggle_course_popular`,
`update_course_domain`, `create_course`, `seed_learning_hub_courses`,
`issue_certificate`, `toggle_certificate_validity`, `update_message_status`,
`create_payment_request`, `update_payment_status`, `create_user`, and
`update_user_role`. Admin mutations are recorded in `admin_audit_log`.

## Certificates

Admins issue certificates through the `issue_certificate` action. The server
generates the certificate number and verification code, renders a PDF with
`@react-pdf/renderer` (`lib/certificates/generateCertificatePdf.tsx`) including a
QR code that points at the public verification URL, uploads it to the private
`certificates` bucket, and records it in `certificates`. Learners verify a
certificate at `/verify` or via `GET /api/verify`, which calls the
`verify_certificate` RPC and returns only the certificate number, course title,
issue date, and valid/revoked state.

## Rate limiting

Public endpoints use a server-side Supabase rate-limit table
(`lib/api/rateLimit.ts`):

- contact: 5 requests per IP per 15 minutes
- consultation: 3 per IP per 15 minutes
- startup application: 3 per IP per 15 minutes
- enrollment: 5 per IP per 15 minutes
- certificate verification: 30 per IP per 15 minutes
- email: 20 per admin per hour

Client IPs are read from trusted headers (`RATE_LIMIT_TRUSTED_IP_HEADERS`,
default `x-real-ip,cf-connecting-ip`). The production proxy **must overwrite**
these headers, not append to them. If no trusted IP can be resolved in production
the request is rejected (`503`) rather than sharing a single fallback bucket, so
configure the header before going live.

## Security

- **Headers / CSP:** `next.config.mjs` sets `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and a
  Content-Security-Policy (enforced in production, report-only in development).
- **RLS:** row-level security is enabled on every table. Public visitors can
  submit inquiries and verify certificates; users read their own enrollments,
  progress, and applications; only admins can read the inquiry queue, author
  content, manage roles, or read `admin_audit_log`.
- **Logging:** `lib/logging/logger.ts` writes structured logs and redacts
  sensitive context keys (tokens, secrets, credentials, email/phone/name, etc.).
- **Service role:** the service-role client (`lib/supabase/admin.ts`) is
  `server-only`; callers must verify admin status first.

Security fixes, residual risks, and verification status are tracked in
`docs/security/` — see [Documentation](#documentation). Do not treat the project
as production-ready without reviewing those documents.

## Project structure

```
app/                 App Router: (landing), (marketing), (auth), (dashboard),
                     (admin), learn, startups, resources, api
components/          UI: admin, auth, cards, certificates, community, dashboard,
                     forms, landing, layout, learning, marketing, navigation, ui
features/            Feature composition: bookings, businesses, community,
                     consultation, learning, notifications, payments, services,
                     startups, users
lib/                 Auth, admin, api (rate limiting), catalogue, certificates,
                     config, data, database, learning, logging, supabase, utils
supabase/migrations/ Timestamped SQL migrations (authoritative schema)
types/supabase.ts    Generated database types
tests/unit/          Vitest unit tests
docs/                Database and security documentation
proxy.ts             Request middleware (session refresh + route matcher)
instrumentation.ts   Startup environment validation
```

## Deployment

TallGate deploys as a standard Next.js app (for example on Vercel) backed by a
Supabase project.

1. Set the production environment variables (see the table above). Use a real
   `https` `NEXT_PUBLIC_SITE_URL`, the production Supabase URL/anon key, the
   service-role key (server-only), and Resend credentials if email is used.
2. Apply pending migrations to the target Supabase project following
   [Applying migrations safely](#applying-migrations-safely).
3. Configure Supabase Auth: set the production Site URL and redirect allow-list,
   and update the email templates to the cross-device callback format above.
4. Ensure the hosting proxy sets `x-real-ip` / `cf-connecting-ip` so rate
   limiting works, and terminates TLS.
5. Bootstrap an admin role for the first operator.

### Production readiness

Known outstanding items and their verification status are documented in
`docs/security/` (notably `release-readiness.md` and
`external-configuration-verification.md`). At the time these docs were written,
the Supabase Auth Site URL and redirect allow-list, email-template wording, and
production runtime secrets were still unverified or pending, and host-side TLS
and trusted-IP header behavior had not been confirmed. Re-verify each item
against the target environment before treating a deployment as production-ready.

## Documentation

- `docs/database/README.md` — database tables, migration application, first admin
- `docs/security/release-readiness.md` — release readiness and blockers
- `docs/security/external-configuration-verification.md` — external config status
- `docs/security/migration-deployment-plan.md` — migration deployment record
- `docs/security/asvs-5.0.0-assessment.md` — OWASP ASVS 5.0 assessment
- `docs/security/session-management.md` — session/auth configuration notes

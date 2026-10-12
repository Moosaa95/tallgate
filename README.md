# TallGate

[![CI](https://github.com/Z-AKB/tallgate/actions/workflows/ci.yml/badge.svg)](https://github.com/Z-AKB/tallgate/actions/workflows/ci.yml)

TallGate is the web platform for a Nigerian technology and startup-services
company. It combines a public marketing site, an enterprise intake pipeline
(contact, consultation, startup applications, enrollment enquiries), a Learning
Hub with graded assessments and verifiable PDF certificates, and a role-gated
operations console for running the catalogue, learners, payments, and enquiries.

It serves three audiences in one Next.js application:

- **Public visitors and enterprise clients** — discover services, request
  consultations, apply to the startup programme, and verify certificates.
- **Learners** — enrol in courses, watch lessons, take quizzes/exams, and collect
  verifiable certificates.
- **Staff / administrators** — triage enquiries, manage courses and content, grade
  open-response answers, issue certificates, and administer users and payments.

> **Status:** actively developed. The codebase is feature-complete for the
> workflows above, but several production-hardening items remain (see
> [Deployment and production readiness](#12-deployment-and-production-readiness)
> and [Known limitations and roadmap](#13-known-limitations-and-roadmap)).

---

## Table of contents

1. [Overview](#1-overview)
2. [Key features](#2-key-features)
3. [Technology stack and architecture](#3-technology-stack-and-architecture)
4. [Repository structure](#4-repository-structure)
5. [Prerequisites](#5-prerequisites)
6. [Local setup](#6-local-setup)
7. [Environment configuration](#7-environment-configuration)
8. [Database and migrations](#8-database-and-migrations)
9. [Available scripts](#9-available-scripts)
10. [Testing and quality checks](#10-testing-and-quality-checks)
11. [Security considerations](#11-security-considerations)
12. [Deployment and production readiness](#12-deployment-and-production-readiness)
13. [Known limitations and roadmap](#13-known-limitations-and-roadmap)
14. [Contributing and support](#14-contributing-and-support)

---

## 1. Overview

TallGate is a single Next.js 16 (App Router) application backed directly by a
Supabase project (Postgres + Auth + Storage). There is no separate backend
service: server components, route handlers, and Postgres functions form the
application tier. Domain logic is centralised under `lib/`, keeping route
handlers thin and moving stateful operations into protected SQL functions.

The platform hosts four distinct surfaces behind one deployment:

- **Public site** — landing and marketing pages, services, startup programme,
  consultation and contact intake, and the public certificate-verification page.
- **Learner area** (`/learn`, `/dashboard`) — course catalogue, lessons, quizzes,
  active recall, progress, and certificates.
- **Administration console** (`/admin`) — operations dashboard, catalogue and
  content management, grading, certificates, payments, users, and enquiries.
- **API layer** (`/api`) — validated, rate-limited intake endpoints and protected
  admin mutations.

## 2. Key features

| Area | What it does |
| --- | --- |
| Public website | Landing and marketing pages, services directory, portfolio, blog/events, startup-hub and consulting pages. |
| Intake pipeline | Contact, consultation, startup application, and enrollment enquiry forms with server-side validation and rate limiting. |
| Authentication | Supabase Auth (email/password, magic links, invites, password recovery) with cross-device email confirmation. |
| Learner dashboard | Enrolled courses, progress, upcoming/recorded live sessions, certificates, profile, and support. |
| Learning Hub | Course catalogue with search/categories, lessons (video/document/text), live sessions, progress tracking, and active recall. |
| Assessments | Quizzes/exams with objective auto-grading, open-response manual grading, tab-switch logging, and Distinction/Merit/Pass grade bands with per-course thresholds. |
| Certificates | Server-rendered PDF (with verification QR) issued automatically on course completion or manually by an admin; public verification by code. |
| Admin console | Operations metrics, enquiry triage, catalogue and course-content management, attempt grading, certificate issue/void, manual payment tracking, user and role management. |
| Audit & security | Admin audit log, structured redacting logger, RLS on every table, CSP and security headers, and per-IP rate limiting. |

## 3. Technology stack and architecture

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 3, `@headlessui/react`, `react-icons` |
| Backend | Supabase — Postgres, Auth, Storage — via `@supabase/ssr` and `@supabase/supabase-js` |
| Certificates | `@react-pdf/renderer` (PDF) and `qrcode` (verification QR) |
| Email | Resend, used only by `POST /api/email` |
| Tests | Vitest |

**Architecture notes**

- Request middleware is `proxy.ts` (Next.js's renamed middleware entry point); it
  refreshes the Supabase session and enforces protected route prefixes.
- The Supabase service-role client (`lib/supabase/admin.ts`) is `server-only` and
  bypasses RLS; callers must verify admin status before use.
- Database-level authorisation is expressed with row-level security and
  `SECURITY DEFINER` SQL functions; the app never trusts client-supplied roles.
- Startup environment validation runs in `instrumentation.ts`; build-time
  configuration warnings are emitted by `next.config.mjs`.

## 4. Repository structure

```
app/                     Next.js App Router
  (landing)/             Public landing + startup/consulting/verify pages
  (marketing)/           About, blog, events, portfolio
  (auth)/                Login, register, password reset, verify-email
  (dashboard)/           Learner dashboard
  (admin)/admin/         Administration console
  auth/callback/         Supabase auth callback route handler
  learn/                 Learning Hub (catalogue, course, lessons, quizzes, recall)
  startups/              Startup programme routes
  api/                   Route handlers (public intake, admin actions, assessments)
components/              UI, grouped by area (admin, auth, certificates, dashboard,
                         learning, layout, navigation, ui, ...)
features/                Feature composition (consultation, learning, payments,
                         services, startups, ...)
lib/                     Domain logic; see the list below
supabase/migrations/     Timestamped SQL migrations (authoritative schema)
types/supabase.ts        Generated database types
tests/unit/              Vitest unit tests
docs/                    Database, security, and audit documentation
proxy.ts                 Request middleware (session refresh + route matcher)
instrumentation.ts       Startup environment validation
```

Key `lib/` domains: `admin`, `analytics`, `api` (rate limiting), `assessments`,
`auth`, `catalogue`, `certificates`, `config`, `dashboard`, `data`, `database`,
`email`, `learning`, `logging`, `payments`, `search`, `security`, `storage`,
`supabase`.

## 5. Prerequisites

- **Node.js 22.12.0 or newer** (`engines.node` in `package.json`; CI pins Node 22).
- **npm** (a `package-lock.json` is committed).
- **A Supabase project** for any database-backed feature.
- **Supabase CLI** (optional but recommended) to apply migrations and inspect
  migration history.

## 6. Local setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/Z-AKB/tallgate.git
   cd tallgate
   npm install
   ```

2. Create your local environment file from the template and fill in the values
   (see [Environment configuration](#7-environment-configuration)):

   ```bash
   cp .env.example .env.local
   ```

   Never commit `.env.local` (it is git-ignored).

3. Apply the database migrations to your Supabase project (see
   [Database and migrations](#8-database-and-migrations)).

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The app runs on Webpack
   (`next dev --webpack`).

## 7. Environment configuration

Variable names and purposes are documented in [`.env.example`](.env.example).
Never commit real values, and never expose server-only keys to the browser.

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public | Canonical site origin. Used for certificate verification links and metadata. Must be a real `https` origin in production. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Browser-safe anon key; access is constrained by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server-only** | Full database access. Used for admin actions, certificate storage, rate limiting, and validated public form writes. |
| `RESEND_API_KEY` | Optional | Server-only | Only read by `POST /api/email`. Without it the route returns `503`. |
| `RESEND_FROM_EMAIL` | Optional | Server-only | Verified sender in `Name <address>` form. No default is assumed. |
| `RATE_LIMIT_TRUSTED_IP_HEADERS` | Optional | Server-only | Comma-separated trusted IP headers (default `x-real-ip,cf-connecting-ip`). Read by `lib/api/rateLimit.ts`. |
| `LOG_LEVEL` | Optional | Server-only | Log verbosity. Read by `lib/logging/logger.ts`. |

`RATE_LIMIT_TRUSTED_IP_HEADERS` and `LOG_LEVEL` are read from the process
environment but are not listed in `.env.example`; set them only if you need to
override the defaults.

## 8. Database and migrations

The schema lives in [`supabase/migrations/`](supabase/migrations) (currently
**29 timestamped migrations**) and generated types are in `types/supabase.ts`.
See [`docs/database/README.md`](docs/database/README.md) for the table overview
and the first-admin SQL.

### Applying migrations safely

Apply migrations through the Supabase CLI so each is recorded in the project's
migration history:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase migration list --linked   # compare local vs remote history
supabase db push --linked          # apply pending migrations
```

Rules:

- Confirm the linked project is the intended environment **before** pushing.
- A migration is **pending** until it appears in the target project's
  `supabase_migrations.schema_migrations` history. The two most recently added
  migrations are `20261012000000_assessments.sql` and
  `20261012010000_grade_bands_and_thresholds.sql`.
- Never paste migration SQL into the SQL Editor and then run `supabase db push`;
  the schema and CLI history would diverge. If migrations were applied manually,
  reconcile the history first.
- Review each migration's contents and dependencies, and have a backup/rollback
  plan, before applying to a shared environment.
- Never commit a database password, access token, or service-role key.

[`docs/security/migration-deployment-plan.md`](docs/security/migration-deployment-plan.md)
is the deployment record. Confirm current parity with
`supabase migration list --linked` rather than relying on any doc snapshot.

### First admin

Migrations do not grant admin privileges automatically. After the first user has
registered and verified their account, insert a row into `public.user_roles`
linking that user to the `admin` role (see `docs/database/README.md` for the SQL).

### Storage buckets

The private `certificates` bucket and the private `course-content` bucket are
created and locked down by the storage migrations. Certificate PDFs are served
through short-lived signed URLs only.

## 9. Available scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run dev` | `next dev --webpack` | Start the development server. |
| `npm run build` | `next build --webpack` | Create a production build. |
| `npm run start` | `next start` | Serve the production build. |
| `npm run lint` | `eslint .` | Run ESLint. |
| `npm run typecheck` | `tsc --noEmit` | Type-check without emitting. |
| `npm run test` | `vitest run` | Run the unit test suite. |

## 10. Testing and quality checks

Unit tests live in [`tests/unit/`](tests/unit) and run with Vitest. They cover
pure and security-sensitive logic, including environment validation, auth
callback and email OTP handling, registration and role rules, rate limiting,
certificate date/PDF/QR/download/verification helpers, assessment grading,
completion and security rules, course-content paths, catalogue seeding, payment
status errors, pagination, redirects, security headers, admin audit logging, and
the redacting logger.

```bash
npm run test        # unit tests
npm run typecheck   # types
npm run lint        # lint
npm run build       # production build
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `lint`,
`typecheck`, `test`, and `build` on Node 22 for pull requests and pushes to
`main`.

> Automated integration and end-to-end suites are **not** present yet: the
> `tests/integration/` and `tests/e2e/` directories contain only placeholders.
> Database policies, route handlers, and the assessment/certificate state
> machines are currently validated by reading source and unit logic, not by
> end-to-end automation.

## 11. Security considerations

- **Authentication:** Supabase Auth for email/password, magic links, invites, and
  password recovery. `app/auth/callback/route.ts` supports both a PKCE `code`
  (same browser) and an email `token_hash` + `type` (cross-device). Registration
  returns a generic error to prevent account enumeration.
- **Authorisation:** every user has exactly one role via `user_roles`
  (`unique(user_id)`), assigned at sign-up from an allow-listed `account_type`
  and changed thereafter only by admins. Server-side guards live in
  `lib/auth/guards.ts` (`requireUser`, `requireAdmin`, `requireAdminApi`).
- **Row-level security:** enabled on every table. Public visitors can submit
  inquiries and verify certificates through protected routes; users read their
  own enrollments, progress, and applications; only admins can read the enquiry
  queue, author content, manage roles, or read `admin_audit_log`.
- **Certificate privacy:** the `certificates` bucket is private and served via
  short-lived signed URLs. Public verification (`GET /api/verify`) calls the
  `verify_certificate` RPC and returns only the certificate number, course title,
  issue date, and valid/revoked state.
- **Rate limiting:** validated public endpoints use a server-side Supabase table
  (`lib/api/rateLimit.ts`): contact 5 / IP / 15 min, consultation 3, startup 3,
  enrollment 5, certificate verification 30, and email 20 / admin / hour. Client
  IPs are read from trusted headers, which the production proxy **must overwrite**
  (not append to). In production a request with no resolvable trusted IP is
  rejected (`503`) rather than sharing a fallback bucket.
- **Headers / CSP:** `next.config.mjs` sets `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and a
  Content-Security-Policy (enforced in production, report-only in development).
- **Logging:** `lib/logging/logger.ts` writes structured logs and redacts
  sensitive context keys (tokens, secrets, credentials, personal fields).
- **Secrets:** server-only values are read from the environment and never sent to
  the browser; `.env.*` files are git-ignored except `.env.example`.

Security fixes, residual risks, and verification status are tracked in
[`docs/security/`](docs/security). Do not treat the project as production-ready
without reviewing those documents.

## 12. Deployment and production readiness

TallGate deploys as a standard Next.js app (for example on Vercel) backed by a
Supabase project.

**Deploy steps**

1. Set the production environment variables (see
   [Environment configuration](#7-environment-configuration)): a real `https`
   `NEXT_PUBLIC_SITE_URL`, the production Supabase URL/anon key, the
   service-role key (server-only), and Resend credentials if email is used.
2. Apply pending migrations to the target Supabase project following
   [Applying migrations safely](#8-database-and-migrations).
3. Configure Supabase Auth for production: set the Site URL and redirect
  -allow-list, and set the email templates to the cross-device callback form
  (`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`; use
  `type=recovery` with `next=/reset-password` for recovery).
4. Ensure the hosting proxy sets and overwrites `x-real-ip` / `cf-connecting-ip`
  so rate limiting works, and terminates TLS.
5. Bootstrap an admin role for the first operator.

**Verification status**

Items that are configured in code versus verified against a live environment must
be distinguished:

- **Verified in the repository:** application code, routes, migrations, unit
  tests, CI workflow, security headers, and RLS/policy definitions.
- **Not verified by this README:** live Supabase Auth settings (Site URL,
  redirect allow-list, password policy, email templates), live storage bucket
  size/MIME restrictions, production runtime secrets, and host-side TLS and
  trusted-IP header behaviour. These are external configuration and must be
  re-checked against the target environment.

Known outstanding items and their verification status are documented in
[`docs/security/`](docs/security), notably
[`release-readiness.md`](docs/security/release-readiness.md) and
[`external-configuration-verification.md`](docs/security/external-configuration-verification.md).

## 13. Known limitations and roadmap

Confirmed from the current codebase and the system audit
([`docs/audit/TALLGATE_SYSTEM_AUDIT.md`](docs/audit/TALLGATE_SYSTEM_AUDIT.md)):

- **Payments are manual.** There is no payment gateway or webhook integration;
  payment is recorded in `payment_requests` and confirmed by an admin, who then
  creates the enrollment. Enrollment enquiries submit a lead, not a paid
  enrollment.
- **Email is not event-driven.** Resend is used only through `POST /api/email`
  (admin-triggered). There is no transactional email on signup, enrollment,
  payment, or certificate issuance.
- **No quiz authoring/import.** Learners can take quizzes and admins can grade
  them, but quizzes/questions must currently be created directly in the database;
  there is no admin UI or upload/import for quizzes, and no quiz seed data.
- **No automated integration/E2E coverage.** Only unit tests exist.
- **Unused schema/tooling.** The `startup_reviews` table has no consumer, and the
  `instructor` role has no dedicated tooling.
- **Observability is minimal.** Structured logs only; no error-tracking, metrics,
  tracing, or health endpoint.
- **Dev-tooling dependency advisories.** `npm audit --omit=dev` reports zero
  vulnerabilities, but a full `npm audit` reports advisories from the
  build tooling chain whose remediation requires a Tailwind v4 major upgrade.
- **External configuration lives outside the repo** (auth settings, storage
  limits, secret rotation) and is not version-controlled.

## 14. Contributing and support

- Create a feature branch from `main`; keep changes scoped and consistent with
  existing conventions.
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`
  before opening a pull request; CI enforces the same checks.
- Include or update unit tests for logic changes.
- Follow the security rules above: never commit secrets or service-role keys, and
  do not edit already-applied migrations.

Documentation:

- [`docs/database/README.md`](docs/database/README.md) — database tables, migration application, first admin
- [`docs/audit/TALLGATE_SYSTEM_AUDIT.md`](docs/audit/TALLGATE_SYSTEM_AUDIT.md) — full system audit and roadmap
- [`docs/security/release-readiness.md`](docs/security/release-readiness.md) — release readiness and blockers
- [`docs/security/external-configuration-verification.md`](docs/security/external-configuration-verification.md) — external configuration status
- [`docs/security/migration-deployment-plan.md`](docs/security/migration-deployment-plan.md) — migration deployment record
- [`docs/security/asvs-5.0.0-assessment.md`](docs/security/asvs-5.0.0-assessment.md) — OWASP ASVS 5.0 assessment
- [`docs/security/session-management.md`](docs/security/session-management.md) — session/auth configuration notes

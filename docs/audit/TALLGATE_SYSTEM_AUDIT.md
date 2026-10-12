# TallGate Platform — Full System Audit

**Audit type:** Audit-first, evidence-based review (no fixes applied)
**Repository:** `C:\Users\Zayne\Documents\tallgate-1`
**Audited revision:** `main` @ `2aaf914` ("feat: shared certificate issuance, course assessments, and admin grading"), 3 commits ahead of `origin/main` (`4c65f64`)
**Audit date:** 2026-10-12
**Prepared by:** opencode audit pass

---

## 0. How To Read This Document

Every claim carries an **evidence tag**:

| Tag | Meaning |
| --- | --- |
| `[SRC]` | Verified by reading application source in this repository. |
| `[TEST]` | Verified by running the project's own checks (typecheck / lint / unit tests / build). |
| `[DOC]` | Taken from documentation checked into the repo. |
| `[LIVE]` | Verified against the live Supabase project. |
| `[UNVERIFIED]` | Could not be verified in this audit (live env, secrets, remote config, visual rendering). |

**Live-environment checks were not possible in this audit** (no service credentials, no Supabase CLI, no network access to the project). All database/auth/storage statements below are therefore `[SRC]` or `[DOC]` unless explicitly tagged `[LIVE]`. Where the source implies a live behaviour that was not observed, it is marked `[UNVERIFIED]`.

No secrets were read or printed. Environment variables are reported only as **CONFIGURED / MISSING / NOT VERIFIED**.

---

## 1. Executive Summary

TallGate is a Next.js 16 (App Router) + Supabase platform combining: a marketing site, an enterprise consultation/intake funnel, a startup incubation funnel, a course "Academy" with video lessons, quizzes/assessments, verifiable PDF certificates, and an internal admin operations console.

**Overall state: strong engineering foundations, production-*capable*, but not yet production-*hardened* for a paying learner base.** The codebase shows a clear security-conscious trajectory — RLS on every table, a server-only service-role boundary, rate limiting, audit logging, CSP/security headers, generic auth errors, and a passing build/typecheck/test suite. The principal gaps are not architectural; they are **operational and coverage**: no automated integration/e2e or RLS tests, a manual-only payment workflow with no reconciliation ledger, one migration (`20261012000000_assessments.sql`) whose live application status is unverified, and unmigrated remote configuration (auth settings, storage limits) that lives outside the repo.

### Headline findings

| # | Severity | Finding |
| --- | --- | --- |
| F1 | **P1** | Migration `20261012000000_assessments.sql` (added by the audited commit) is **not covered** by the 27-migration parity verification dated 2026-10-11. Its live application status is `[UNVERIFIED]`. Schema drift risk against the live database. |
| 2 | P1 | No integration/E2E/RLS tests. 20 test files, all unit-level; `tests/integration` and `tests/e2e` contain only `.gitkeep`. Security guarantees (RLS, storage policies, RPC authorisation) are untested by automation. |
| 3 | P1 | `npm audit` reports 9 advisories (7 high, 2 moderate) from dev/build tooling; mitigation requires a Tailwind v4 major upgrade. Runtime dependency tree is clean (`npm audit --omit=dev` → 0). |
| 4 | P2 | Payments are fully manual (admin-confirmed `payment_requests`); no gateway, no webhook, no reconciliation, no receipts. Revenue operations depend entirely on human process. |
| 5 | P2 | No transactional email automation. `RESEND_*` is present, but email is only sent via an admin-triggered `/api/email` call — no signup, enrollment, payment, or certificate-completion notifications. |
| 6 | P2 | Dead/orphan schema: `startup_reviews` table exists with no admin action, route, or UI consuming it. Unused instructor role/permissions and no instructor tooling. |
| 7 | P2 | Storage has no enforced size/MIME limits in repo-declared config (`supabase/config.toml` contains only `project_id`); limits, if any, live only in the remote dashboard (`[LIVE]` NOT VERIFIED). |
| 8 | P3 | No observability stack (structured logs only) — no error tracking, metrics, tracing, or alerting; no uptime/health endpoint. |
| 9 | P3 | A certificate-storage migration carries an inaccurate comment claiming a sibling migration "is not committed" when it is tracked in git. Informational/doc-drift only. |
| 10 | P3 | Certificate PDF redesign + its unit test are **uncommitted** in the working tree pending visual review. |

**Readiness decision (see §16):** **CONDITIONAL GO** for continued controlled/internal use and for merging the current feature branch; **NO-GO for a public, paid-scale launch** until P0/P1 items are closed.

---

## 2. Scope, Method, and Evidence Basis

**In scope**
- Application architecture, routing, and feature inventory.
- Database schema, migrations, RLS policies, functions, and storage.
- Authentication, authorization, sessions, and the admin console.
- API surface and security controls.
- Learning/assessment/certificate subsystem.
- Payment/enrollment/business flows.
- Testing, observability, scalability, and deployment readiness.

**Out of scope / not performed**
- Penetration testing, fuzzing, or adversarial exploitation (no such claims are made here).
- Live database/auth/storage inspection.
- Load/performance testing.
- Visual/UX review of the certificate PDF (model cannot render)
- Legal/regulatory (NDPR/GDPR) sign-off.

**Method**
1. Git state, working tree, and env-var presence audit.
2. Full file-tree and route inventory.
3. Source reading of `app/`, `lib/`, `components/`, `features/`, `tests/`, `supabase/migrations/`.
4. Execution of the project's own checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit`.
5. Cross-referencing existing security documentation.

**Checks executed against revision `2aaf914`**

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | PASS (clean) `[TEST]` |
| Lint | `npm run lint` | PASS — 0 errors, 21 pre-existing warnings `[TEST]` |
| Unit tests | `npm test` | PASS — 20 files, 153 tests `[TEST]` |
| Build | `npm run build` | PASS — 66/66 static pages generated `[TEST]` |
| Deps (runtime) | `npm audit --omit=dev` | 0 vulnerabilities `[TEST]` |
| Deps (all) | `npm audit` | 9 advisories (7 high, 2 moderate; dev/build tooling) `[TEST]` |
| Live DB/auth/storage | — | NOT PERFORMED `[UNVERIFIED]` |
| Certificate PDF visual | — | NOT PERFORMED (no image rendering) `[UNVERIFIED]` |

---

## 3. System Overview & Architecture

**Shape:** A single Next.js App Router application that acts as both the public website and the authenticated product, backed directly by Supabase (Postgres + Auth + Storage). There is no separate backend service; server components, route handlers, and Postgres functions form the application tier.

**Architecture layers `[SRC]`**

| Layer | Location | Notes |
| --- | --- | --- |
| Route groups | `app/(landing)`, `app/(marketing)`, `app/(auth)`, `app/(dashboard)`, `app/(admin)`, `app/learn` | Marketing/landing are public; `(dashboard)` and `(admin)` are protected; `app/learn` is the learner LMS surface. |
| Route handlers | `app/api/**/route.ts` (14) | Thin handlers delegating to `lib/*`. |
| Domain logic | `lib/*` (19 domains) | `admin, analytics, api, assessments, auth, catalogue, certificates, config, dashboard, data, database, email, learning, logging, payments, search, security, storage, supabase`. |
| UI | `components/*`, `features/*` | Reusable components + feature folders. |
| Data | `supabase/migrations/*` (28) | Schema, RLS, functions, storage policies, seeds. |
| Edge entry | `proxy.ts` | Next 16 proxy (formerly middleware) → `lib/supabase/middleware.ts`. |
| Env guard | `instrumentation.ts` | Asserts critical env at server start. |

**Notable framework detail:** This Next.js version uses `proxy.ts` exporting a `proxy()` function and a `config.matcher` rather than the historical `middleware.ts`/`middleware()` convention `[SRC]` (`proxy.ts:4`). Any tutorial-era assumption about `middleware.ts` is wrong for this repo.

**Architecture strengths**
- Clear separation of public route groups vs protected groups.
- Domain logic centralized in `lib/`, keeping route handlers thin.
- Database does the heavy lifting (RPCs for state machines), reducing client trust.
- `lib/database/server.ts` is a deliberate re-export shim of `lib/supabase/server` `[SRC]`.

**Architecture risks**
- Domain `lib/*` surface is wide (19 folders) with no enforced module boundaries; drift toward duplication is possible over time.
- Direct Postgres coupling from server components means RLS correctness is load-bearing for confidentiality (see §7).

---

## 4. Repository & Toolchain Inventory

**Stack `[SRC]` — `package.json`**

| Concern | Choice | Version |
| --- | --- | --- |
| Framework | Next.js (App Router) | 16.3.8 |
| UI | React | 19.3.0 |
| Language | TypeScript | ^5 |
| Supabase | `@supabase/ssr` ^0.12.5, `@supabase/supabase-js` ^2.112.4 | |
| PDF | `@react-pdf/renderer` | ^4.9.0 |
| QR | `qrcode` | ^1.5.4 |
| UI kit | `@headlessui/react` 2.2.10, Tailwind 3.4.1 | |
| Test | `vitest` ^5.0.3 | |
| Lint | `eslint` 9.39.5 | |
| Node | `>=22.12.0` | |

**Scripts `[SRC]`:** `dev`, `build` (`next build --webpack`), `start`, `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`).

**Repository hygiene `[SRC]`**
- `.env*` files are gitignored; only `.env.example` is tracked → no secrets in the repo. Good.
- `.next/`, `node_modules/`, `tsconfig.tsbuildinfo` present locally; treated as build artifacts.
- Two ad-hoc PowerShell scripts in `scripts/` (`add_about_vmv.ps1`, `fix_about.ps1`) — one-off content tooling, harmless but worth cleaning.
- `CLAUDE.md` and `AGENTS.md` present as agent guidance.

**Dependency risk `[TEST]`**
- Runtime deps: clean.
- Full tree: 9 advisories via `postcss`/Tailwind 3 build chain. The fix path (`tailwindcss@4`) is a **breaking major upgrade** and should be scheduled, not rushed. No runtime exposure.

---

## 4a. Route & Surface Inventory `[SRC]`

**API route handlers (14):**
`/api/admin/actions`, `/api/admin/certificates/[id]/download`, `/api/assessments/attempts/{start,save,submit,tab-switch,[id]/review}`, `/api/certificates/[id]/download`, `/api/consultations`, `/api/contact`, `/api/email`, `/api/enrollments`, `/api/startups`, `/api/verify`.

**Page routes (54)** across: `(landing)` (home, contact, consultation, learning-hub, startup-hub/apply, verify, services, etc.), `(marketing)` (about, blog, events), `(auth)` (login/register/forgot/reset/verify-email), `(dashboard)` (dashboard, courses, certificates, profile, services, settings), `(admin)` (overview, certificates, course-content, courses, enrollments, grading, inquiries, messages, payments, settings, startups, users, verify), `app/learn` (catalogue, course, lesson, quizzes, recall), and top-level `startups`, `startups/apply`.

**Public inbound mutations:** `/api/consultations`, `/api/contact`, `/api/startups`, `/api/enrollments` (lead capture), plus assessment attempt endpoints for authenticated learners.

---

## 4b. Feature Inventory (Implemented vs Missing)

| Area | Status | Evidence |
| --- | --- | --- |
| Marketing/landing pages | Implemented (static data via `lib/data`, 12 imports) | `[SRC]` |
| Consultation intake + admin triage | Implemented | `[SRC]` |
| Startup Hub application + admin review | Implemented (application + status actions). **Review table `startup_reviews` unused.** | `[SRC]` |
| Contact messages + admin inbox | Implemented | `[SRC]` |
| Course catalogue w/ search & filters | Implemented (`CourseSearch.tsx`, catalogue components) | `[SRC]` |
| Enrollments (manual, admin-created) | Implemented | `[SRC]` |
| Lesson content + progress tracking | Implemented (`lesson_content`, `lesson_progress`) | `[SRC]` |
| Live sessions + recordings | Implemented (`live_sessions`, recording validated by trigger) | `[SRC]` |
| Quizzes / assessments / grading | Implemented | `[SRC]` |
| Recall (spaced-repetition style) tool | Implemented (`recall_progress`) | `[SRC]` |
| Certificates + public verification | Implemented (PDF, QR, verify RPC/route/page) | `[SRC]` |
| Admin console + audit log | Implemented | `[SRC]` |
| Payments | **Manual confirmation only — no gateway/webhook/receipt** | `[SRC]` |
| Transactional email | **Partial — admin-triggered only, no event automation** | `[SRC]` |
| Instructor tooling | **Missing** (role exists; no routes/UI) | `[SRC]` |
| Discussions / announcements | **Missing** | `[SRC]` |
| Search (global) | Partial (`lib/search`, `CourseSearch`) | `[SRC]` |
| Analytics | Partial (`lib/analytics`); no external product analytics | `[SRC]` |
| Account deletion / data export | **Missing** | `[SRC]` |
| Health / readiness endpoint | **Missing** | `[SRC]` |

---

## 5. Database Schema & Migrations

**Migration chain:** 28 SQL migrations, chronologically consistent (`[SRC]`). Highlights:

- `20260828000000_phase3_schema.sql` — core schema + `is_admin()`, `handle_new_user()`, seeded roles.
- Certificate chain — `certificate_registry`, `certificate_storage_path`, storage buckets/grants, demo seed, storage policies, `verify_certificate` RPC.
- Hardening chain — `public_api_hardening`, `rate_limit_and_enrollment_hardening`, `enforce_single_role_per_user`, admin catalogue writes, `policy_and_grant_hygiene`, `tighten_course_content_uuid_guards`, `admin_read_draft_lessons`.
- Business flows — `payment_requests`, `payment_confirmation_enrollment`, `course_documents_and_live_sessions`.
- Governance — `admin_audit_log`, `admin_audit_log_retention`.
- Assessments — `20261012000000_assessments.sql` (added at HEAD).

**Key facts `[SRC]`**
- `certificate_number` default `TG/DH/%05d/YY` from sequence `certificate_number_seq` (starts 1021), unique.
- `verification_code` generated by the issuer as `TG-<year>-<24 uppercase hex>`; `verify_certificate` is an exact-code `SECURITY DEFINER` RPC.
- `recompute_course_completion` is service-role only; certificate auto-issue flows completion → recompute → issue.
- Buckets: `certificates` (private), `course-content` (private).
- Demo seed `20261004000000_demo_certificate_seed.sql` inserts 3 `[DEMO]` rows (`TG-DEMO-VALID01/02`, `TG-DEMO-REVOKED1`) to exercise verify states. **These are live seed rows — verify they are acceptable in the target environment `[UNVERIFIED]`.**

**Migration drift risk (HIGH) `[DOC][UNVERIFIED]`**
- `docs/security/migration-deployment-plan.md` states 27 migrations were applied/verified in sync as of **2026-10-11**.
- HEAD adds `20261012000000_assessments.sql`, bringing the repo to 28.
- Therefore the application status of the assessments migration against the remote project is **NOT VERIFIED**. If the remote is behind, assessment features will fail at runtime; if the local history diverges, ordering conflicts are possible.

**Schema hygiene findings `[SRC]`**
- `startup_reviews` — orphan table (no consumer).
- `supabase/config.toml` contains only `project_id = "tallgate"` → no declared storage size/MIME, auth, or email settings in-repo.
- Informational: a comment in `20261005000000_certificate_storage_policies.sql` claims `20261002000000_certificate_storage_path.sql` "is not committed", but `git ls-files` confirms it **is** tracked. Stale comment only.

---

## 6. Row Level Security (RLS) Analysis

RLS is enabled broadly and policies are role- and ownership-aware `[SRC]`. Representative policies (`20260828000000_phase3_schema.sql`):

- `profiles`: view own **or** admin; update own only.
- `roles`: readable by authenticated; `user_roles`: own **or** admin.
- `services`: public read when active; admin write.
- `consultation_requests`: public insert; **select** = own **or** admin; update = admin.
- `service_inquiries`, `contact_messages`, `startup_applications`: public insert; admin manage.
- `courses`: public read if `is_published` or admin.
- `lessons`: preview, admin, or enrolled-only.
- `course_enrollments`: select own **or** admin; insert own.
- `certificates`: public verify (later narrowed — see below); admin manage.

**Hardening applied by later migrations `[SRC]`**
- Public table inserts were **dropped** in `20261007000000_rate_limit_and_enrollment_hardening.sql`; public intake now flows through **service-role route handlers** that enforce rate limits (`consume_public_rate_limit`), rather than direct anon inserts.
- Public certificate `SELECT` was removed in favour of the `verify_certificate` RPC (exact-code lookup), preventing bulk enumeration of the certificate registry — a good privacy decision.
- `policy_and_grant_hygiene` and `tighten_course_content_uuid_guards` reduce over-broad grants and malformed-UUID probing.

**Assessment of RLS posture:** well-designed and conservatively written. **However, RLS behaviour is not covered by any automated test** — this is the single largest correctness risk (a policy regression would be silent). See §13.

---

## 7. Authentication, Authorization & Session Management

`[SRC]`
- Supabase Auth via `@supabase/ssr`; session refreshed in `lib/supabase/middleware.ts`, invoked from `proxy.ts`.
- Protected prefixes: `["/dashboard","/admin","/learn","/api/admin"]`.
- Admin gate: `requireAdminApi()` used by `/api/admin/actions` (`app/api/admin/actions/route.ts:4,175`) and admin pages; `is_admin()` in DB backs RLS.
- Signup: `handle_new_user` trigger creates a profile and assigns default `learner` role; `20261007200000_signup_role_mapping.sql` maps intended signup roles. `enforce_single_role_per_user` guarantees one role per user.
- Registration errors are deliberately generic in `lib/auth/registration.ts` to prevent account enumeration.
- `lib/auth/redirect.ts` sanitises `next` paths to prevent open redirects.
- `docs/security/session-management.md` exists documenting session policy. `[DOC]`

**Gaps**
- No MFA/2FA for admin accounts `[SRC]` (not present).
- Live Supabase Auth settings (email confirmation, password policy, JWT expiry, redirect allow-list) are **not in repo** → `[UNVERIFIED]`. Supabase defaults may be too permissive for production admin accounts.
- No account lockout beyond IP rate limiting.

---

## 8. Application Security Review

**Controls present `[SRC]`**
- `next.config.mjs`: CSP (report-only in dev, enforced in prod), HSTS, `X-Content-Type-Options: nosniff`, frame deny, Referrer-Policy, Permissions-Policy.
- `lib/api/request.ts`: content-type validation and request-body size limits.
- `lib/api/rateLimit.ts`: fail-closed, IP-based HMAC buckets; trusted-proxy header handling via `RATE_LIMIT_TRUSTED_IP_HEADERS`.
- `lib/logging/logger.ts`: redacts sensitive keys (no token/password/secret leakage to logs).
- `lib/admin/auditLog.ts`: best-effort admin audit trail (`admin_audit_log` + retention).
- `instrumentation.ts`: asserts critical env vars only in the production server runtime.
- Public endpoints are rate-limited (e.g., `/api/verify` 30/900s; intake endpoints similarly).
- Verify-code input validated against `^[A-Z0-9-]{4,64}$`.
- Certificate PDF issuer validates that `NEXT_PUBLIC_SITE_URL` is a public HTTPS origin (rejects localhost/`.local`/non-HTTPS) so QR links are never generated for non-public hosts.

**Risks / not verified**
- CSP uses `unsafe-inline` where required by Next/Tailwind; report-only in dev means dev-only violations go unnoticed. Prod enforcement is correct `[SRC]`.
- Rate limiting depends on correct trusted-proxy configuration; a misconfigured `RATE_LIMIT_TRUSTED_IP_HEADERS` could allow IP spoofing of the limiter key `[UNVERIFIED]`.
- No WAF/bot protection in front of public intake; spam resistance relies on rate limits only.
- Secret rotation policy undocumented `[DOC gap]`.
- All live security headers observed? Not checked `[UNVERIFIED]`.

No vulnerabilities were deliberately exploited; this is a control review, not a penetration test.

---

## 9. Learning, Assessment & Certificate Subsystem

`[SRC]`
- Assessments: `start_quiz_attempt`, `save_attempt_answer`, `submit_quiz_attempt`, `log_attempt_tab_switch`, `get_attempt_review`, `grade_attempt_answer`, `recompute_course_completion` (service-role).
- Tab-switch logging enables integrity signals during quizzes.
- Completion path: lesson completion → `recompute_course_completion` → `issueCourseCertificate`.
- Certificate issuance: server-side with service role; PDF rendered by `@react-pdf/renderer`; QR encodes `{SITE_URL}/verify?code=<verification_code>` (320px, EC-M, error-correcting).
- Public verify: `/verify` page auto-fills `?code=` → `/api/verify` → `verify_certificate` RPC → VALID / REVOKED / NOT_FOUND.
- Downloads: `/api/certificates/[id]/download` (learner) and `/api/admin/certificates/[id]/download` (admin), served from private `certificates` bucket.

**Certificate redesign (uncommitted at audit time) `[SRC]`**
- Landscape A4; navy `#061A4F`/`#040F35` + gold `#C9A24B`; gold frame + navy hairline; L-bar corner graphics; header with logo + `TallGate Limited` + `RC 9365381 · Registered in Nigeria` and certificate number; uppercase title with letter-spacing; recipient in italic; navy/gold issue-date pill; footer with coordinator/director lines and a centred verify QR.
- Schema-neutral: no migration required.
- Added `tests/unit/certificate-pdf.test.ts` asserting `%PDF-` header, size, `MediaBox`.
- **Uncommitted** in the working tree pending your visual review. `[SRC]`

**Risks**
- No automated test for the assessment RPC state machine or completion→issuance path `[SRC]`.
- Certificate PDF was not visually rendered in this audit → layout regressions possible `[UNVERIFIED]`.

---

## 10. Payments, Enrollment & Business Flows

`[SRC]`
- **No payment gateway.** Enrollment intake writes a **lead to `service_inquiries`** (not `course_enrollments`).
- Payments are tracked in `payment_requests`; `update_payment_request_status` RPC is admin-only and enforces a state machine (pending → confirmed/declined; confirmed → refunded; declined → confirmed). `20261010000000_payment_confirmation_enrollment.sql` ties confirmation to enrollment creation.
- An admin must manually create the user, insert the enrollment, and issue the certificate.
- No webhook routes exist (`[SRC]`, confirmed by search).

**Implications**
- Revenue ops are entirely manual and un-audited beyond the audit log; no receipts, no reconciliation with a payment provider, no automated receipting.
- The state machine reduces malformed transitions but does not integrate refunds or settlement with any provider.

---

## 11. Testing Strategy & Coverage

`[SRC][TEST]`
- 20 unit test files in `tests/unit/*.test.ts`; `tests/integration/` and `tests/e2e/` contain only `.gitkeep`.
- Helper: `tests/helpers/server-only.ts`.
- Current suite: **153 tests passing** `[TEST]`.

**Coverage gaps (material)**
- No RLS/policy tests (highest risk).
- No route-handler integration tests (admin actions, verify, intake).
- No DB/function tests (state machines, completion, issuance).
- No storage policy tests.
- No E2E user-journey tests (register → enroll → learn → assess → certify → verify).

---

## 11b. Observability, Error Handling & Logging

`[SRC]`
- Structured logging via `lib/logging/logger.ts` with redaction.
- Best-effort error capture in server paths; admin overview surfaces partial-load warnings to the UI.
- `admin_audit_log` + retention job for governance.

**Gaps** `[UNVERIFIED]`
- No error-tracking/APM integration (e.g., Sentry), no metrics/tracing, no alerting.
- No request correlation IDs surfaced end-to-end.
- No health/readiness/monitoring endpoint.
- Log destination/retention in production is environment-defined and not in repo.

---

## 12. Scalability, Performance & Reliability

`[SRC]`
- Server-first rendering; static generation for marketing pages (66/66 static in build).
- Admin list queries capped by `ADMIN_QUERY_LIMIT`, with explicit "figures may be understated" disclosures on truncation — honest UX but a scaling ceiling for large data.
- DB work is pushed into Postgres (RPCs, RLS), which scales well with proper indexes.

**Watch items**
- `ADMIN_QUERY_LIMIT` means the admin overview is not authoritative at scale; pagination/aggregation should replace "select * limit N".
- Admin overview issues 6 parallel full-row selects + nested joins (`profiles`, `courses`) — fine at small scale, heavier under load.
- Course/lesson queries fetch and assemble in application code (see `getPortalOverview`), which will need pagination/index review as catalogues grow.
- No caching layer (no Redis/CDN strategy documented); Next's caching is the only tier.
- No documented backup/restore or RPO/RPO targets in repo.

---

## 13. Deployment, Configuration & Operations Readiness

`[SRC]` / `[DOC]`
- Env vars present in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` → **CONFIGURED** locally.
- Code additionally reads `RATE_LIMIT_TRUSTED_IP_HEADERS`, `LOG_LEVEL` (not in `.env.local`) → **MISSING locally / NOT VERIFIED in prod**.
- `.env.example` is the only tracked env file.
- Docs: `asvs-5.0.0-assessment.md`, `external-configuration-verification.md`, `migration-deployment-plan.md`, `release-readiness.md`, `session-management.md`, `docs/database/README.md`.
- `docs/security/release-readiness.md` references `main` @ `4c65f64`, which is now stale vs HEAD `2aaf914`.

**Environment ambiguity (IMPORTANT) `[DOC][UNVERIFIED]`**
- Docs name remote project ref `zlmbitphlzokjmfwldcb` (`tallgate`).
- Whether the configured environment is dev/staging/production was **not established** and must not be assumed. Treat as **potentially production** until confirmed.

**Deployment gaps**
- No CI evidence of running full guard suite on PRs (`.github` exists — contents not exhaustively reviewed in this pass; verify workflows `[UNVERIFIED]`).
- No blue/green or rollback procedure documented.
- Migration application process is manual per `migration-deployment-plan.md`.

---

## 13b. Cross-Cutting Code-Quality Notes

- 21 lint warnings are pre-existing and non-blocking; triage recommended.
- `app/api/admin/actions/route.ts` is ~1304 lines handling 15 actions — a single large handler. Works, but a maintainability/testing risk (hard to unit test individual actions).
- Mock data path (`lib/data/adminMockData.ts`) is correctly gated to `NODE_ENV === "development"` **and** unconfigured Supabase only (`app/(admin)/admin/page.tsx:45`), with authoritative empty results once Supabase answers. Correct defensive design. `[SRC]`
- `lib/database/server.ts` is a thin re-export shim; verify it isn't masking intent drift over time.

---

## 14. Prioritised Roadmap (P0–P3)

**P0 — must close before any paid/public launch**
1. **Resolve migration drift:** confirm `20261012000000_assessments.sql` is applied on the target DB; reconcile the 27→28 count; make the migration plan current and add a check.
2. **Establish environment truth:** confirm which Supabase project/ref the running app targets (dev vs prod) and document it; lock down admin auth settings (email confirmation, password policy, redirect allow-list) in the remote project.
3. **Verify remote storage config:** enforce bucket size + MIME restrictions for `certificates` and `course-content` in the remote dashboard (in-repo `config.toml` declares none).

**P1 — high priority**
4. Add integration/RLS test coverage for: certificate verification RPC, assessment state machine, completion→issuance, and every public intake route.
5. Add a minimal E2E smoke test (login → learn → assess → certify → verify).
6. Plan the Tailwind v4 upgrade to clear the 9 dev-tooling advisories.
7. Confirm no unintended `[DEMO]` certificate rows exist in any non-dev environment.

**P2 — medium**
8. Decide and implement transactional email automation (signup, enrollment, payment, certificate issue).
9. Payment operations: either integrate a gateway (with webhooks + idempotency) or formalise the manual process (receipts, reconciliation report, audit).
10. Remove or implement `startup_reviews`; remove dead code/scripts.
11. Add observability: error tracking, health endpoint, alerting, request correlation IDs.
12. Document secret-rotation and incident-response procedures.

**P3 — low / housekeeping**
13. Split `app/api/admin/actions/route.ts` into per-action modules.
14. Fix the stale migration comment; refresh security docs so they reference HEAD.
15. Triage the 21 lint warnings; add account deletion / data-export endpoints for privacy compliance.

---

## 15. Evidence Limitations (Reported Honestly)

- **No live-environment checks.** No DB, Auth, Storage, or header inspection was possible → all remote configuration is `[UNVERIFIED]`.
- **No visual verification** of the redesigned certificate PDF (no image rendering capability). Layout/spec compliance is `[UNVERIFIED]`.
- **No penetration testing** was performed; §8 is a control review only.
- **No load testing**; §12 is a static scalability assessment.
- **No CI workflow review** beyond confirming `.github` exists.
- Rate-limit proxy-header behaviour and CSP runtime behaviour were not observed live.

---

## 16. Terminal Summary

**Verdict: CONDITIONAL GO.**
The platform is architecturally sound and security-conscious, with clean types, passing tests, a clean runtime dependency tree, and modern hardening already in place. It is safe to continue controlled/internal use and to merge the current feature branch **after** the P0 items are actioned. It is **not ready for a public, paid-scale launch** until migration drift, environment truth, remote storage/auth settings, and automated RLS/integration coverage are closed.

**One-line status:** *Good bones, unproven perimeter* — the risks are operational and test-coverage gaps, not design flaws.

**Blocking questions for the owner**
1. Which Supabase project (ref) does the deployed app actually point at — dev, staging, or production?
2. Has `20261012000000_assessments.sql` been applied to that project?
3. Are the `[DEMO]` certificate rows acceptable in that project?
4. What are the current remote Auth settings (email confirmation, password policy, JWT expiry, redirect allow-list) and storage bucket limits?

**Do not assume any of the above — confirm before launch.**

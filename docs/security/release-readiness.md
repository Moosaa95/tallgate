# Release Readiness — TallGate

- **Scope:** Go/no-go summary based on the ASVS 5.0.0 assessment (`docs/security/asvs-5.0.0-assessment.md`) and the external-configuration verification (`docs/security/external-configuration-verification.md`).
- **Repository state referenced:** `main` @ `4c65f64` (Batch 10 — structured logging adopted; CSP/session residuals documented). See `git log`.
- **Nature of this document:** an in-repo review with **limited read-only live checks** (2026-10-11). It is **not** a penetration test and does not certify a deployed instance.

## Automated gates (re-run 2026-10-11)

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit tests | `npm run test` | PASS — 133 passing / 18 files |
| Types | `npm run typecheck` | PASS (clean) |
| Lint | `npm run lint` | PASS — 0 errors, 19 warnings (pre-existing) |
| Production build | `npm run build` | PASS |
| Runtime dependency audit | `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| Full dependency audit | `npm audit` | 9 advisories (2 moderate, 7 high) — dev/build tooling only |

CI (`.github/workflows/ci.yml`) runs the build/test/lint/typecheck gates on Node 22.

## Area review

| Area | Status | Evidence | Release impact |
| ---- | ------ | -------- | -------------- |
| Input validation / request hardening | PASS | F-02, F-08 | — |
| Registration enumeration | PASS | F-03, `tests/unit/registration.test.ts` | — |
| Password policy (≥8/≤128) | PASS | F-04 | — |
| Auth callback (email `token_hash` + PKCE) & safe redirects | PASS | F-11, `tests/unit/auth-callback.test.ts` | — |
| Rate limiting (fail-closed) | PASS | F-09, `tests/unit/rate-limit.test.ts` | Needs X-08 (proxy headers) |
| Security headers | PASS | F-06, `tests/unit/security-headers.test.ts` | — |
| CSP | PARTIAL | F-07 | `'unsafe-inline'` scripts remain; nonce CSP and `experimental.sri` both verified insufficient for statically rendered pages (inline flight scripts) |
| Startup secret validation | PASS | F-29, `instrumentation.ts`, `tests/unit/env.test.ts` | — |
| Session cookie / lifetime (documented) | PARTIAL | F-13, F-14, `docs/security/session-management.md` | `httpOnly` false (accepted); hosted values now recorded (1h JWT, refresh rotation, no idle/time-box) |
| Authorization / RLS | PASS | F-15 + live checks (X-06) | Deployed migration gap (below) |
| Admin audit log | PASS | F-27 | Retention routine + structured audit logging in place; app-wide structured logger adopted; migrations **applied and verified** in the deployment (X-11) |
| Payment → enrollment | PASS | F-24, `20261010000000_payment_confirmation_enrollment.sql` | Migration applied (X-11) |
| Public catalogue from Supabase | PASS | `lib/catalogue/*` | Public read verified live (X-06) |
| External config (auth, TLS, secrets) | FAIL | X-01, X-05, X-07, X-08, X-09 | Linked-project auth is dev-configured: `site_url=localhost`, empty allow-list, default email templates (X-01/X-05 `FAIL`); app-origin TLS, edge proxy headers and hosting runtime secrets unverified |
| Deployed schema vs `main` | PASS | X-11 | Five pending migrations applied via `supabase db push --linked`; ledger in sync; RLS/policy/grants/retention function verified |
| Email verification | PARTIAL | F-31 | Live `mailer_autoconfirm: true` — emails not verified |

## Critical / high-priority blockers

1. **X-11 deployed schema parity — RESOLVED.** Five pending migrations applied and verified (audit table + retention routine, `course-content` storage/lessons policies, payment RPC); the remote ledger is back in sync. Evidence: `docs/security/migration-deployment-plan.md`.
2. **X-01 Supabase redirect allow-list `FAIL` (HIGH).** The (production) project has `site_url = http://localhost:3000`, `uri_allow_list = ""`. Email-link `redirect_to` resolves to localhost in any deployed origin. Fix: set the Site URL and allow-list to the production origin (authorization required).
3. **X-05 email templates `FAIL` (HIGH).** Templates use `{{ .ConfirmationURL }}`, not the app's `token_hash`/`type` cross-device pattern; combined with X-01, links break off-device. F-31 (`mailer_autoconfirm: true`) means confirmation emails are not sent at all today.
4. **X-09 production secrets `PARTIAL` (HIGH).** Supabase-managed project secrets are present, but the app's hosting runtime (`RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`) was not inspected.
5. **X-08 edge proxy header override `NOT VERIFIED` (MEDIUM).** Without it, rate-limit IPs are spoofable; the Supabase config reports `security_sb_forwarded_for_enabled = false`.
6. **X-07 app-host TLS `NOT VERIFIED` (MEDIUM).** No deployed app origin (site URL is `localhost`); the Supabase dependency negotiates TLS 1.3.
7. **F-07 / F-13 residuals (LOW–MEDIUM).** CSP `'unsafe-inline'` scripts remain — both nonce CSP and `experimental.sri` were runtime-verified insufficient for statically rendered pages (upstream vercel/next.js#95353 / #95354). Session cookie `httpOnly` is false (accepted/documented). Hosted session values are now known (1h JWT, refresh rotation on, **no** inactivity/absolute timeout) and should be recorded in `docs/security/session-management.md` (F-13/F-14).

## Pre-release checklist

1. ~~Apply the pending migrations~~ — **done** (X-11 `PASS`); re-verify per `docs/security/migration-deployment-plan.md`.
2. Set the Supabase **Site URL** and **Redirect URLs** to the production origin and fix the email templates (X-01/X-05) — authorization required.
3. Provide the app's hosting runtime secrets and confirm presence (`RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`) (X-09).
4. Confirm X-08 (edge overwrites trusted client-IP headers).
5. Run a TLS scan against the production origin (X-07).
6. Record the hosted session lifetime/refresh values in `docs/security/session-management.md` (F-13/F-14; values retrieved 2026-10-11).
7. Schedule the strict CSP work (F-07) only if the app moves to full dynamic rendering + nonces — hash-based SRI is **not** a viable path today (upstream vercel/next.js#95353/#95354).

## Recommendation

**NOT READY** for production.

- The **deployed schema gap is fixed** (X-11 `PASS`): all pending migrations applied and verified, and the in-repo controls/tests pass.
- Go-live is still blocked by **confirmed misconfiguration of the linked project's auth settings** — X-01 (Site URL `localhost`, empty allow-list) and X-05 (default email templates) — and by **`NOT VERIFIED` external controls** (X-09 production runtime secrets; X-07 app-origin TLS; X-08 edge proxy headers).
- **Environment (confirmed 2026-10-11):** the account holds **one** Supabase project (`zlmbitphlzokjmfwldcb`) which serves **both development and production** (no separate production project) — see `docs/security/external-configuration-verification.md` → "Project environment". It is therefore the production database, so its development-default Auth config (X-01/X-05) and unverified hosting runtime (X-09) are pre-launch blockers. No production setting was changed; changes require explicit authorization.
- Fixing X-01/X-05/X-09 (then X-07/X-08) would move the assessment to a credible **READY FOR STAGING** / **READY FOR PRODUCTION REVIEW** state.

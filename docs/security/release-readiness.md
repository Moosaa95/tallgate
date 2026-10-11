# Release Readiness — TallGate

- **Scope:** Go/no-go summary based on the ASVS 5.0.0 assessment (`docs/security/asvs-5.0.0-assessment.md`) and the external-configuration verification (`docs/security/external-configuration-verification.md`).
- **Repository state referenced:** `main` through the Batch 8 documentation commits (`aafaca6`..`eaa5243`, see `git log`). Working tree clean, 17 commits ahead of `origin/main` before this batch.
- **Nature of this document:** an in-repo review with **limited read-only live checks** (2026-10-11). It is **not** a penetration test and does not certify a deployed instance.

## Automated gates (re-run 2026-10-11)

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit tests | `npm run test` | PASS — 118 passing / 16 files |
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
| CSP | PARTIAL | F-07 | `'unsafe-inline'` scripts remain (no nonce) |
| Authorization / RLS | PASS | F-15 + live checks (X-06) | Deployed migration gap (below) |
| Admin audit log | PARTIAL | F-27 | Migration not applied in the deployment; no retention/structured logging |
| Payment → enrollment | PASS | F-24, `20261010000000_payment_confirmation_enrollment.sql` | Apply migration on deploy |
| Public catalogue from Supabase | PASS | `lib/catalogue/*` | Public read verified live (X-06) |
| External config (auth, TLS, secrets) | PARTIAL | X-01..X-11 | Several items `NOT VERIFIED` |
| Deployed schema vs `main` | FAIL | X-11 | Deployment is one migration behind |
| Email verification | PARTIAL | F-31 | Live `mailer_autoconfirm: true` — emails not verified |

## Critical / high-priority blockers

1. **Deployed schema is behind `main` (HIGH, X-11 `FAIL`).** `public.admin_audit_log` is absent in the linked project (`404 PGRST205` for both the publishable and secret keys); `20261011000000_admin_audit_log.sql` is not applied. The audit feature silently records nothing there. Safe apply/verify plan: `docs/security/migration-deployment-plan.md`.
2. **X-01 redirect allow-list `NOT VERIFIED` (HIGH).** Dashboard-only; governs email-link `redirect_to`.
3. **X-09 production secrets `NOT VERIFIED` (HIGH).** Local `.env.local` is fully configured, but the production/CI runtime was not inspected.
4. **X-05 email templates `NOT VERIFIED` + F-31 (MEDIUM).** Cross-device template unconfirmed; live project auto-confirms emails.
5. **X-08 proxy header override `NOT VERIFIED` (MEDIUM).** Without it, rate-limit IPs are spoofable.
6. **X-07 app-host TLS `NOT VERIFIED` (MEDIUM).** The Supabase dependency is TLS 1.3; the app's own origin is unknown (site URL is `localhost`).
7. **F-07 / F-27 residuals (LOW–MEDIUM).** CSP `'unsafe-inline'` scripts; no structured logging or audit retention.

## Pre-release checklist

1. Apply `20261011000000_admin_audit_log.sql` per `docs/security/migration-deployment-plan.md` and verify admins-only SELECT plus effective RLS after the change.
2. Verify X-01 (redirect allow-list), X-05 (email templates) and X-09 (production secrets) with evidence.
3. Confirm X-08 (edge overwrites trusted client-IP headers).
4. Run a TLS scan against the production origin (X-07).
5. Decide/document email verification (F-31) and session lifetime/`httpOnly` (F-13/F-14).
6. Schedule nonce-based CSP (F-07) and audit-log retention (F-27).

## Recommendation

**NOT READY** for production.

- Automated checks and the in-repo controls pass, and live read-only checks confirmed working RLS and disabled OAuth providers.
- Production go-live is blocked by the **deployed migration gap (X-11 `FAIL`)** and by **`NOT VERIFIED` required external controls (X-01, X-09; plus X-05/X-07/X-08)**. Per policy, production deployment must not be recommended while required external controls remain unverified.
- Applying the pending migration and completing X-01/X-09 (then X-05/X-07/X-08) would move the assessment to a credible **READY FOR STAGING** / **PRODUCTION REVIEW** state.

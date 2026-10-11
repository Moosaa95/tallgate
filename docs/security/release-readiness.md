# Release Readiness — TallGate

- **Scope:** Go/no-go summary for a production release based on the ASVS 5.0.0 assessment (`docs/security/asvs-5.0.0-assessment.md`) and the external-configuration checklist (`docs/security/external-configuration-verification.md`).
- **Repository state referenced:** commits `dbf8765`..`c3a92fe` on `main` (see the ASVS [remediation log](asvs-5.0.0-assessment.md#remediation-log)).
- **Nature of this document:** an in-repo, code-level readiness review. It is **not** a penetration test, and it does not certify a deployed instance.

## Automated gates

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit tests | `npm run test` | PASS — 118 passing / 16 files |
| Types | `npm run typecheck` | PASS (clean) |
| Lint | `npm run lint` | PASS (0 errors; pre-existing warnings) |
| Production build | `npm run build` | PASS |
| Runtime dependency audit | `npm audit --omit=dev` | PASS — 0 vulnerabilities |
- **CI (`.github/workflows/ci.yml`)** runs all of the above on Node 22.

## Security posture (in-repo controls)

| Area | Status | Note |
| ---- | ------ | ---- |
| AuthZ (proxy gating, guards, RLS, single-role-per-user) | PASS | F-15 |
| Auth flows (PKCE + cross-device `verifyOtp`), safe redirects | PASS | F-11 |
| Rate limiting, fail-closed in production | PASS | F-09 |
| Registration account enumeration | PASS | F-03 |
| Password policy (≥8) | PASS | F-04 |
| Security headers | PASS | F-06 |
| CSP enforced in production | PARTIAL | F-07 — `'unsafe-inline'` scripts remain until a nonce is threaded |
| Admin audit log | PARTIAL | F-27 — table + writes in place; retention/structured logging outstanding |
| Session cookie `httpOnly=false` | PARTIAL | F-13 — accepted Supabase SSR default, impact reduced by enforced CSP |

## Release blockers

1. **External configuration is unverified.** Every item in `docs/security/external-configuration-verification.md` is `NOT VERIFIED` because no live Supabase project, database, or hosting dashboard was available. At minimum, **X-01 (redirect allow-list)**, **X-05 (email templates)**, **X-06 (RLS/policies applied)** and **X-09 (production secrets)** must be confirmed before go-live.
2. **F-07 residual:** CSP still permits `'unsafe-inline'` scripts. Acceptable short-term given enforced `default-src`/`object-src`/`frame-ancestors`, but should be closed with nonces.
3. **F-27 residual:** no structured logging or audit-log retention policy.

## Recommended pre-release checklist

- [ ] Complete every `NOT VERIFIED` item in `docs/security/external-configuration-verification.md`, attaching evidence.
2. Confirm `admin_audit_log` migration applied and admins can read it while non-admins cannot (X-06).
3. Confirm the edge proxy overwrites trusted client-IP headers (X-08); otherwise rate limiting is spoofable.
4. Configure the Supabase email templates to the `/auth/callback` cross-device URL (X-05).
5. Run a TLS scan against the production origin (X-07).
5. Decide and document the session lifetime and `httpOnly` trade-off (F-13/F-14).

## Go/no-go

- **Code-level readiness:** ready pending the residual PARTIAL items above; no `FAIL` findings remain.
- **Operational readiness:** **not yet verified** — the external items above have not been checked against a deployed environment.
- **Do not** treat this as a penetration-test attestation; no dynamic testing was performed.

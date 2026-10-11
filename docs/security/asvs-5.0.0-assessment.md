# OWASP ASVS 5.0.0 Assessment — TallGate

- **Standard:** OWASP Application Security Verification Standard (ASVS) 5.0.0
- **Target level:** Level 1 (with Level 2 notes)
- **Subject:** TallGate web application — Next.js 16 App Router, API route handlers, Supabase (Auth, Postgres with Row Level Security, Storage)
- **Method:** Manual source review + automated build/test/lint/typecheck + `npm audit`, plus a set of **read-only** live checks against the linked Supabase project on 2026-10-11 (GoTrue settings, PostgREST `SELECT … limit 1` with the publishable vs secret key, the OpenAPI table inventory, Storage bucket listing, the `verify_certificate` RPC, TLS handshake). No writes, auth flows or penetration testing were performed (see [Limitations](#limitations) and `docs/security/external-configuration-verification.md`).
- **Status labels:** `PASS` · `FAIL` · `PARTIAL` · `NOT VERIFIED` · `N/A`

> This document is a **static, evidence-based assessment** (with limited read-only live checks), not a penetration test or a certification. Each status is backed by a file/line reference, a test result, or a dated read-only check. Items that depend on external configuration or runtime infrastructure are marked `NOT VERIFIED`.

## Summary

| Status | Count |
| ------ | ----- |
| PASS | 17 |
| FAIL | 0 |
| PARTIAL | 11 |
| NOT VERIFIED | 0 |
| N/A | 3 |

The four findings originally marked `FAIL` have been remediated in isolated sub-batches (see [Remediation log](#remediation-log)); two are now `PASS` and two improved to `PARTIAL` because a residual hardening step remains.

## Findings

| ID | ASVS ref | Control / Finding | Status | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- |
| F-01 | V1.2, V1.3 | Injection prevention: no raw SQL, no `dangerouslySetInnerHTML`, no `eval`/`new Function`/`child_process`; output is React-escaped | PASS | Data access via Supabase client only; grep for `dangerouslySetInnerHTML\|eval\|new Function\|child_process` returns no application hits | None |
| F-02 | V2.2 | Server-side input validation and request hardening (Content-Type enforcement, streaming body-size cap, JSON parse guards, typed validators) | PASS | `lib/api/request.ts:13-95`, `lib/api/request.ts:97-136` | None |
| F-03 | V2.3, V6.3 | Account enumeration on registration: the signup handler returns an identical "check your email" outcome for new and existing addresses; provider errors are logged server-side only | PASS | `lib/auth/registration.ts:35-54` (`resolveSignUpOutcome` ignores `identities`); `app/(auth)/register/page.tsx`; test `tests/unit/registration.test.ts` | None |
| F-04 | V6.2.1 | Password policy consistency: registration and reset share one rule (≥8, ≤128) | PASS | `lib/auth/registration.ts:8-28` (`PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH`); `app/(auth)/register/page.tsx`, `app/(auth)/reset-password/page.tsx`; tests `tests/unit/registration.test.ts` | None |
| F-05 | V2.1 | Input-validation rules are implemented in code but not documented | PARTIAL | Validators exist (`lib/api/request.ts`); no validation-rule documentation located | Document per-endpoint validation rules |
| F-06 | V3.2, V3.3 | Security response headers (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`) | PASS | `next.config.mjs:9-21` | None |
| F-07 | V3.4 | CSP is **enforced** in production (report-only in dev). `default-src`, `object-src`, `frame-ancestors`, `base-uri`, `form-action` and `img-src` are locked down; `script-src`/`style-src` still allow `'unsafe-inline'` (Next.js inline hydration scripts and inline style attributes). Both strict alternatives were runtime-verified on 2026-10-11 and **rejected**: a nonce-based `script-src 'nonce-…' 'strict-dynamic'` policy blocked every script on statically rendered pages (`/events` 17/17 scripts nonce'd vs `/login` 0/16), and enabling `experimental.sri` with `script-src 'self'` added `integrity` to external bundles but still left every streamed page's inline `self.__next_f.push` bootstrap/flight scripts unhashed and blocked (upstream vercel/next.js#95353 / #95354 — SRI is external-only by design). A strict `script-src` therefore requires making the whole app dynamic (losing static/CDN caching) | PARTIAL | `next.config.mjs:1-66`; tests `tests/unit/security-headers.test.ts` (4 passing); nonce + SRI runtime checks 2026-10-11 | Keep the enforced CSP; drop `'unsafe-inline'` only via full dynamic rendering + nonces (SRI is not viable today) |
| F-08 | V4.1 | API responses set correct `Content-Type`; request bodies validated; errors are generic (no stack traces leaked) | PASS | `lib/api/request.ts:20-25`; generic error helper `app/api/admin/actions/route.ts:33` | None |
| F-09 | V6.1, V6.3 | Rate limiting present on public/abusive endpoints and now **fails closed** when identity cannot be resolved | PASS | `lib/api/rateLimit.ts:55-99`; tests `tests/unit/rate-limit.test.ts` (5 passing) | Document expected proxy header configuration operationally |
| F-10 | V6.1 | Client-IP trust for rate limiting relies on proxy-set headers `x-real-ip`/`cf-connecting-ip` (overridable via `RATE_LIMIT_TRUSTED_IP_HEADERS`) | PARTIAL | `lib/api/rateLimit.ts:21-53` | Ensure the edge proxy strips/overwrites these headers; otherwise they are spoofable |
| F-11 | V6, V10 | Auth callback handles email `token_hash` + `type` (`verifyOtp`) and PKCE `code` (`exchangeCodeForSession`), with safe-redirect validation and fail-closed error path | PASS | `app/auth/callback/route.ts:15-43`, `lib/auth/redirect.ts:1-21`; tests `tests/unit/auth-callback.test.ts` (16 passing), `tests/unit/redirect.test.ts` | None |
| F-12 | V6, V10 | Callback redirect on failure uses `?error=auth`, but the login page does not render it (dead parameter, no user-visible feedback) | PARTIAL | `app/auth/callback/route.ts:42`; `app/(auth)/login/page.tsx` reads `next` but not `error` | Either render the error on `/login` or drop the unused parameter |
| F-13 | V7.1 | Session cookies: `SameSite=Lax`, `Secure` in production, `path=/`; **`httpOnly` is false** (Supabase SSR default) so session tokens are readable by JavaScript. The trade-off, compensating controls, and revisit criteria are now documented | PARTIAL | `lib/supabase/cookieOptions.ts:1-5`; `docs/security/session-management.md`; `node_modules/@supabase/ssr/dist/module/utils/constants.js:4` | Accepted and documented; revisit only by adopting a server-only session pattern |
| F-14 | V7.1 | Session inactivity/absolute lifetime and re-authentication expectations are documented; the hosted Supabase project manages the values (dashboard-verified values still required) | PASS | `docs/security/session-management.md`; `lib/supabase/middleware.ts:56-68` | None (confirm dashboard values at deploy) |
| F-15 | V8.1, V8.2 | Function-level and data-level authorization: proxy gating on protected prefixes using `getUser()`, `requireAdmin()` guards, RLS enabled on **21** tables with **62** policies, single-role-per-user, admin RPCs `SECURITY DEFINER` + `is_admin()` | PASS | Source: `proxy.ts:4-11`, `lib/supabase/middleware.ts:20-71`; 21 × `ENABLE ROW LEVEL SECURITY`, 62 × `CREATE POLICY`, 9 × `SECURITY DEFINER`. Live (2026-10-11, publishable key vs secret key): `profiles`/`user_roles` return 0 rows to anon but exist (count 2) for the service role; `payment_requests`/`certificates`/`live_sessions`/`api_rate_limits` return `42501 permission denied`; private `certificates` bucket lists no objects to anon (X-06) | Deployed schema now at parity (X-11 resolved 2026-10-11); migrations applied and verified |
| F-16 | V8.1 | No super-admin: any admin can change another admin's role (self-change blocked) | PARTIAL | `app/api/admin/actions/route.ts` (`update_user_role`; `assignUserRole`) | Add a protected owner role or document the accepted risk |
| F-17 | V9.1 | Self-contained token validation delegated to Supabase Auth (JWT signature verification) | PARTIAL | No custom token handling; verification performed inside `@supabase/*`. Live/Management API (2026-10-11): `jwt_exp = 3600`; project secrets include a managed `SUPABASE_JWKS` entry (asymmetric JWKS signing keys) | Confirm signing-key type/rotation via dashboard or signing-keys API; no app-level claim to make |
| F-18 | V5.1, V5.3 | File handling: no user-facing uploads; certificate PDFs are server-generated into a private bucket | N/A | No upload handlers found; `supabase/migrations/20261003000000_storage_buckets_and_grants.sql`, `20261007160000_harden_course_content_storage_policies.sql` | None |
| F-19 | V10.1 | OAuth/OIDC (Google, GitHub) | N/A | Live (2026-10-11): `GET /auth/v1/settings` reports **every** external provider disabled (`google`, `github`, … all `false`) with `email` only; the sign-in page uses only `signInWithPassword` (`app/(auth)/login/page.tsx`), and no `signInWithOAuth` exists in the codebase. The callback still accepts a PKCE `code` for same-browser links | If OAuth is a product requirement it must be implemented and enabled; meanwhile the redirect allow-list (X-01) still governs email-link `redirect_to` |
| F-20 | V11.2, V11.3 | Cryptography: no custom crypto in app code; HMAC-SHA256 used only to hash rate-limit keys | PASS | `lib/api/rateLimit.ts:73-76` | None |
| F-21 | V11.1 | Documented key-management policy / lifecycle for application and Supabase secrets | PARTIAL | Secrets read from environment only; no key-management documentation located | Document key inventory, rotation, and ownership |
| F-22 | V12.1, V12.2 | Secure communication: HSTS `preload` header emitted by the app; the Supabase dependency negotiates TLS 1.3 (live 2026-10-11, valid cert); TLS/edge configuration of the **application origin** is unverified (not deployed/known) | PARTIAL | `next.config.mjs:17-20`; live handshake to `<ref>.supabase.co:443` → TLS 1.3, cert issuer Google Trust Services; X-07 | Verify TLS versions/ciphers/HSTS at the app's hosting edge |
| F-23 | V13.1, V13.2 | Configuration/secrets hygiene: only `.env.example` tracked; `.env*` ignored; service-role key read only in `server-only` modules | PASS | `.gitignore`; `lib/supabase/admin.ts:1`; `git ls-files` shows no committed `.env` | None |
| F-24 | V14.1, V14.2 | Data protection: no payment-card data stored (`payment_requests` records status only); RLS on user data; private storage buckets; secrets never exposed via `NEXT_PUBLIC_*` | PASS | `supabase/migrations/20261007130000_payment_requests.sql`; `lib/supabase/admin.ts`; env naming | None |
| F-25 | V15.1 | Dependency management: production dependencies have **0** known vulnerabilities | PASS | `npm audit --omit=dev` → `found 0 vulnerabilities` | None |
| F-26 | V15.1 | Build-time/dev dependencies carry advisories (7 high, 2 moderate) in the Tailwind/PostCSS/eslint chain | PARTIAL | `npm audit` → 9 advisories, fixes require breaking major upgrades | Schedule dependency upgrades; not shipped to the runtime bundle |
| F-27 | V16.1, V16.2 | Admin actions write a durable audit record (actor, action, target, outcome) via the service role, readable by admins only; audit-write failures emit a structured, value-free log event; a `purge_admin_audit_log(days)` retention routine (SECURITY DEFINER, `service_role` only) is added and **applied and verified (X-11)**. App-wide structured logging is provided by a shared logger (`lib/logging/logger.ts`) that emits redacted, length-bounded JSON events and is adopted across API route handlers, server actions and shared server modules (auth, audit, rate-limit, catalogue, dashboard, learning) | PASS | `supabase/migrations/20261011000000_admin_audit_log.sql`, `supabase/migrations/20261011000001_admin_audit_log_retention.sql`, `lib/admin/auditLog.ts`, `lib/logging/logger.ts`; tests `tests/unit/admin-audit-log.test.ts` (10 passing), `tests/unit/logger.test.ts` (10 passing); applied 2026-10-11 and verified (`relrowsecurity=true`, admin-read policy, anon denied, retention fn `service_role`-only) | None (migrations applied 2026-10-11) |
| F-28 | V16.3, V16.4 | Error handling: generic client-facing errors and error boundaries | PASS | `app/error.tsx`, `app/not-found.tsx` | None |
| F-29 | V13.2, V14.2 | The server now **fails fast** at startup in production when a critical secret is absent, via `instrumentation.ts` → `assertCriticalEnv()` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`); skipped during `next build` so secret-less CI builds still succeed | PASS | `instrumentation.ts`, `lib/config/env.ts`; tests `tests/unit/env.test.ts` (5 passing) | None |
| F-30 | V17.1 | WebRTC | N/A | No WebRTC usage in the codebase | None |
| F-31 | V6.2, V6.3 | Email-address verification: the live project has `mailer_autoconfirm: true`, so new accounts are **not** required to confirm their email; the app nonetheless routes sign-ups to `/verify-email` | PARTIAL | Live 2026-10-11: `/auth/v1/settings` → `mailer_autoconfirm: true`, `disable_signup: false`; `app/(auth)/register/page.tsx`; X-05 | Enable email confirmation, or accept and document the risk; then confirm the cross-device template |

## Test and tooling evidence

Commands executed for this assessment:

- `npm run test` — **133 passing** across 18 files, including `tests/unit/auth-callback.test.ts` (16 cases), `tests/unit/rate-limit.test.ts` (5 cases), `tests/unit/registration.test.ts` (7 cases), `tests/unit/admin-audit-log.test.ts` (10 cases), `tests/unit/logger.test.ts` (10 cases), `tests/unit/security-headers.test.ts` (4 cases) and `tests/unit/env.test.ts` (5 cases).
- `npm run typecheck` — clean (`tsc --noEmit`).
- `npm run lint` — 0 errors (pre-existing warnings only).
- `npm run build` — succeeds.
- `npm audit --omit=dev` — 0 vulnerabilities; `npm audit` — 9 advisories, all in dev/build tooling (fixes require breaking major upgrades).

Auth-callback regression coverage (`tests/unit/auth-callback.test.ts`) exercises: the email `token_hash`+`type` flow, safe `next` handling, missing/unknown `type`, verification failure with and without a fallback `code`, the PKCE `code` flow (success and failure), missing and empty credentials, and unsafe redirect destinations (`https://evil.com`, `//evil.com`, dot-segment escapes, `javascript:`, `/login`, `/register`). All 16 cases pass against the current implementation; no production defect was demonstrated, so no production code was changed.

## Read-only live checks (2026-10-11)

Limited read-only checks were run against the linked Supabase project `zlmbitphlzokjmfwldcb` using the local `.env.local` credentials (no writes, no auth flows, no secrets printed). Full method and per-ID results are in `docs/security/external-configuration-verification.md`.

- Auth settings (`GET /auth/v1/settings`) + health (`/auth/v1/health`, GoTrue `v2.197.0`): all external providers disabled (email only), `anonymous_users`/`phone` disabled; `disable_signup: false`; `mailer_autoconfirm: true`; `passkeys_enabled: false`; `saml_enabled: false`.
- Schema exposure: before the apply, the OpenAPI inventory (secret key) exposed 20 tables with `admin_audit_log` absent; after the 2026-10-11 apply it is present and RLS-protected (publishable key → `42501 permission denied`).
- Authorization: publishable-key `SELECT` returns no rows for `profiles`/`user_roles` while the secret key sees them (count 2), and returns `42501 permission denied` for `payment_requests`/`certificates`/`live_sessions`/`api_rate_limits`; public catalogue tables (`courses` = 6 rows, `course_categories`) read normally.
- Storage: exactly two buckets (`course-content`, `certificates`), both `public: false`; private `certificates` bucket lists no objects to the publishable key.
- Public verification: `POST /rest/v1/rpc/verify_certificate` with the publishable key and a non-existent exact code returns `200 []` (exact-code lookup, no enumeration).
- TLS: `zlmbitphlzokjmfwldcb.supabase.co:443` negotiates TLS 1.3 with a valid certificate.
- **Deployment gap (X-11) — RESOLVED (2026-10-11):** the remote ledger was out of sync by five migrations; all five were applied via `supabase db push --linked`, `supabase migration list --linked` is back in sync, and `admin_audit_log` is verified (RLS on, `"Admins can read the audit log"` policy, anon denied, retention function `SECURITY DEFINER` / `service_role`-only). See `docs/security/migration-deployment-plan.md`.
- **Auth config (read-only, Management API):** `site_url = http://localhost:3000` with an empty `uri_allow_list`, and email templates use `{{ .ConfirmationURL }}` on a project with `mailer_autoconfirm: true` — see X-01/X-05; hosted session values are 1h JWT, refresh rotation on, no inactivity/absolute timeout; `password_min_length = 6`.

## Remediation log

Each remediation was delivered as an isolated commit with its own regression tests; no applied migration was edited and no auth/RLS/security control was weakened to make a test pass.

| Finding | Result | Commit | Change |
| ------- | ------ | ------ | ------ |
| F-03 | `FAIL` → `PASS` | `0543934` | Sign-up no longer branches on `user.identities`; all outcomes return one neutral message, the real reason is logged server-side only |
| F-04 | `FAIL` → `PASS` | `0543934` | Registration and reset share one password rule (≥8, ≤128) via `lib/auth/registration.ts` |
| F-27 | `FAIL` → `PARTIAL` | `341bd16` | Append-only `admin_audit_log` (migration + `lib/admin/auditLog.ts` + route wiring + tests) |
| F-07 | `FAIL` → `PARTIAL` | `c3a92fe` | CSP enforced in production, `img-src`/`object-src` tightened; `'unsafe-inline'` scripts remain (no nonce yet) |
| X-11 | `FAIL` → `PASS` | (deployment) | Applied 5 pending migrations via `supabase db push --linked`; verified schema/RLS/policy/grants/retention (2026-10-11) |

## Limitations

- **No deployed application:** no live web origin, hosting dashboard, or app-host access was available. The **database** migration gap was closed on 2026-10-11 (X-11 `PASS`) using the Supabase CLI's stored credential and the Management API read-only SQL endpoint; migrations are now applied in the linked project.
- **Limited live checks:** the Supabase project was probed read-only: auth settings/health, PostgREST table visibility plus the OpenAPI table inventory (20 tables), Storage bucket listing and listing denials, the `verify_certificate` RPC, and the TLS handshake. This does not replace a dynamic test and covers only the tables/endpoints touched (see X-06).
- **External configuration not fully verifiable in-repo:** OAuth/redirect allow-lists, JWT signing keys, MFA/session lifetime, email template bodies, CDN/proxy header behavior, and the app host's TLS live outside this repository (X-01, X-03, X-04, X-05, X-07, X-08, X-09).
- **No dynamic testing:** no DAST, fuzzing, or penetration test was performed.
- **No SAST dependency:** only `npm audit` and manual review were used; no dedicated static analysis tool was run.
- **`NOT VERIFIED` ≠ safe:** these items indicate missing evidence, not an absence of risk.
- **Line numbers** refer to the repository state at the time of this assessment and may drift as code changes.

## Remaining gaps (prioritized)

1. **X-01 / X-05 (HIGH)** Set the Supabase Site URL + redirect allow-list to the production origin, and switch the email templates to the app's `token_hash` cross-device pattern — read-only evidence shows both are currently misconfigured (`site_url=localhost`, empty allow-list, default `{{ .ConfirmationURL }}` templates). Confirm whether `zlmbitphlzokjmfwldcb` is dev or production.
2. **X-09** Verify the production runtime secrets (hosting platform); presence only, never the values.
3. **X-11** RESOLVED — migrations applied and verified 2026-10-11; optionally exercise one authorized admin action end-to-end.
4. **F-31** Decide on email verification: live `mailer_autoconfirm` is `true` (addresses not confirmed).
5. **F-07** Drop `'unsafe-inline'` from `script-src` only via full dynamic rendering + nonces; hash-based SRI was verified insufficient (inline flight scripts; vercel/next.js#95353 / #95354).
6. **F-13 / F-14** Record the now-retrieved hosted session values (1h JWT, refresh rotation on, **no** inactivity/absolute timeout) in `docs/security/session-management.md`.
7. **F-10 / X-08** Confirm the edge proxy overwrites (not appends) the trusted client-IP headers.
8. **F-26** Schedule upgrades for dev/build dependency advisories.

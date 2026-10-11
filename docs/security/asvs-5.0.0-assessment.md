# OWASP ASVS 5.0.0 Assessment — TallGate

- **Standard:** OWASP Application Security Verification Standard (ASVS) 5.0.0
- **Target level:** Level 1 (with Level 2 notes)
- **Subject:** TallGate web application — Next.js 16 App Router, API route handlers, Supabase (Auth, Postgres with Row Level Security, Storage)
- **Method:** Manual source review + automated build/test/lint/typecheck + `npm audit`. No deployed environment or live database was available (see [Limitations](#limitations)).
- **Status labels:** `PASS` · `FAIL` · `PARTIAL` · `NOT VERIFIED`

> This document is a **static, evidence-based assessment**, not a penetration test or a certification. Each status is backed by a file/line reference or a test result. Items that depend on external configuration or runtime infrastructure are marked `NOT VERIFIED`.

## Summary

| Status | Count |
| ------ | ----- |
| PASS | 14 |
| FAIL | 0 |
| PARTIAL | 10 |
| NOT VERIFIED | 4 |
| N/A | 2 |

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
| F-07 | V3.4 | CSP is now **enforced** in production (report-only in dev). `default-src`, `object-src`, `frame-ancestors`, `base-uri`, `form-action` and `img-src` are locked down; `script-src`/`style-src` still allow `'unsafe-inline'` (Next.js inline hydration scripts and inline style attributes) with no nonce/hash | PARTIAL | `next.config.mjs:1-66`; tests `tests/unit/security-headers.test.ts` (4 passing) | Thread a per-request nonce through rendered pages and drop `'unsafe-inline'` from `script-src` |
| F-08 | V4.1 | API responses set correct `Content-Type`; request bodies validated; errors are generic (no stack traces leaked) | PASS | `lib/api/request.ts:20-25`; generic error helper `app/api/admin/actions/route.ts:33` | None |
| F-09 | V6.1, V6.3 | Rate limiting present on public/abusive endpoints and now **fails closed** when identity cannot be resolved | PASS | `lib/api/rateLimit.ts:55-99`; tests `tests/unit/rate-limit.test.ts` (5 passing) | Document expected proxy header configuration operationally |
| F-10 | V6.1 | Client-IP trust for rate limiting relies on proxy-set headers `x-real-ip`/`cf-connecting-ip` (overridable via `RATE_LIMIT_TRUSTED_IP_HEADERS`) | PARTIAL | `lib/api/rateLimit.ts:21-53` | Ensure the edge proxy strips/overwrites these headers; otherwise they are spoofable |
| F-11 | V6, V10 | Auth callback handles email `token_hash` + `type` (`verifyOtp`) and PKCE `code` (`exchangeCodeForSession`), with safe-redirect validation and fail-closed error path | PASS | `app/auth/callback/route.ts:15-43`, `lib/auth/redirect.ts:1-21`; tests `tests/unit/auth-callback.test.ts` (16 passing), `tests/unit/redirect.test.ts` | None |
| F-12 | V6, V10 | Callback redirect on failure uses `?error=auth`, but the login page does not render it (dead parameter, no user-visible feedback) | PARTIAL | `app/auth/callback/route.ts:42`; `app/(auth)/login/page.tsx` reads `next` but not `error` | Either render the error on `/login` or drop the unused parameter |
| F-13 | V7.1 | Session cookies: `SameSite=Lax`, `Secure` in production, `path=/`; **`httpOnly` is false** (Supabase SSR default) so session tokens are readable by JavaScript | PARTIAL | `lib/supabase/cookieOptions.ts:1-5`; `node_modules/@supabase/ssr/dist/module/utils/constants.js:4` | Accept and document, or adopt a server-only session pattern; the now-enforced CSP (F-07) reduces, but does not remove, the XSS impact |
| F-14 | V7.1 | Documented session inactivity/absolute lifetime | PARTIAL | None located | Document session lifetime and re-authentication expectations |
| F-15 | V8.1, V8.2 | Function-level and data-level authorization: proxy gating on protected prefixes using `getUser()`, `requireAdmin()` guards, RLS enabled on **20** tables with **61** policies, single-role-per-user, admin RPCs `SECURITY DEFINER` + `is_admin()` | PASS | `proxy.ts:4-11`, `lib/supabase/middleware.ts:20-71`; migration grep: 20 × `ENABLE ROW LEVEL SECURITY`, 61 × `CREATE POLICY`, 9 × `SECURITY DEFINER` | None |
| F-16 | V8.1 | No super-admin: any admin can change another admin's role (self-change blocked) | PARTIAL | `app/api/admin/actions/route.ts` (`update_user_role`; `assignUserRole`) | Add a protected owner role or document the accepted risk |
| F-17 | V9.1 | Self-contained token validation delegated to Supabase Auth (JWT signature verification) | NOT VERIFIED | No custom token handling; verification performed inside `@supabase/*` | Verify Supabase JWT verification settings; no app-level claim to make |
| F-18 | V5.1, V5.3 | File handling: no user-facing uploads; certificate PDFs are server-generated into a private bucket | N/A | No upload handlers found; `supabase/migrations/20261003000000_storage_buckets_and_grants.sql`, `20261007160000_harden_course_content_storage_policies.sql` | None |
| F-19 | V10.1 | OAuth/OIDC (Google, GitHub) PKCE flow | NOT VERIFIED | `app/auth/callback/route.ts`, `app/(auth)/login/page.tsx`; provider/redirect allow-lists live in the Supabase dashboard | Verify provider, redirect allow-list, and PKCE settings in the Supabase project |
| F-20 | V11.2, V11.3 | Cryptography: no custom crypto in app code; HMAC-SHA256 used only to hash rate-limit keys | PASS | `lib/api/rateLimit.ts:73-76` | None |
| F-21 | V11.1 | Documented key-management policy / lifecycle for application and Supabase secrets | PARTIAL | Secrets read from environment only; no key-management documentation located | Document key inventory, rotation, and ownership |
| F-22 | V12.1, V12.2 | Secure communication: HSTS `preload` header emitted; TLS termination/ciphers are infrastructure concerns | NOT VERIFIED | `next.config.mjs:17-20` | Verify TLS version/ciphers at the hosting edge |
| F-23 | V13.1, V13.2 | Configuration/secrets hygiene: only `.env.example` tracked; `.env*` ignored; service-role key read only in `server-only` modules | PASS | `.gitignore`; `lib/supabase/admin.ts:1`; `git ls-files` shows no committed `.env` | None |
| F-24 | V14.1, V14.2 | Data protection: no payment-card data stored (`payment_requests` records status only); RLS on user data; private storage buckets; secrets never exposed via `NEXT_PUBLIC_*` | PASS | `supabase/migrations/20261007130000_payment_requests.sql`; `lib/supabase/admin.ts`; env naming | None |
| F-25 | V15.1 | Dependency management: production dependencies have **0** known vulnerabilities | PASS | `npm audit --omit=dev` → `found 0 vulnerabilities` | None |
| F-26 | V15.1 | Build-time/dev dependencies carry advisories (7 high, 2 moderate) in the Tailwind/PostCSS/eslint chain | PARTIAL | `npm audit` → 9 advisories, fixes require breaking major upgrades | Schedule dependency upgrades; not shipped to the runtime bundle |
| F-27 | V16.1, V16.2 | Admin actions now write a durable audit record (actor, action, target, outcome) via the service role, readable by admins only; app-wide structured logging and log retention are still absent and `console.*` remains in use | PARTIAL | `supabase/migrations/20261011000000_admin_audit_log.sql`, `lib/admin/auditLog.ts`, `app/api/admin/actions/route.ts:211-252`; tests `tests/unit/admin-audit-log.test.ts` (10 passing) | Add structured, PII-scrubbed logging and a retention policy for `admin_audit_log` |
| F-28 | V16.3, V16.4 | Error handling: generic client-facing errors and error boundaries | PASS | `app/error.tsx`, `app/not-found.tsx` | None |
| F-29 | V13.2, V14.2 | Production startup only warns on missing critical secrets rather than failing fast | PARTIAL | `next.config.mjs:76-92` | Fail build/start (or health check) when required secrets are absent |
| F-30 | V17.1 | WebRTC | N/A | No WebRTC usage in the codebase | None |

## Test and tooling evidence

Commands executed for this assessment:

- `npm run test` — **118 passing** across 16 files, including `tests/unit/auth-callback.test.ts` (16 cases), `tests/unit/rate-limit.test.ts` (5 cases), `tests/unit/registration.test.ts` (7 cases), `tests/unit/admin-audit-log.test.ts` (10 cases) and `tests/unit/security-headers.test.ts` (4 cases).
- `npm run typecheck` — clean (`tsc --noEmit`).
- `npm run lint` — 0 errors (pre-existing warnings only).
- `npm run build` — succeeds.
- `npm audit --omit=dev` — 0 vulnerabilities; `npm audit` — 9 advisories, all in dev/build tooling (fixes require breaking major upgrades).

Auth-callback regression coverage (`tests/unit/auth-callback.test.ts`) exercises: the email `token_hash`+`type` flow, safe `next` handling, missing/unknown `type`, verification failure with and without a fallback `code`, the PKCE `code` flow (success and failure), missing and empty credentials, and unsafe redirect destinations (`https://evil.com`, `//evil.com`, dot-segment escapes, `javascript:`, `/login`, `/register`). All 16 cases pass against the current implementation; no production defect was demonstrated, so no production code was changed.

## Remediation log

Each remediation was delivered as an isolated commit with its own regression tests; no applied migration was edited and no auth/RLS/security control was weakened to make a test pass.

| Finding | Result | Commit | Change |
| ------- | ------ | ------ | ------ |
| F-03 | `FAIL` → `PASS` | `0543934` | Sign-up no longer branches on `user.identities`; all outcomes return one neutral message, the real reason is logged server-side only |
| F-04 | `FAIL` → `PASS` | `0543934` | Registration and reset share one password rule (≥8, ≤128) via `lib/auth/registration.ts` |
| F-27 | `FAIL` → `PARTIAL` | `341bd16` | Append-only `admin_audit_log` (migration + `lib/admin/auditLog.ts` + route wiring + tests) |
| F-07 | `FAIL` → `PARTIAL` | `c3a92fe` | CSP enforced in production, `img-src`/`object-src` tightened; `'unsafe-inline'` scripts remain (no nonce yet) |

## Limitations

- **No live environment:** no deployed instance, database, or Supabase project was available. Migrations (including RLS policies and RPCs) were reviewed as source, not executed.
- **External configuration not verifiable in-repo:** OAuth/OIDC provider settings, redirect allow-lists, TLS/cipher configuration, CDN/proxy header behavior, and Supabase Auth policy (MFA, session lifetime) live outside this repository.
- **No dynamic testing:** no DAST, fuzzing, or penetration test was performed.
- **No SAST dependency:** only `npm audit` and manual review were used; no dedicated static analysis tool was run.
- **`NOT VERIFIED` ≠ safe:** these items indicate missing evidence, not an absence of risk.
- **Line numbers** refer to the repository state at the time of this assessment and may drift as code changes.

## Remaining gaps (prioritized)

1. **F-07** Thread a nonce through rendered pages and drop `'unsafe-inline'` from `script-src` (CSP is now enforced in production).
2. **F-27** Add structured, PII-scrubbed logging and a retention policy for `admin_audit_log`.
3. **F-13, F-14** Document the session-cookie `httpOnly` trade-off and session lifetime.
4. **F-10** Confirm the edge proxy overwrites (not appends) the trusted client-IP headers.
5. **F-29** Fail fast on missing critical secrets instead of logging a startup warning.
6. **F-26** Schedule upgrades for dev/build dependency advisories.

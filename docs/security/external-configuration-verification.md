# External Configuration Verification — TallGate

- **Scope:** security-relevant settings that live outside this repository (Supabase project, hosting/CDN/proxy, email provider).
- **Method (revised 2026-10-11):** In addition to source review, a set of **read-only** checks was run against the linked Supabase project using the credentials in the local `.env.local`. No writes, no auth flows, and no data modifications were performed, and no secret values were printed. See [Verification environment](#verification-environment).
- **Method update (2026-10-11, deployment pass):** the migration gap was closed (X-11 → `PASS`) using the Supabase CLI's stored credential, and the same credential unlocked (a) the Supabase **Management API** read-only config endpoints (`GET /v1/projects/<ref>/config/auth`, `/secrets`) and (b) read-only SQL via the Management API query endpoint (`pg_class`/`pg_policies`/`pg_proc`). This let X-01, X-03, X-04, X-05 and X-11 be re-assessed **with evidence** (results below). No secret values were printed. X-07 (app origin) and X-08 (edge proxy) remain `NOT VERIFIED` (no app origin / no proxy access); X-09 remains `PARTIAL` (Supabase-managed project secrets present, but the app's hosting runtime was not inspected).
- **Rule:** Do not record secret values here. For environment variables, record only `CONFIGURED` / `NOT CONFIGURED` (presence), never their contents.
- **`NOT VERIFIED` ≠ safe.** These items indicate missing evidence, not an absence of risk.

## Verification environment

| Property | Value |
| -------- | ----- |
| Date of checks | 2026-10-11 |
| Project (Supabase ref) | `zlmbitphlzokjmfwldcb` (name `tallgate`), linked in `supabase/.temp/` |
| Credentials used | Local `.env.local` (`sb_publishable_…` / `sb_secret_…` new-format keys); presence only, values not recorded |
| Checks performed | `GET /auth/v1/settings`, `GET /auth/v1/health`, PostgREST `SELECT … limit 1` with the publishable key, a compared `SELECT` with the secret key, Storage `bucket` list + object `list`, and a direct TLS handshake; plus (2026-10-11 deployment pass) Management API `GET /config/auth` + `GET /secrets` and Management API read-only SQL (`pg_class`/`pg_policies`/`pg_proc`/`routine_privileges`/migration history) |
| Explicitly not performed | No sign-in/sign-up/OAuth initiation, no dashboard changes, no penetration testing. The **only** writes were applying the five pending migrations via the approved `supabase db push` in the 2026-10-11 deployment pass (no ad-hoc `INSERT`/`UPDATE`/`DELETE`). |

> This is a **configuration and source review**, not a penetration test or certification. `PASS`/`PARTIAL` here reflect the checks listed above only.

## Project environment (determined 2026-10-11, read-only)

Evidence gathered to decide whether `zlmbitphlzokjmfwldcb` is development, staging or production (no settings changed, no secrets printed):

| Signal | Observation | Reading |
| ------ | ----------- | ------- |
| Org / project inventory (Management API `GET /organizations`, `GET /projects`) | one org **TallGate Limited** with **exactly one** project: `zlmbitphlzokjmfwldcb` (`tallgate`, `eu-central-1`, created 2026-09-29, `ACTIVE_HEALTHY`) | there is **no separate production project** in the visible account |
| Auth `site_url` / `uri_allow_list` | `http://localhost:3000` / empty | development-style default |
| Auth `mailer_autoconfirm` / `password_min_length` | `true` / `6` | GoTrue/dev defaults |
| Data volume (read-only) | `profiles`/`user_roles` count 2; public `courses` 6 | small/test dataset |
| Repo deployment config | no `vercel.json`/`netlify.toml`; only `.github/workflows/ci.yml` (lint/typecheck/test/build); README references Vercel generically | no committed production origin |
| Domain references in repo | only mock/test strings (`pitchdeck.tallgate.com`, `tallgate.test`, `tallgate.invalid`) | no real production domain found |
| Hosting/CDN | not accessible in this environment | **NOT VERIFIED** |

**Finding:** the only Supabase project in this account uses development defaults and holds test-only data. **Owner confirmation (2026-10-11):** this single project serves both development and production (no separate production project), so it **is** the production database.

**Uncertainties:** the CLI token may be scoped to a single organization (other orgs/projects under a different account would not be visible); the application's production hosting origin is still unknown.

**Recommended next step:** because this project is the production database, its Auth configuration must be corrected **before launch** — set the production Site URL and redirect allow-list and switch the email templates to the app's `token_hash` cross-device pattern (X-01/X-05) — and the hosting runtime secrets must be verified (X-09). These are production changes and require explicit authorization; none were made here.

## Status summary

| ID | Area | Status | Evidence type |
| -- | ---- | ------ | ------------- |
| X-01 | Supabase Auth — redirect allow-list | **FAIL** | Management API read-only (misconfigured) |
| X-02 | Supabase Auth — OAuth providers | PASS | Management API + live read-only |
| X-03 | Supabase Auth — JWT verification & signing keys | PARTIAL | Management API read-only |
| X-04 | Supabase Auth — MFA, session lifetime, password policy | PARTIAL | Management API + live read-only |
| X-05 | Email templates point at `/auth/callback` (cross-device) | **FAIL** | Management API read-only (templates use `{{ .ConfirmationURL }}`) |
| X-06 | RLS / grants / Storage policies / migration state | PARTIAL | Live read-only + Management API SQL |
| X-07 | Hosting TLS | PARTIAL | Live read-only (Supabase host) + app origin unavailable |
| X-08 | Edge proxy overrides trusted client-IP headers | NOT VERIFIED | Proxy/CDN config required |
| X-09 | Production secrets present in the runtime environment | PARTIAL | Supabase-managed project secrets present; app hosting runtime unverified |
| X-10 | `npm audit` on the deployed dependency set | PARTIAL | Local lockfile only |
| X-11 | Deployed schema parity with `main` | **PASS** | Migrations applied + verified (CLI/Management API) |

See `docs/security/migration-deployment-plan.md` for the X-06/X-11 root-cause analysis and the safe apply/verify plan.

---

## X-01 — Supabase Auth redirect allow-list

- **Status:** **FAIL (confirmed misconfigured, 2026-10-11)** — read via `GET /v1/projects/<ref>/config/auth`.
- **Evidence:** `site_url = "http://localhost:3000"` and `uri_allow_list = ""` (empty). With an empty allow-list only the Site URL is accepted as a `redirect_to` target, and that Site URL is `localhost` — so in any deployed environment Supabase ignores the app's `redirectTo`/`emailRedirectTo` (`https://<prod>/auth/callback`, `https://<prod>/reset-password`) and sends users to `localhost`. Email confirmation/recovery links therefore break off-localhost.
- **Note:** the owner confirmed (2026-10-11) that this single project serves production, so these dev-default values are a real pre-launch blocker (see [Project environment](#project-environment-determined-2026-10-11-read-only)).
- **Fix (dashboard or Management API, requires authorization):** set **Site URL** to the production origin and add `https://<prod-domain>/auth/callback` (and `/reset-password`) to **Redirect URLs**; use no wildcard that matches attacker-controlled hosts.
- **Why:** the app validates `next` internally (`lib/auth/redirect.ts`), but the provider-side list is an independent control and currently defeats the app's cross-device callback design (F-11).
- **Related findings:** F-11, F-19.

## X-02 — OAuth providers

- **Status:** PASS (live read-only).
- **Evidence:** `GET /auth/v1/settings` on 2026-10-11 returned `external` with **every** provider `false` except `email: true` (`google: false`, `github: false`, `azure`, `apple`, `gitlab`, etc. all false), `anonymous_users: false`, `saml_enabled: false`. The sign-in page uses only `supabase.auth.signInWithPassword` (`app/(auth)/login/page.tsx`); no `signInWithOAuth` exists in the codebase.
- **Assessment:** No unexpected identity provider is enabled and the app exposes no OAuth surface, so there is no provider-side OAuth exposure. If Google/GitHub sign-in is a product requirement it is currently **not implemented and not enabled**.
- **Related finding:** F-19.

## X-03 — JWT verification & signing keys

- **Status:** PARTIAL (Management API read-only, 2026-10-11).
- **Evidence:** `GET /v1/projects/<ref>/config/auth` → `jwt_exp = 3600` (1h access tokens). The project's secret list contains a managed `SUPABASE_JWKS` entry, consistent with **asymmetric (JWKS) JWT signing keys** rather than a legacy shared secret. No custom token issuance in app code (`lib/database/server`, `lib/database/client` delegate entirely to `@supabase/*`). The signing-key algorithm/rotation policy is not exposed by the read-only endpoint.
- **Remaining:** confirm the signing-key type/rotation in the dashboard or via the signing-keys API.
- **Related finding:** F-17.

## X-04 — MFA, session lifetime, password policy

- **Status:** PARTIAL (Management API + live read-only, 2026-10-11).
- **Evidence (Management API `config/auth`):** `jwt_exp = 3600`; `refresh_token_rotation_enabled = true` with `security_refresh_token_reuse_interval = 10`; `sessions_inactivity_timeout = 0` and `sessions_timebox = 0` (no idle/absolute expiry) and `sessions_single_per_user = false` (multiple concurrent sessions). MFA: `mfa_totp_enroll_enabled = true`, `mfa_totp_verify_enabled = true`, `mfa_phone_enroll_enabled = false`, `mfa_max_enrolled_factors = 10`, `mfa_allow_low_aal = false` — TOTP is **available but not enforced**. `password_min_length = 6`, `password_hibp_enabled = false`, `security_update_password_require_reauthentication = false`.
- **Evidence (live `GET /auth/v1/settings`):** `disable_signup: false`, `mailer_autoconfirm: true` (see X-05/F-31), `phone_autoconfirm: false`, `passkeys_enabled: false`, `saml_enabled: false`, `external.anonymous_users: false`; `/auth/v1/health` → GoTrue `v2.197.0` healthy.
- **Notable deltas vs documentation:** the hosted `password_min_length` is **6**, weaker than the app's enforced ≥8 (`lib/auth/registration.ts` still enforces ≥8 client- and server-side, so the effective minimum is 8); no session inactivity/absolute timeout is configured, so `docs/security/session-management.md` should record the hosted values (F-13/F-14).
- **Steps (owner/authorization):** decide whether to raise `password_min_length` to ≥8, enable HIBP, enforce MFA for admins, and set session timeouts.
- **Related findings:** F-13, F-14.

## X-05 — Email templates and cross-device confirmation

- **Status:** **FAIL (confirmed, 2026-10-11)** — template bodies read via `GET /v1/projects/<ref>/config/auth`.
- **Evidence:** the Confirmation, Recovery, Magic-link and Invite templates all use the default `{{ .ConfirmationURL }}` link (e.g. Confirmation: `<a href="{{ .ConfirmationURL }}">Confirm email address</a>`). None uses the app's cross-device pattern `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=…`. Combined with X-01 (`site_url = localhost`, empty allow-list), links resolve to `localhost` off-device. The app's callback (`app/auth/callback/route.ts`) handles both `token_hash`+`type` (cross-device, `verifyOtp`) and PKCE `code` (same browser), but only the same-browser path can work while the templates and allow-list are unset.
- **Caveat:** `mailer_autoconfirm: true` (F-31) means sign-ups receive no confirmation email today; the Recovery/Magic-link flows are still affected.
- **Fix (dashboard or Management API, requires authorization):** point Confirmation/Invite/Magic-link at `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` (Recovery `type=recovery` with `next=/reset-password`), and set the Site URL / allow-list (X-01).
- **Related findings:** F-11, F-31.

## X-06 — RLS, grants, Storage policies and migration state

- **Status:** PARTIAL (live read-only).
- **Evidence — exposed table inventory:** `GET /rest/v1/` (OpenAPI, secret key) lists **20** tables: `service_inquiries, certificates, api_rate_limits, course_modules, contact_messages, startup_reviews, course_categories, profiles, lesson_progress, services, lessons, startup_applications, payment_requests, consultation_requests, user_roles, lesson_content, course_enrollments, roles, live_sessions, courses`. `admin_audit_log` is **absent**, corroborating the parity gap (X-11).
- **Evidence — Storage buckets (secret key):** `GET /storage/v1/bucket` returns exactly **two** buckets — `course-content` and `certificates` — both `public: false`. No public bucket exists.
- **Evidence — public verification RPC:** `POST /rest/v1/rpc/verify_certificate` with the publishable key and a non-existent exact code returns `200 []` (no row), so anonymous clients can verify an exact code but cannot enumerate certificates.
- **Evidence — RLS enforced (publishable key vs secret key, `SELECT … limit 1`, 2026-10-11):**

  | Table | Publishable (anon) | Secret (service) | Interpretation |
  | ----- | ------------------ | ---------------- | -------------- |
  | `profiles` | `200 []` | `206` count `2` | RLS hides rows from anon |
  | `user_roles` | `200 []` | `206` count `2` | RLS hides rows from anon |
  | `courses` | `200`, rows returned | `206` count `6` | Intended public read |
  | `course_categories` | `200`, rows returned | — | Intended public read |
  | `course_enrollments`, `lesson_progress`, `lesson_content`, `startup_applications`, `consultation_requests`, `contact_messages`, `startup_reviews`, `service_inquiries` | `200 []` | — | No rows leaked to anon |

- **Evidence — grants deny anon:** `payment_requests`, `certificates`, `live_sessions`, `api_rate_limits` return `401` with `42501 permission denied for table …` to the publishable key.
- **Evidence — Storage:** publishable-key `GET /storage/v1/bucket` → `[]`; publishable-key object `list` on the private `certificates` bucket → `200 []` (bucket exists, no objects exposed).
- **Evidence — migration state (RESOLVED 2026-10-11):** `GET /rest/v1/admin_audit_log` with the publishable key now returns `401 42501 permission denied for table admin_audit_log` (was `404 PGRST205`). The five pending migrations were applied via `supabase db push --linked`; `supabase migration list --linked` now shows all local migrations matching remote. Verified via Management API SQL: `admin_audit_log` has `relrowsecurity = true`, policy `"Admins can read the audit log"` (SELECT, `authenticated`, `is_admin()`), `authenticated` = SELECT-only grant, `anon` = none, and `purge_admin_audit_log(integer)` is `SECURITY DEFINER` executable only by `service_role`.
- **Still not exhaustively verified:** a full per-policy diff of all 62 policies against the migration sources; the newly applied `course-content` storage, lessons, and payment-RPC objects were spot-checked and match.
- **Steps (remaining):** optionally run `select tablename, rowsecurity from pg_tables where schemaname='public' and rowsecurity=false;` (expect no app tables) and diff `pg_policies` against source.
- **Related finding:** F-15.

## X-07 — Hosting TLS

- **Status:** PARTIAL.
- **Evidence (live):** Direct handshake to `zlmbitphlzokjmfwldcb.supabase.co:443` negotiated **TLS 1.3** with a valid certificate (`CN=supabase.co`, issuer `Google Trust Services WE1`, ECDSA-SHA256, valid to 2026-11-24). The Supabase dependency is transported over strong TLS.
- **Not verified:** The **application's** production origin. `NEXT_PUBLIC_SITE_URL` in `.env.local` is `localhost`, and no deployed app origin was available, so edge TLS/HSTS for the app could not be checked.
- **Steps:** Against the production origin run `openssl s_client -connect <host>:443 -servername <host>` plus a scanner (SSL Labs / `nmap --script ssl-enum-ciphers`). Expect TLS 1.2+ (1.3 preferred), no weak ciphers, HSTS `max-age>=63072000; includeSubDomains; preload` (the app emits this header in `next.config.mjs`).
- **Related finding:** F-22.

## X-08 — Edge proxy client-IP headers

- **Status:** NOT VERIFIED.
- **Related note (2026-10-11):** the Supabase auth config reports `security_sb_forwarded_for_enabled = false`, so Supabase is not emitting an `sb-forwarded-for` client-IP header. The app relies on the hosting/CDN edge (`x-real-ip`/`cf-connecting-ip`), which is still unverified.
- **Steps:** Send a request to a rate-limited endpoint with a spoofed `x-real-ip` and confirm the proxy **replaces** it; inspect the proxy/CDN "preserve client IP" setting.
- **Expected:** The edge overwrites `x-real-ip`/`cf-connecting-ip` with the true client IP; the app is fail-closed (`lib/api/rateLimit.ts`) and returns 503 in production when no trusted IP resolves.
- **Evidence:** Proxy config screenshot plus a request/response showing the header is overwritten.
- **Related finding:** F-10.

## X-09 — Production secrets

- **Status:** PARTIAL. Local `.env.local` verified; the **production/CI runtime** is NOT VERIFIED.
- **Evidence (local, presence only):** all required variables are `CONFIGURED` in `.env.local`:

  | Variable | Local |
  | -------- | ----- |
  | `NEXT_PUBLIC_SUPABASE_URL` | CONFIGURED |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | CONFIGURED |
  | `SUPABASE_SERVICE_ROLE_KEY` | CONFIGURED |
  | `NEXT_PUBLIC_SITE_URL` | CONFIGURED (localhost — must be the real origin in production) |
  | `RESEND_API_KEY` | CONFIGURED |
  | `RESEND_FROM_EMAIL` | CONFIGURED |
  | `RATE_LIMIT_TRUSTED_IP_HEADERS` | NOT CONFIGURED (optional override) |

- **Evidence (Supabase project secrets, names only, 2026-10-11):** `GET /v1/projects/<ref>/secrets` returns the 7 Supabase-managed entries (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`). The app's own runtime variables (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`) are **not** project secrets — they must live in the hosting platform, which was not inspected.

- **Steps:** In the hosting/CI environment, verify presence (not values) of the same variables; confirm `NEXT_PUBLIC_SITE_URL` is the production origin and `SUPABASE_SERVICE_ROLE_KEY` is server-only (never `NEXT_PUBLIC_`).
- **Evidence:** A presence checklist (`CONFIGURED`/`NOT CONFIGURED`), never the values.
- **Related finding:** F-29.

## X-10 — Dependency audit on the deployed set

- **Status:** PARTIAL. Verified on the local lockfile; the deployed set is assumed identical.
- **Evidence (2026-10-11):** `npm audit --omit=dev` → **0 vulnerabilities**; `npm audit` → **9 advisories (2 moderate, 7 high)**, all in dev/build tooling (Tailwind/PostCSS/eslint chain).
- **Classification (Batch 8C):** all 9 are aggregator effects of two underlying advisories, both **dev/build-only** and not present in the runtime tree (`--omit=dev` is clean):
  - `braces <=3.0.3` — stack-exhaustion DoS via deeply nested patterns (HIGH; reached via `micromatch`/`chokidar` in the `eslint-config-next` and `tailwindcss` chains). Runs only on trusted, in-repo globs during lint/build/watch.
  - `postcss-selector-parser <7.1.6` (PostCSS) — quadratic-complexity CPU exhaustion parsing flat selectors (MODERATE), via `tailwindcss` → `postcss-nested`. CSS is authored in-repo, not attacker-supplied at runtime.
  - **Runtime risk: LOW.** No attacker-controlled input reaches these packages in production.
  - **Fix:** `npm audit fix` resolves to semver-**major** bumps (`eslint-config-next`, `tailwindcss`); deferred as unrelated churn to be handled in a dedicated dependency-maintenance change, not silently forced here.
- **Steps:** Run `npm audit --omit=dev` against the exact lockfile deployed (or a `npm ci` in the deploy image) and confirm the runtime tree is clean.

## X-11 — Deployed schema parity with `main`

- **Status:** **PASS** (resolved 2026-10-11).
- **Resolution:** the remote ledger was out of sync by five migrations; all five were applied with `supabase db push --linked` (CLI stored credential) in timestamp order. `supabase migration list --linked` now shows all local migrations matching remote.
- **Evidence (post-apply):** `GET /rest/v1/admin_audit_log` with the publishable key → `401 42501 permission denied for table admin_audit_log` (was `404 PGRST205`); Management API SQL confirms the table exists with `relrowsecurity = true`, the admin-read policy, correct grants, and the `SECURITY DEFINER` retention function executable only by `service_role`. See `docs/security/migration-deployment-plan.md` §5 for the full checklist.
- **Residual:** exercise one authorized admin action end-to-end to confirm a row is written (requires a running app + admin session; not done here to avoid writing synthetic rows to the live log).
- **Related findings:** F-15, F-27.

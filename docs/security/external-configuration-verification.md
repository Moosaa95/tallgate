# External Configuration Verification — TallGate

- **Scope:** security-relevant settings that live outside this repository (Supabase project, hosting/CDN/proxy, email provider).
- **Method (revised 2026-10-11):** In addition to source review, a set of **read-only** checks was run against the linked Supabase project using the credentials in the local `.env.local`. No writes, no auth flows, and no data modifications were performed, and no secret values were printed. See [Verification environment](#verification-environment).
- **Batch 8B note (2026-10-11):** no dashboard, management-API, CLI, or production-origin access was available, so X-01, X-03, X-05, X-07 (app host) and X-08 could not be re-verified and remain `NOT VERIFIED`; the manual steps below are the required next action. X-09 remains `PARTIAL` (local runtime verified, production runtime not).
- **Rule:** Do not record secret values here. For environment variables, record only `CONFIGURED` / `NOT CONFIGURED` (presence), never their contents.
- **`NOT VERIFIED` ≠ safe.** These items indicate missing evidence, not an absence of risk.

## Verification environment

| Property | Value |
| -------- | ----- |
| Date of checks | 2026-10-11 |
| Project (Supabase ref) | `zlmbitphlzokjmfwldcb` (name `tallgate`), linked in `supabase/.temp/` |
| Credentials used | Local `.env.local` (`sb_publishable_…` / `sb_secret_…` new-format keys); presence only, values not recorded |
| Checks performed | `GET /auth/v1/settings`, `GET /auth/v1/health`, PostgREST `SELECT … limit 1` with the publishable key, a compared `SELECT` with the secret key, Storage `bucket` list + object `list`, and a direct TLS handshake |
| Explicitly not performed | No `INSERT`/`UPDATE`/`DELETE`, no sign-in/sign-up/OAuth initiation, no migration apply, no dashboard changes, no penetration testing |

> This is a **configuration and source review**, not a penetration test or certification. `PASS`/`PARTIAL` here reflect the checks listed above only.

## Status summary

| ID | Area | Status | Evidence type |
| -- | ---- | ------ | ------------- |
| X-01 | Supabase Auth — redirect allow-list | NOT VERIFIED | Dashboard required |
| X-02 | Supabase Auth — OAuth providers | PASS | Live read-only |
| X-03 | Supabase Auth — JWT verification & signing keys | NOT VERIFIED | Management API / dashboard required |
| X-04 | Supabase Auth — MFA, session lifetime, password policy | PARTIAL | Live read-only + dashboard for the rest |
| X-05 | Email templates point at `/auth/callback` (cross-device) | NOT VERIFIED | Dashboard required |
| X-06 | RLS / grants / Storage policies / migration state | PARTIAL | Live read-only + dashboard for the rest |
| X-07 | Hosting TLS | PARTIAL | Live read-only (Supabase host) + app origin unavailable |
| X-08 | Edge proxy overrides trusted client-IP headers | NOT VERIFIED | Proxy/CDN config required |
| X-09 | Production secrets present in the runtime environment | PARTIAL | Local `.env.local` only; production runtime unverified |
| X-10 | `npm audit` on the deployed dependency set | PARTIAL | Local lockfile only |
| X-11 | Deployed schema parity with `main` | **FAIL** | Live read-only |

See `docs/security/migration-deployment-plan.md` for the X-06/X-11 root-cause analysis and the safe apply/verify plan.

---

## X-01 — Supabase Auth redirect allow-list

- **Status:** NOT VERIFIED — the allow-list is not exposed by any read-only API.
- **Steps:** Supabase Dashboard → Authentication → URL Configuration. Check **Site URL** and **Redirect URLs**.
- **Expected:** Site URL is the production origin (not `localhost`). Redirect URLs contain only the app's own `https://<prod-domain>/auth/callback`. No wildcards that match attacker-controlled hosts.
- **Why:** An over-broad redirect allow-list enables token/`code` redirection to an attacker. The app validates `next` internally (`lib/auth/redirect.ts`), but the provider-side list is an independent control.
- **Evidence to capture:** Screenshot/export of the URL Configuration screen (redact anything sensitive).
- **Note:** No OAuth providers are enabled (see X-02), so the main redirect consumer today is email-link `redirect_to`; the allow-list still governs it.
- **Related finding:** F-19.

## X-02 — OAuth providers

- **Status:** PASS (live read-only).
- **Evidence:** `GET /auth/v1/settings` on 2026-10-11 returned `external` with **every** provider `false` except `email: true` (`google: false`, `github: false`, `azure`, `apple`, `gitlab`, etc. all false), `anonymous_users: false`, `saml_enabled: false`. The sign-in page uses only `supabase.auth.signInWithPassword` (`app/(auth)/login/page.tsx`); no `signInWithOAuth` exists in the codebase.
- **Assessment:** No unexpected identity provider is enabled and the app exposes no OAuth surface, so there is no provider-side OAuth exposure. If Google/GitHub sign-in is a product requirement it is currently **not implemented and not enabled**.
- **Related finding:** F-19.

## X-03 — JWT verification & signing keys

- **Status:** NOT VERIFIED.
- **Steps:** Supabase Dashboard → Authentication → Configuration (JWT settings / signing keys). Confirm asymmetric JWT signing keys, or that a strong secret is used and rotated per policy.
- **Expected:** Tokens are verified with a known algorithm; no custom token issuance in app code (verified in-repo: none; `lib/database/server`, `lib/database/client` delegate entirely to `@supabase/*`).
- **Evidence note:** The local project uses the new-format API keys (`sb_publishable_…`, `sb_secret_…`), i.e. the app key is no longer a decodable JWT; the signing-key type is only visible via the management API/dashboard.
- **Related finding:** F-17.

## X-04 — MFA, session lifetime, password policy

- **Status:** PARTIAL (live read-only).
- **Evidence (live, 2026-10-11):** `GET /auth/v1/settings` returned `disable_signup: false` (open sign-up), `mailer_autoconfirm: true` (email auto-confirm **on** — see X-05), `phone_autoconfirm: false`, `sms_provider: "twilio"`, `passkeys_enabled: false`, `saml_enabled: false`, `external.anonymous_users: false`, `external.phone: false`, `external.email: true`. `saml_private_key_next_configured: true`, but SAML is disabled so no SAML surface is enabled. `/auth/v1/health` reports GoTrue `v2.197.0` healthy.
- **Not exposed by the API (dashboard required):** MFA enforcement, refresh-token lifetime, idle timeout.
- **Steps:** Authentication → Policies / Sessions; record refresh-token lifetime, idle timeout and MFA enforcement (screenshots). MFA for admin accounts if the plan permits.
- **App-side policy:** password minimum is 8 and maximum 128 (`lib/auth/registration.ts`), enforced client- and server-side.
- **Related findings:** F-13, F-14.

## X-05 — Email templates and cross-device confirmation

- **Status:** NOT VERIFIED (template bodies are dashboard-only).
- **Steps:** Authentication → Email Templates. Confirm Confirmation, Invite, Magic Link and Recovery templates use `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` (and `type=recovery` with `next=/reset-password`). The default `{{ .ConfirmationURL }}` only works in the originating browser.
- **Live caveat:** `mailer_autoconfirm: true` means new sign-ups do **not** receive or require a confirmation email, so the cross-device confirmation path is currently not exercised for sign-up. This is a real posture choice worth confirming as intentional (see F-31).
- **Evidence:** Template screenshots.
- **Related finding:** F-11.

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
- **Evidence — migration state (finding):** `GET /rest/v1/admin_audit_log` returns `404 PGRST205 "Could not find the table 'public.admin_audit_log' in the schema cache"`. The deployment is therefore **one migration behind `main`**: `20261011000000_admin_audit_log.sql` (commit `341bd16`) has **not** been applied. Every other migration's table was present.
- **Not verified:** exact per-policy parity with the migration sources (would require `pg_policies`/`pg_tables` access via the SQL editor or a DB connection), and confirming the `admin_audit_log` policy after it is applied.
- **Steps:** Apply the pending migration in the README order, then in the SQL editor run:
  - `select tablename, rowsecurity from pg_tables where schemaname = 'public' and rowsecurity = false;` — expect **no rows** for app tables.
  - `select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename;` — compare against source.
- **Related finding:** F-15.

## X-07 — Hosting TLS

- **Status:** PARTIAL.
- **Evidence (live):** Direct handshake to `zlmbitphlzokjmfwldcb.supabase.co:443` negotiated **TLS 1.3** with a valid certificate (`CN=supabase.co`, issuer `Google Trust Services WE1`, ECDSA-SHA256, valid to 2026-11-24). The Supabase dependency is transported over strong TLS.
- **Not verified:** The **application's** production origin. `NEXT_PUBLIC_SITE_URL` in `.env.local` is `localhost`, and no deployed app origin was available, so edge TLS/HSTS for the app could not be checked.
- **Steps:** Against the production origin run `openssl s_client -connect <host>:443 -servername <host>` plus a scanner (SSL Labs / `nmap --script ssl-enum-ciphers`). Expect TLS 1.2+ (1.3 preferred), no weak ciphers, HSTS `max-age>=63072000; includeSubDomains; preload` (the app emits this header in `next.config.mjs`).
- **Related finding:** F-22.

## X-08 — Edge proxy client-IP headers

- **Status:** NOT VERIFIED.
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

- **Status:** **FAIL** (live read-only).
- **Evidence:** `GET /rest/v1/admin_audit_log` returns `404 PGRST205` to **both** the publishable and secret keys, while all other recent migration tables resolve; the OpenAPI table inventory (`GET /rest/v1/`) lists **20** tables and omits `admin_audit_log`. The deployed database is one migration behind `main`: `20261011000000_admin_audit_log.sql` (commit `341bd16`) is not applied.
- **Impact:** the admin audit path writes nothing in that environment (the helper fails soft, so admin actions still succeed but are not recorded).
- **Resolution:** `docs/security/migration-deployment-plan.md` — apply the pending migration through the approved process with authorization, then verify per that plan.
- **Related findings:** F-15, F-27.

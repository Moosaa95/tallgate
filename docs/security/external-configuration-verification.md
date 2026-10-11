# External Configuration Verification — TallGate

- **Scope:** security-relevant settings that live outside this repository (Supabase project, hosting/CDN/proxy, email provider).
- **Method:** No live environment, Supabase project, or hosting dashboard was available in this review, so every item below is **NOT VERIFIED**. Each entry states the exact manual step, the expected secure value, and how to capture evidence.
- **Rule:** Do not record secret values here. For environment variables, record only `CONFIGURED` / `NOT CONFIGURED` (presence), never their contents.
- **`NOT VERIFIED` ≠ safe.** These items indicate missing evidence, not an absence of risk.

## Status summary

| ID | Area | Status |
| -- | ---- | ------ |
| X-01 | Supabase Auth — redirect allow-list | NOT VERIFIED |
| X-02 | Supabase Auth — OAuth providers (Google, GitHub) | NOT VERIFIED |
| X-03 | Supabase Auth — JWT verification & signing keys | NOT VERIFIED |
| X-04 | Supabase Auth — MFA, session lifetime, password policy | NOT VERIFIED |
| X-05 | Email templates point at `/auth/callback` (cross-device) | NOT VERIFIED |
| X-06 | Row Level Security / grants / Storage policies applied to the deployed DB | NOT VERIFIED |
| X-07 | Hosting TLS (versions, ciphers, HSTS at the edge) | NOT VERIFIED |
| X-08 | Edge proxy overrides trusted client-IP headers | NOT VERIFIED |
| X-09 | Production secrets present in the runtime environment | NOT VERIFIED |
| X-10 | `npm audit` re-run against the deployed dependency set | NOT VERIFIED |

---

## X-01 — Supabase Auth redirect allow-list

- **Steps:** Supabase Dashboard → Authentication → URL Configuration. Check **Site URL** and **Redirect URLs**.
- **Expected:** Site URL is the production origin (not `localhost`). Redirect URLs contain only the app's own `https://<prod-domain>/auth/callback` (and the same path on any preview domains you actually serve). No wildcards that match attacker-controlled hosts.
- **Why:** An over-broad redirect allow-list enables token/`code` redirection to an attacker (ASVS 5.1). The app already validates `next` internally (`lib/auth/redirect.ts`), but the provider-side list is a second, independent control.
- **Evidence to capture:** Screenshot or export of the URL Configuration screen (redact any secrets).
- **Related finding:** F-19.

## X-02 — OAuth providers

- **Steps:** Authentication → Providers. Confirm Google and GitHub are configured with the correct client IDs/secrets and the callback URLs the dashboard shows.
- **Expected:** Only the providers the product actually supports are enabled; each provider's authorized redirect URI points at the Supabase project's `https://<ref>.supabase.co/auth/v1/callback`, not directly at the app.
- **Evidence:** Provider configuration screenshots (redact client secrets).
- **Related finding:** F-19.

## X-03 — JWT verification & signing keys

- **Steps:** Authentication → Configuration (JWT settings / signing keys). Confirm the project is on asymmetric signing keys (JWT signing keys) or that the JWT secret is strong and rotated per policy.
- **Expected:** Tokens are verified with a known algorithm; `alg` confusion is not possible. No custom token issuance in app code (verified in-repo: none).
- **Evidence:** Signing-key configuration screen; note the algorithm and rotation date only.
- **Related finding:** F-17.

## X-04 — MFA, session lifetime, password policy

- **Steps:** Authentication → Policies / Sessions. Record the refresh-token lifetime, idle timeout, and any MFA enforcement.
- **Expected:** Session lifetime and re-authentication expectations are documented here and reflected in `docs/security/` (see F-14). MFA is enabled for admin accounts if the plan permits.
- **Evidence:** Screenshots of the session/policy settings; a short prose summary added to this repo.
- **Related findings:** F-13, F-14.

## X-05 — Email templates and cross-device confirmation

- **Steps:** Authentication → Email Templates. Confirm Confirmation, Invite, Magic Link and Recovery templates use the cross-device callback URL.
- **Expected:** `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` (and `type=recovery` with `next=/reset-password` for recovery). The default `{{ .ConfirmationURL }}` only works in the originating browser and defeats the app's `verifyOtp` path.
- **Evidence:** Template screenshots.
- **Related finding:** F-11.

## X-06 — RLS, grants and Storage policies on the deployed database

- **Steps:** Apply migrations in the README order to the target project, then in the SQL editor:
  - `select tablename, rowsecurity from pg_tables where schemaname = 'public' and rowsecurity = false;` — expect **no rows** for app tables.
  - `select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename;` — compare against the source migrations.
  - For Storage: confirm `storage.objects` policies for the `certificates` and course-content buckets match the migrations.
- **Expected:** Every app table has RLS enabled with policies matching the migrations; the `admin_audit_log` table allows SELECT to `authenticated` (admins only) and no client writes.
- **Evidence:** Query output (schema/policy names only; no row data).
- **Related finding:** F-15.

## X-07 — Hosting TLS

- **Steps:** Against the production origin run
  `openssl s_client -connect <host>:443 -servername <host> </dev/null 2>/dev/null | openssl x509 -noout -dates` and a TLS scanner (e.g. SSL Labs) or `nmap --script ssl-enum-ciphers -p 443 <host>`.
- **Expected:** TLS 1.2+ (TLS 1.3 preferred), no weak ciphers/protocols, HSTS present with `max-age>=63072000; includeSubDomains; preload`.
- **Evidence:** Scanner report URL/summary.
- **Related finding:** F-22.

## X-08 — Edge proxy client-IP headers

- **Steps:** Send a request to a rate-limited endpoint with a spoofed `x-real-ip` and confirm the proxy replaces it. Check the proxy/CDN configuration ("preserve/overwrite client IP").
- **Expected:** The edge overwrites `x-real-ip`/`cf-connecting-ip` with the true client IP; the app's fail-closed behaviour (`lib/api/rateLimit.ts`) rejects requests with no resolvable IP in production (503).
- **Evidence:** Proxy config screenshot plus a request/response showing the header is overwritten.
- **Related finding:** F-10.

## X-09 — Production secrets

- **Steps:** In the hosting/CI environment, verify presence (not values) of: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, and any rate-limit key/`RATE_LIMIT_TRUSTED_IP_HEADERS` overrides.
- **Expected:** All required variables are `CONFIGURED`; `NEXT_PUBLIC_SITE_URL` is the production origin; `SUPABASE_SERVICE_ROLE_KEY` is server-only (never `NEXT_PUBLIC_`).
- **Evidence:** A presence checklist (`CONFIGURED`/`NOT CONFIGURED`), never the values.
- **Related finding:** F-29.

## X-10 — Dependency audit on the deployed set

- **Steps:** Run `npm audit --omit=dev` (and `npm audit` for the full tree) on the exact lockfile that was deployed.
- **Expected:** No vulnerabilities in runtime dependencies; dev/build advisories tracked (F-26).
- **Evidence:** Command output summary.

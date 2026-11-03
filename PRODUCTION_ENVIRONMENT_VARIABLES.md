# TallGate — Production Environment Variable Inventory

**Audit Scope:** Full codebase scan across `app/`, `lib/`, `components/`, `next.config.mjs`, and `instrumentation.ts`.  
**Security Standard:** Strict zero-secret policy. Placeholders only.  

---

## 1. Master Environment Variable Table

| Variable Name | Scope | Requirement | Phase Required | Purpose & Description | Fallback / Behavior if Missing | Code References |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Public** | **Required** (Critical) | **Build-Time & Runtime** | Supabase Project API URL. Public by design; inlined into client bundle during build and used by server clients. | Fails fast via `assertCriticalEnv()` in `instrumentation.ts`; build warning in `next.config.mjs`. | `lib/config/env.ts`, `lib/supabase/*`, `next.config.mjs` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Public** | **Required** (Critical) | **Build-Time & Runtime** | Browser-safe Supabase anon key for public requests and authentication session handshakes. | Fails fast via `assertCriticalEnv()`; client queries fail. | `lib/config/env.ts`, `lib/supabase/*`, `next.config.mjs` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** (Secret) | **Required** (Critical) | **Runtime Only** | Elevated service role key bypassing Row Level Security (RLS) for admin actions, certificate storage, and rate limiting. | Fails fast via `assertCriticalEnv()`; admin dashboard, rate limiter, and public forms fail. | `lib/config/env.ts`, `lib/supabase/admin.ts`, `lib/api/rateLimit.ts` |
| `NEXT_PUBLIC_SITE_URL` | **Public** | **Required** (Critical) | **Build-Time & Runtime** | Canonical origin URL of the live site (must be `https://tallgateltd.com`). Used for certificate QR verification links and metadata. | Fails fast via `assertCriticalEnv()`; verification URLs break if missing or localhost. | `lib/config/env.ts`, `lib/certificates/issueCertificate.ts`, `lib/config/site.ts` |
| `RESEND_API_KEY` | **Server-Only** (Secret) | **Optional** | **Runtime Only** | API Key for Resend transactional email service. | Warning logged in `next.config.mjs`. `POST /api/email` returns HTTP 503; does not crash server. | `app/api/email/route.ts`, `app/(admin)/admin/settings/page.tsx`, `next.config.mjs` |
| `RESEND_FROM_EMAIL` | **Server-Only** (Config) | **Optional** | **Runtime Only** | Verified sender email address formatted as `TallGate <noreply@tallgateltd.com>`. | If omitted, `POST /api/email` returns HTTP 503 (no unsafe default assumed). | `app/api/email/route.ts` |
| `RATE_LIMIT_TRUSTED_IP_HEADERS` | **Server-Only** (Config) | **Optional** | **Runtime Only** | Comma-separated list of proxy headers to inspect for client IP. Default: `"x-real-ip,cf-connecting-ip"`. | Defaults to `"x-real-ip,cf-connecting-ip"`. Safe behind Apache/DirectAdmin. | `lib/api/rateLimit.ts` |
| `LOG_LEVEL` | **Server-Only** (Config) | **Optional** | **Runtime Only** | Application log level threshold (`debug`, `info`, `warn`, `error`). | Defaults to `"info"` when `NODE_ENV === "production"`. | `lib/logging/logger.ts` |
| `NODE_ENV` | **System / Server** | **Automatic** | **Build-Time & Runtime** | Environment mode (`production` vs `development`). | Managed automatically by DirectAdmin "Application mode" selector (`Production`). | Ubiquitous across codebase |
| `PORT` | **System / Server** | **Automatic** | **Runtime Only** | Port or Unix Domain Socket path provided dynamically by Passenger. | Defaults to `3000` locally; dynamically overridden by Passenger. | `next start` / `server.js` |

---

## 2. Configuration Methodology for HostAfrica DirectAdmin

DirectAdmin provides an **Environment variables** section inside the **Setup Node.js App** management panel. 

### Why DirectAdmin UI Injection is Recommended
1. **Security Isolation:** DirectAdmin injects variables directly into the Node process via Passenger without creating a world-readable `.env` file on disk.
2. **Persistence across Restarts:** Variables added in the UI persist across CloudLinux worker spawns and server reboots.
3. **Build vs Runtime Distinction:**
   - **`NEXT_PUBLIC_` variables:** Next.js embeds all `NEXT_PUBLIC_*` values directly into the client-side JavaScript bundles **at build time** (`npm run build`). Therefore, if the application is compiled on the server, `NEXT_PUBLIC_*` variables must be present in the shell environment during `npm run build`.
   - **Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`):** These are never bundled into client JavaScript. They are read dynamically from `process.env` at runtime when requests are processed.

---

## 3. Production Values Template (For DirectAdmin UI)

```ini
# Canonical Site URL (Public)
NEXT_PUBLIC_SITE_URL=https://tallgateltd.com

# Supabase Production Backend (Public)
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-production-anon-key>

# Supabase Admin Secret (Server-Only — Keep Secret)
SUPABASE_SERVICE_ROLE_KEY=<your-production-service-role-key>

# Resend Transactional Email (Server-Only — Keep Secret)
RESEND_API_KEY=<your-production-resend-key>
RESEND_FROM_EMAIL=TallGate <noreply@tallgateltd.com>

# Reverse Proxy IP Header Configuration (Optional)
RATE_LIMIT_TRUSTED_IP_HEADERS=x-forwarded-for,x-real-ip
LOG_LEVEL=info
```


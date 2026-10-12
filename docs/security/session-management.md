# Session management

Scope: how authentication sessions are stored, protected, and expired for the
Tallgate web app. Captures the decisions behind ASVS items **F-13** and **F-14**.

## Cookie attributes (F-13)

Supabase SSR persists the session in cookies via `lib/supabase/cookieOptions.ts`:

| Attribute  | Value                                   | Rationale |
| ---------- | --------------------------------------- | --------- |
| `path`     | `/`                                     | Session applies to the whole app |
| `sameSite` | `lax`                                   | Blocks cross-site POST/CSRF while keeping top-level redirect logins working |
| `secure`   | `true` in production, `false` locally   | Never sent over plaintext HTTP in production |
| `httpOnly` | **not set (false)**                     | Deliberate: the browser Supabase client must read the token to refresh the session |

### Accepted trade-off: `httpOnly` is false

The `@supabase/ssr` default keeps auth cookies readable from JavaScript because
the browser client refreshes the session and attaches tokens to PostgREST calls
directly. This means an XSS bug could read the session token.

Compensating controls in place:

- The Content Security Policy is enforced in production, but `script-src` still
  allows `'unsafe-inline'` (F-07, `PARTIAL`). A strict `script-src` is not
  currently achievable: nonces require full dynamic rendering, and
  `experimental.sri` only stamps `integrity` on external bundles while every
  streamed page still emits inline `self.__next_f.push` scripts (upstream
  vercel/next.js#95353 / #95354). **CSP therefore does not block injected inline
  scripts today**, so it is not a mitigation for the readable-token risk.
- The XSS surface is kept small: no inline `<script>`, `next/script`,
  `dangerouslySetInnerHTML`, or JSON-LD is used in the application.
- Server-side authorization re-checks the user on every protected request
  (`proxy.ts` session refresh + per-route Supabase calls); a stolen token still
  cannot exceed that user's RLS-scoped access.

Revisit if the app adopts a server-only session pattern (all auth reads via
route handlers / server components with an `httpOnly` cookie). That is a larger
change and is intentionally out of scope here.

## Session lifetime (F-14)

- **Idle timeout / absolute lifetime** are managed by the hosted Supabase Auth
  project, not by application code. The app inherits GoTrue defaults: access
  tokens are short-lived and refreshed by refresh tokens, which have a longer
  absolute lifetime.
- **Current configured values (read-only Management API, 2026-10-11):**
  - `jwt_exp = 3600` — access tokens live 1 hour.
  - `refresh_token_rotation_enabled = true`, `security_refresh_token_reuse_interval = 10` — refresh tokens rotate on use with a 10s reuse window.
  - `sessions_inactivity_timeout = 0` and `sessions_timebox = 0` — **no** idle or absolute expiry configured.
  - `sessions_single_per_user = false` — multiple concurrent sessions are allowed.
  These apply to the linked project `zlmbitphlzokjmfwldcb`; confirm it is the intended production project and re-read after any change.
- **Re-authentication:** protected routes redirect unauthenticated or expired
  sessions to `/login` via `lib/supabase/middleware.ts`. Password recovery and
  email confirmation flows are handled by Supabase Auth.
- **Sign-out:** the browser client calls `supabase.auth.signOut()`, which clears
  the refresh/access cookies for the `path=/` cookie scope.

## Verification checklist (deployment)

1. ~~Record the hosted refresh-token lifetime and time-boxing~~ — **done 2026-10-11** (values above). Decide whether to enable an inactivity timeout / time-box (currently both `0`).
2. Confirm cookies in a production browser are `Secure`, `SameSite=Lax`, and
   scoped to `path=/`.
3. Confirm logout clears the `sb-*` auth cookies and a protected route then
   redirects to `/login`.

/**
 * Fail-fast validation for the environment variables the server cannot run
 * without. Only presence/absence is inspected — values are never logged.
 */

export const CRITICAL_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
] as const

export type CriticalEnvVar = (typeof CRITICAL_ENV_VARS)[number]

export function missingCriticalEnv(
  env: Record<string, string | undefined> = process.env
): CriticalEnvVar[] {
  return CRITICAL_ENV_VARS.filter((name) => {
    const value = env[name]
    return value === undefined || value.trim() === ""
  })
}

export function assertCriticalEnv(
  env: Record<string, string | undefined> = process.env
): void {
  const missing = missingCriticalEnv(env)

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Set them for the running server (see .env.example)."
    )
  }
}

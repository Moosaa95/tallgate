import { assertCriticalEnv } from "@/lib/config/env"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // `next build` runs in CI without runtime secrets; validation targets the
  // running server, so skip the build phase and non-production runtimes.
  if (process.env.NEXT_PHASE === "phase-production-build") return
  if (process.env.NODE_ENV !== "production") return

  assertCriticalEnv()
}

import { describe, expect, it } from "vitest"
import { assertCriticalEnv, missingCriticalEnv } from "@/lib/config/env"

const completeEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  NEXT_PUBLIC_SITE_URL: "https://example.com",
}

describe("missingCriticalEnv", () => {
  it("returns nothing when every critical variable is set", () => {
    expect(missingCriticalEnv(completeEnv)).toEqual([])
  })

  it("treats blank/whitespace values as missing", () => {
    expect(
      missingCriticalEnv({ ...completeEnv, SUPABASE_SERVICE_ROLE_KEY: "   " })
    ).toEqual(["SUPABASE_SERVICE_ROLE_KEY"])
  })

  it("lists absent variables in declaration order", () => {
    expect(missingCriticalEnv({})).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_SITE_URL",
    ])
  })
})

describe("assertCriticalEnv", () => {
  it("throws naming only the missing variables, never their values", () => {
    const secretValue = "super-secret-service-key"
    const env = { ...completeEnv, SUPABASE_SERVICE_ROLE_KEY: "", EXTRA: secretValue }

    let message = ""
    try {
      assertCriticalEnv(env)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toContain("SUPABASE_SERVICE_ROLE_KEY")
    expect(message).not.toContain(secretValue)
  })

  it("does not throw when configuration is complete", () => {
    expect(() => assertCriticalEnv(completeEnv)).not.toThrow()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}))

import { checkRateLimit, RateLimitUnavailableError } from "@/lib/api/rateLimit"

const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://tallgate.test/api/test", { headers })
}

describe("checkRateLimit identity resolution", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
    rpc.mockReset()
    rpc.mockResolvedValue({ data: true, error: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (ORIGINAL_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY
  })

  it("fails closed when the service role key is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(
      checkRateLimit(request(), "verification", 5, 60)
    ).rejects.toBeInstanceOf(RateLimitUnavailableError)
  })

  it("fails closed in production when no trusted IP header is present", async () => {
    vi.stubEnv("NODE_ENV", "production")
    await expect(
      checkRateLimit(request(), "verification", 5, 60)
    ).rejects.toBeInstanceOf(RateLimitUnavailableError)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("consumes the limit using a trusted proxy header in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const allowed = await checkRateLimit(
      request({ "x-real-ip": "203.0.113.5" }),
      "verification",
      5,
      60
    )
    expect(allowed).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("prefers an explicit identity over the client IP", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const allowed = await checkRateLimit(
      request(),
      "verification",
      5,
      60,
      "user-123"
    )
    expect(allowed).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("falls back to a fixed key outside production", async () => {
    vi.stubEnv("NODE_ENV", "test")
    const allowed = await checkRateLimit(request(), "verification", 5, 60)
    expect(allowed).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

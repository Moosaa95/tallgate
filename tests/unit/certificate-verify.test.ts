import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { createPublicClient, isSupabaseConfigured, rpcMock, checkRateLimit } = vi.hoisted(() => {
  const rpcMock = vi.fn()
  const createPublicClient = vi.fn(() => ({
    rpc: rpcMock,
  }))
  const isSupabaseConfigured = vi.fn(() => true)
  const checkRateLimit = vi.fn(async () => true)

  return {
    createPublicClient,
    isSupabaseConfigured,
    rpcMock,
    checkRateLimit,
  }
})

vi.mock("@/lib/supabase/server", () => ({
  createPublicClient,
  isSupabaseConfigured,
}))

vi.mock("@/lib/api/rateLimit", () => ({
  checkRateLimit,
  rateLimitResponse: vi.fn(),
  rateLimitUnavailableResponse: vi.fn(),
  RateLimitUnavailableError: class RateLimitUnavailableError extends Error {},
}))

import { GET } from "@/app/api/verify/route"

describe("Certificate Verification API (GET /api/verify)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSupabaseConfigured.mockReturnValue(true)
    checkRateLimit.mockResolvedValue(true)
  })

  it("rejects request when verification code is missing", async () => {
    const req = new NextRequest("https://tallgate.ng/api/verify")
    const res = await GET(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Code is required")
  })

  it("rejects malformed verification codes", async () => {
    const invalidCodes = ["abc", "code with spaces", "TG!", "a".repeat(70)]
    for (const code of invalidCodes) {
      const req = new NextRequest(`https://tallgate.ng/api/verify?code=${encodeURIComponent(code)}`)
      const res = await GET(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe("Invalid verification code format.")
    }
  })

  it("returns 404 NOT FOUND for unknown verification codes", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })

    const req = new NextRequest("https://tallgate.ng/api/verify?code=TG-2026-UNKNOWN00000")
    const res = await GET(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.status).toBe("not_found")
    expect(json.error).toBe("Certificate not found.")
  })

  it("returns VALID and public fields only for an active certificate", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          certificate_number: "TG/DH/01021/21",
          course_title: "Professional Telehealth & Digital Health Training Programme",
          issue_date: "2026-10-15",
          is_valid: true,
        },
      ],
      error: null,
    })

    const req = new NextRequest("https://tallgate.ng/api/verify?code=TG-2026-VALID0000001")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.status).toBe("valid")
    expect(json.certificate).toEqual({
      certificate_number: "TG/DH/01021/21",
      course_title: "Professional Telehealth & Digital Health Training Programme",
      issue_date: "2026-10-15",
      status: "valid",
    })

    // Verify sensitive/internal fields are never disclosed
    expect(json.certificate.recipient_name).toBeUndefined()
    expect(json.certificate.user_id).toBeUndefined()
    expect(json.certificate.storage_path).toBeUndefined()
    expect(json.certificate.verification_code).toBeUndefined()
  })

  it("returns REVOKED for a revoked certificate and never reports it as valid", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          certificate_number: "TG/DH/01021/21",
          course_title: "Professional Telehealth & Digital Health Training Programme",
          issue_date: "2026-10-15",
          is_valid: false,
        },
      ],
      error: null,
    })

    const req = new NextRequest("https://tallgate.ng/api/verify?code=TG-2026-REVOKED0001")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.status).toBe("revoked")
    expect(json.certificate.status).toBe("revoked")
  })
})

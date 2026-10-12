import { beforeEach, describe, expect, it, vi } from "vitest"

const { verifyOtp, exchangeCodeForSession, createClient } = vi.hoisted(() => {
  const verifyOtp = vi.fn()
  const exchangeCodeForSession = vi.fn()
  const createClient = vi.fn(async () => ({
    auth: { verifyOtp, exchangeCodeForSession },
  }))
  return { verifyOtp, exchangeCodeForSession, createClient }
})

vi.mock("@/lib/database/server", () => ({ createClient }))

import { GET } from "@/app/auth/callback/route"

const ORIGIN = "https://tallgate.test"

function callback(query = "") {
  return GET(new Request(`${ORIGIN}/auth/callback${query}`))
}

function locationOf(response: Response) {
  return response.headers.get("location")
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    verifyOtp.mockReset().mockResolvedValue({ error: null })
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
    createClient.mockClear()
  })

  describe("email token_hash flow", () => {
    it("verifies the token and redirects to the dashboard", async () => {
      const response = await callback("?token_hash=abc123&type=signup")
      expect(verifyOtp).toHaveBeenCalledWith({
        token_hash: "abc123",
        type: "signup",
      })
      expect(response.status).toBe(307)
      expect(locationOf(response)).toBe(`${ORIGIN}/dashboard`)
    })

    it("honours a safe next destination", async () => {
      const response = await callback(
        "?token_hash=abc123&type=magiclink&next=%2Fadmin"
      )
      expect(locationOf(response)).toBe(`${ORIGIN}/admin`)
    })

    it("skips verification when the type is missing or unknown", async () => {
      for (const query of [
        "?token_hash=abc123",
        "?token_hash=abc123&type=bogus",
      ]) {
        verifyOtp.mockClear()
        const response = await callback(query)
        expect(verifyOtp).not.toHaveBeenCalled()
        expect(locationOf(response)).toBe(`${ORIGIN}/login?error=auth`)
      }
    })

    it("redirects to login when verification fails and no code is present", async () => {
      verifyOtp.mockResolvedValue({ error: new Error("expired") })
      const response = await callback("?token_hash=abc123&type=signup")
      expect(locationOf(response)).toBe(`${ORIGIN}/login?error=auth`)
    })

    it("falls through to the code flow when token verification fails", async () => {
      verifyOtp.mockResolvedValue({ error: new Error("expired") })
      const response = await callback(
        "?token_hash=abc123&type=signup&code=pkce-code"
      )
      expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code")
      expect(locationOf(response)).toBe(`${ORIGIN}/dashboard`)
    })
  })

  describe("PKCE code flow", () => {
    it("exchanges the code and redirects to the dashboard", async () => {
      const response = await callback("?code=pkce-code")
      expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code")
      expect(verifyOtp).not.toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(locationOf(response)).toBe(`${ORIGIN}/dashboard`)
    })

    it("redirects to login when the exchange fails", async () => {
      exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") })
      const response = await callback("?code=pkce-code")
      expect(locationOf(response)).toBe(`${ORIGIN}/login?error=auth`)
    })
  })

  describe("missing or malformed parameters", () => {
    it("redirects to login when no credentials are supplied", async () => {
      const response = await callback()
      expect(verifyOtp).not.toHaveBeenCalled()
      expect(exchangeCodeForSession).not.toHaveBeenCalled()
      expect(locationOf(response)).toBe(`${ORIGIN}/login?error=auth`)
    })

    it("ignores an empty code", async () => {
      const response = await callback("?code=")
      expect(exchangeCodeForSession).not.toHaveBeenCalled()
      expect(locationOf(response)).toBe(`${ORIGIN}/login?error=auth`)
    })
  })

  describe("unsafe redirect destinations", () => {
    it.each([
      "https://evil.com",
      "//evil.com",
      "/admin/../..//evil.com",
      "javascript:alert(1)",
      "/login",
      "/login?error=auth",
      "/register",
    ])("falls back to the dashboard for next=%s", async (next) => {
      const response = await callback(
        `?token_hash=abc123&type=signup&next=${encodeURIComponent(next)}`
      )
      expect(locationOf(response)).toBe(`${ORIGIN}/dashboard`)
    })
  })
})

import { afterEach, describe, expect, it, vi } from "vitest"
import nextConfig from "../../next.config.mjs"

async function securityHeaders() {
  const rules = await nextConfig.headers?.()
  if (!rules) throw new Error("next.config.mjs did not define any header rules")
  expect(rules).toHaveLength(1)
  return new Map(rules[0].headers.map((header) => [header.key, header.value]))
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("security headers", () => {
  it("sets the baseline hardening headers on every route", async () => {
    const headers = await securityHeaders()

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.get("X-Frame-Options")).toBe("DENY")
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    expect(headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()")
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=")
  })

  it("enforces the Content-Security-Policy in production", async () => {
    vi.stubEnv("NODE_ENV", "production")

    const headers = await securityHeaders()

    expect(headers.has("Content-Security-Policy")).toBe(true)
    expect(headers.has("Content-Security-Policy-Report-Only")).toBe(false)
  })

  it("keeps the CSP report-only and dev-friendly while developing", async () => {
    vi.stubEnv("NODE_ENV", "development")

    const headers = await securityHeaders()
    const csp = headers.get("Content-Security-Policy-Report-Only") ?? ""

    expect(headers.has("Content-Security-Policy")).toBe(false)
    expect(csp).toContain("'unsafe-eval'")
  })

  it("locks down the production policy without broad sources", async () => {
    vi.stubEnv("NODE_ENV", "production")

    const csp = (await securityHeaders()).get("Content-Security-Policy") ?? ""

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("connect-src 'self' https://*.supabase.co")
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    // No wildcard scheme-host such as a bare `https:` in the image allow-list.
    expect(csp).not.toMatch(/img-src[^;]*\bhttps:([^/]|$)/)
  })
})

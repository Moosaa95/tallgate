import { describe, expect, it } from "vitest"
import QRCode from "qrcode"

describe("Certificate QR Code Generation & Verification URL format", () => {
  it("generates a high-contrast valid QR data URL containing the correct verification route", async () => {
    const siteUrl = "https://tallgate.ng"
    const verificationCode = "TG-2026-B8E5F7A912C4"
    const verificationUrl = new URL("/verify", siteUrl)
    verificationUrl.searchParams.set("code", verificationCode)
    const urlString = verificationUrl.toString()

    expect(urlString).toBe("https://tallgate.ng/verify?code=TG-2026-B8E5F7A912C4")

    const qrDataUrl = await QRCode.toDataURL(urlString, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    })

    expect(qrDataUrl.startsWith("data:image/png;base64,")).toBe(true)
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "")
    const pngBuffer = Buffer.from(base64Data, "base64")

    // PNG signature check
    expect(pngBuffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
    // Size check
    expect(pngBuffer.length).toBeGreaterThan(500)
  })

  it("handles verification URLs with query parameters correctly for verification route", () => {
    const testCases = [
      {
        site: "https://tallgate.ng",
        code: "TG-2026-1021",
        expected: "https://tallgate.ng/verify?code=TG-2026-1021",
      },
      {
        site: "https://academy.tallgate.com",
        code: "TG-2026-A1B2C3D4",
        expected: "https://academy.tallgate.com/verify?code=TG-2026-A1B2C3D4",
      },
    ]

    for (const { site, code, expected } of testCases) {
      const u = new URL("/verify", site)
      u.searchParams.set("code", code)
      expect(u.toString()).toBe(expected)

      // Test that the URL parameter parses back to code
      const parsed = new URL(u.toString())
      expect(parsed.pathname).toBe("/verify")
      expect(parsed.searchParams.get("code")).toBe(code)
    }
  })
})

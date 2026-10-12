import { describe, expect, it } from "vitest"
import { renderCertificatePdf } from "@/lib/certificates/generateCertificatePdf"

describe("renderCertificatePdf", () => {
  it("renders a real A4-landscape PDF for a synthetic fixture", async () => {
    const buffer = await renderCertificatePdf({
      recipient_name: "Fixture Recipient For Rendering Smoke Test",
      course_title: "Fixture Programme Title - Rendering Smoke Test",
      issue_date: "2026-03-09",
      grade: "Distinction",
      certificate_number: "TG-TEST-00000000000000000000",
      verification_code: "TG-TEST-000000000000",
      verification_url: "https://verify.example.invalid/verify?code=TG-TEST-000000000000",
      qr_data_url:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    const header = buffer.subarray(0, 5).toString("ascii")
    expect(header).toBe("%PDF-")
    expect(buffer.length).toBeGreaterThan(2000)
    expect(buffer.toString("latin1")).toContain("MediaBox")
  })
})
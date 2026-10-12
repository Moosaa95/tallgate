import { describe, expect, it } from "vitest"
import { renderCertificatePdf } from "@/lib/certificates/generateCertificatePdf"

describe("renderCertificatePdf", () => {
  it("renders a real A4-landscape PDF for a synthetic fixture", async () => {
    const buffer = await renderCertificatePdf({
      recipient_name: "Fixture Recipient For Rendering Smoke Test",
      course_title: "Fixture Programme Title - Rendering Smoke Test",
      issue_date: "2026-03-09",
      grade: "Distinction",
      certificate_number: "TG/DH/01021/26",
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

  it("safely fits very long recipient names and long course titles without errors", async () => {
    const buffer = await renderCertificatePdf({
      recipient_name: "Dr. Bartholomew Alexander Montgomery-Finch the Third",
      course_title:
        "Advanced Executive Postgraduate Diploma in Healthcare Information Systems, Telemedicine Technologies, and Health Data Governance",
      issue_date: "2026-10-15",
      grade: null,
      certificate_number: "TG/DH/01099/26",
      verification_code: "TG-LONG-1234567890AB",
      verification_url: "https://verify.example.invalid/verify?code=TG-LONG-1234567890AB",
      qr_data_url:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-")
    expect(buffer.length).toBeGreaterThan(2000)
  })

  it("supports rendering with an optional logo data URL", async () => {
    const buffer = await renderCertificatePdf({
      recipient_name: "Jane Doe",
      course_title: "Professional Telehealth & Digital Health Training Programme",
      issue_date: "2026-10-15",
      grade: "Distinction",
      certificate_number: "TG/DH/01021/21",
      verification_code: "TG-2026-DEMO0001",
      verification_url: "https://tallgate.ng/verify?code=TG-2026-DEMO0001",
      qr_data_url:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      logo_src:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-")
  })
})
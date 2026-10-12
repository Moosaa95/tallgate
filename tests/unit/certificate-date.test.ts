import { describe, expect, it } from "vitest"
import { formatCertificateIssueDate } from "@/lib/certificates/date"

describe("formatCertificateIssueDate", () => {
  it("formats an ISO calendar date numerically by default", () => {
    expect(formatCertificateIssueDate("2026-03-09")).toBe("3/9/2026")
  })

  it("formats a long, human-readable date when asked", () => {
    expect(formatCertificateIssueDate("2026-03-09", "long")).toBe("9 March 2026")
  })

  it("formats an ordinal human-readable date for certificate badges", () => {
    expect(formatCertificateIssueDate("2026-10-15", "ordinal")).toBe("15th October 2026")
    expect(formatCertificateIssueDate("2026-01-01", "ordinal")).toBe("1st January 2026")
    expect(formatCertificateIssueDate("2026-02-02", "ordinal")).toBe("2nd February 2026")
    expect(formatCertificateIssueDate("2026-03-03", "ordinal")).toBe("3rd March 2026")
    expect(formatCertificateIssueDate("2026-04-11", "ordinal")).toBe("11th April 2026")
    expect(formatCertificateIssueDate("2026-05-22", "ordinal")).toBe("22nd May 2026")
    expect(formatCertificateIssueDate("2026-06-23", "ordinal")).toBe("23rd June 2026")
    expect(formatCertificateIssueDate("2026-07-31", "ordinal")).toBe("31st July 2026")
  })

  it("accepts a valid leap day", () => {
    expect(formatCertificateIssueDate("2024-02-29")).toBe("2/29/2024")
  })

  it("returns the input unchanged for a non-leap-year Feb 29", () => {
    expect(formatCertificateIssueDate("2023-02-29")).toBe("2023-02-29")
  })

  it("returns the input unchanged for impossible or malformed dates", () => {
    expect(formatCertificateIssueDate("2026-02-30")).toBe("2026-02-30")
    expect(formatCertificateIssueDate("not-a-date")).toBe("not-a-date")
    expect(formatCertificateIssueDate("")).toBe("")
  })
})
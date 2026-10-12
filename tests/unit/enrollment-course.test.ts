import { describe, expect, it } from "vitest"
import { resolveEnrollmentCourse } from "@/lib/catalogue/enrollmentCourse"

describe("resolveEnrollmentCourse", () => {
  it("returns the authoritative title and price for a published course", () => {
    expect(
      resolveEnrollmentCourse({
        title: "  Developer Package ",
        price_ngn: 250000,
        is_published: true,
      })
    ).toEqual({ title: "Developer Package", priceNgn: 250000 })
  })

  it("rejects unpublished courses", () => {
    expect(
      resolveEnrollmentCourse({
        title: "Developer Package",
        price_ngn: 250000,
        is_published: false,
      })
    ).toBeNull()
  })

  it("rejects blank titles", () => {
    expect(
      resolveEnrollmentCourse({ title: "   ", price_ngn: 0, is_published: true })
    ).toBeNull()
  })

  it("rejects missing rows", () => {
    expect(resolveEnrollmentCourse(null)).toBeNull()
    expect(resolveEnrollmentCourse(undefined)).toBeNull()
  })

  it("falls back to a zero price when the stored price is invalid", () => {
    expect(
      resolveEnrollmentCourse({
        title: "Developer Package",
        price_ngn: Number.NaN,
        is_published: true,
      })
    ).toEqual({ title: "Developer Package", priceNgn: 0 })
  })
})

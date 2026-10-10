import { describe, expect, it } from "vitest"
import { isEmailOtpType } from "@/lib/auth/emailOtp"

describe("isEmailOtpType", () => {
  it("accepts every Supabase email OTP type", () => {
    for (const type of [
      "signup",
      "invite",
      "magiclink",
      "recovery",
      "email_change",
      "email",
    ]) {
      expect(isEmailOtpType(type)).toBe(true)
    }
  })

  it("rejects unknown, empty, wrong-case, and non-string values", () => {
    expect(isEmailOtpType("sms")).toBe(false)
    expect(isEmailOtpType("")).toBe(false)
    expect(isEmailOtpType("EMAIL")).toBe(false)
    expect(isEmailOtpType(null)).toBe(false)
    expect(isEmailOtpType(undefined)).toBe(false)
    expect(isEmailOtpType(123)).toBe(false)
    expect(isEmailOtpType({ type: "email" })).toBe(false)
  })
})

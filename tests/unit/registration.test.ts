import { describe, expect, it } from "vitest"
import {
  GENERIC_SIGNUP_ERROR,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  resolveSignUpOutcome,
  validatePassword,
} from "@/lib/auth/registration"

describe("validatePassword", () => {
  it("rejects passwords shorter than the minimum", () => {
    expect(validatePassword("")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    )
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).not.toBeNull()
  })

  it("accepts a password exactly at the minimum", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH))).toBeNull()
  })

  it("rejects passwords longer than the maximum", () => {
    const tooLong = "a".repeat(PASSWORD_MAX_LENGTH + 1)
    expect(validatePassword(tooLong)).toBe(
      `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`
    )
  })

  it("accepts a password exactly at the maximum", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX_LENGTH))).toBeNull()
  })
})

describe("resolveSignUpOutcome", () => {
  it("returns a generic error for any provider failure", () => {
    const outcome = resolveSignUpOutcome({
      error: { message: "User already registered" },
      session: null,
    })
    expect(outcome).toEqual({ kind: "error", message: GENERIC_SIGNUP_ERROR })
  })

  it("does not reveal whether an email already exists", () => {
    // Supabase returns an empty identities array for an address that is already
    // registered and no error. The outcome must match a brand-new sign-up.
    const existingEmail = resolveSignUpOutcome({
      error: null,
      session: null,
      user: { identities: [] },
    })
    const newEmail = resolveSignUpOutcome({
      error: null,
      session: null,
      user: { identities: [{ id: "new-identity" }] },
    })

    expect(existingEmail).toEqual({ kind: "verify-email" })
    expect(newEmail).toEqual(existingEmail)
  })

  it("signs the user in when a session is returned", () => {
    expect(
      resolveSignUpOutcome({ error: null, session: { access_token: "t" } })
    ).toEqual({ kind: "signed-in" })
  })
})

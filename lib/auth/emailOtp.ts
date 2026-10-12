import type { EmailOtpType } from "@supabase/supabase-js"

/**
 * Email-link verification types accepted by `supabase.auth.verifyOtp`. Keeping
 * the allow-list explicit means the auth callback only ever passes a known-good
 * `type` through to Supabase and rejects anything else.
 */
export const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const satisfies readonly EmailOtpType[]

export function isEmailOtpType(value: unknown): value is EmailOtpType {
  return (
    typeof value === "string" &&
    (EMAIL_OTP_TYPES as readonly string[]).includes(value)
  )
}

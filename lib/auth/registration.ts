/**
 * Shared registration rules.
 *
 * These helpers are pure so they can be unit-tested and reused by the sign-up
 * and password-reset screens without pulling in Supabase or the DOM.
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/**
 * A sign-up failure message that is deliberately identical for every cause.
 * Supabase can return "User already registered" for an existing address, so
 * echoing provider errors would let an attacker enumerate accounts. The
 * underlying reason is still logged server-side by the caller.
 */
export const GENERIC_SIGNUP_ERROR =
  "We couldn't create your account with those details. Check your information and try again."

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`
  }
  return null
}

export type SignUpOutcome =
  | { kind: "error"; message: string }
  | { kind: "verify-email" }
  | { kind: "signed-in" }

/**
 * The `identities` field is accepted but intentionally ignored. Supabase returns
 * an empty array for an address that is already registered; branching on it (as
 * the previous implementation did) enabled account enumeration.
 */
export type SignUpResult = {
  error?: { message?: string } | null
  session?: unknown
  user?: { identities?: unknown[] } | null
}

export function resolveSignUpOutcome(result: SignUpResult): SignUpOutcome {
  if (result.error) {
    return { kind: "error", message: GENERIC_SIGNUP_ERROR }
  }
  if (!result.session) {
    return { kind: "verify-email" }
  }
  return { kind: "signed-in" }
}

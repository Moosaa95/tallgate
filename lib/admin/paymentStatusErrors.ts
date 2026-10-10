/**
 * Maps the SQLSTATE codes raised by `public.update_payment_request_status`
 * (see 20261010000000_payment_confirmation_enrollment.sql) to safe HTTP
 * responses. PostgREST surfaces the raised SQLSTATE as `error.code`, so the
 * route never has to echo a raw database message to the client.
 */
export type PaymentRpcError =
  | { code?: string | null; message?: string | null }
  | null
  | undefined

type MappedError = { status: number; message: string }

const UNAUTHORIZED: MappedError = {
  status: 403,
  message: "You do not have permission to update payment requests.",
}
const NOT_FOUND: MappedError = {
  status: 404,
  message: "Payment request not found.",
}
const INVALID_TRANSITION: MappedError = {
  status: 400,
  message: "That payment status change is not allowed.",
}
const MISSING_LINK: MappedError = {
  status: 400,
  message: "Select a learner and course before confirming this payment.",
}
const FALLBACK: MappedError = {
  status: 503,
  message: "The operation could not be completed. Please try again.",
}

const BY_CODE: Record<string, MappedError> = {
  "42501": UNAUTHORIZED, // insufficient_privilege
  P0002: NOT_FOUND, // no_data_found
  "22023": INVALID_TRANSITION, // invalid_parameter_value
  "23514": MISSING_LINK, // check_violation
}

// Defensive fallback for the rare case a proxy strips `code` but preserves the
// (curated, non-leaking) message.
const BY_MESSAGE: { pattern: RegExp; result: MappedError }[] = [
  { pattern: /administrators/i, result: UNAUTHORIZED },
  { pattern: /not found/i, result: NOT_FOUND },
  { pattern: /transition/i, result: INVALID_TRANSITION },
  { pattern: /learner and course/i, result: MISSING_LINK },
]

export function paymentStatusError(error: PaymentRpcError): MappedError {
  const code = error?.code ?? ""
  if (BY_CODE[code]) return { ...BY_CODE[code] }

  const message = error?.message ?? ""
  for (const entry of BY_MESSAGE) {
    if (entry.pattern.test(message)) return { ...entry.result }
  }

  return { ...FALLBACK }
}

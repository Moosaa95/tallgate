import { describe, expect, it } from "vitest"
import { paymentStatusError } from "@/lib/admin/paymentStatusErrors"

describe("paymentStatusError", () => {
  it("maps SQLSTATE codes raised by the confirmation RPC", () => {
    expect(paymentStatusError({ code: "42501" })).toEqual({
      status: 403,
      message: "You do not have permission to update payment requests.",
    })
    expect(paymentStatusError({ code: "P0002" })).toEqual({
      status: 404,
      message: "Payment request not found.",
    })
    expect(paymentStatusError({ code: "22023" })).toEqual({
      status: 400,
      message: "That payment status change is not allowed.",
    })
    expect(paymentStatusError({ code: "23514" })).toEqual({
      status: 400,
      message: "Select a learner and course before confirming this payment.",
    })
  })

  it("falls back to the curated message when the code is missing", () => {
    expect(paymentStatusError({ message: "Payment request not found." }).status).toBe(404)
    expect(paymentStatusError({ message: "Invalid payment status transition." }).status).toBe(400)
  })

  it("returns a generic 503 for unknown or missing errors", () => {
    expect(paymentStatusError(null)).toEqual({
      status: 503,
      message: "The operation could not be completed. Please try again.",
    })
    expect(paymentStatusError({ code: "XX000", message: "boom" })).toEqual({
      status: 503,
      message: "The operation could not be completed. Please try again.",
    })
  })

  it("never echoes the raw database message", () => {
    const mapped = paymentStatusError({
      code: "XX000",
      message: 'relation "public.payment_requests" does not exist',
    })
    expect(mapped.message).not.toContain("payment_requests")
  })
})

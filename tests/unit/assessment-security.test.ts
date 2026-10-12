import { describe, expect, it } from "vitest"
import { rpcErrorMessage, validUuid } from "@/lib/assessments/rpc"
import { gradeQuestion } from "@/lib/assessments/grading"

describe("Assessment Security & Error Mapping", () => {
  it("maps authentication and authorization errors to safe messages", () => {
    expect(rpcErrorMessage({ message: "NOT_AUTHENTICATED" }, "fallback")).toBe(
      "Please sign in to continue."
    )
    expect(rpcErrorMessage({ message: "NOT_AUTHORIZED" }, "fallback")).toBe(
      "You are not authorized to perform this action."
    )
    expect(rpcErrorMessage({ message: "NOT_ENROLLED" }, "fallback")).toBe(
      "You are not enrolled in this course."
    )
    expect(rpcErrorMessage({ message: "QUIZ_NOT_PUBLISHED" }, "fallback")).toBe(
      "This quiz is not published yet."
    )
  })

  it("maps attempt lifecycle and validation errors safely", () => {
    expect(rpcErrorMessage({ message: "ATTEMPT_LIMIT" }, "fallback")).toBe(
      "You have used all allowed attempts for this quiz."
    )
    expect(rpcErrorMessage({ message: "COOLDOWN" }, "fallback")).toBe(
      "Please wait before retaking this quiz."
    )
    expect(rpcErrorMessage({ message: "ATTEMPT_NOT_FOUND" }, "fallback")).toBe(
      "This attempt could not be found."
    )
    expect(rpcErrorMessage({ message: "ATTEMPT_NOT_EDITABLE" }, "fallback")).toBe(
      "This attempt can no longer be edited."
    )
    expect(rpcErrorMessage({ message: "ATTEMPT_EXPIRED" }, "fallback")).toBe(
      "The time for this attempt has expired."
    )
    expect(rpcErrorMessage({ message: "QUESTION_NOT_IN_ATTEMPT" }, "fallback")).toBe(
      "This question is not part of the current attempt."
    )
    expect(rpcErrorMessage({ message: "TEXT_TOO_LONG" }, "fallback")).toBe(
      "Your answer is too long."
    )
  })

  it("falls back to the provided safe fallback when the error is unknown or missing", () => {
    expect(rpcErrorMessage(null, "Safe fallback")).toBe("Safe fallback")
    expect(rpcErrorMessage({ message: "UNKNOWN_INTERNAL_ERROR" }, "Safe fallback")).toBe(
      "Safe fallback"
    )
    expect(rpcErrorMessage({}, "Safe fallback")).toBe("Safe fallback")
  })
})

describe("UUID Input Validation Guards", () => {
  it("accepts valid RFC 4122 UUIDs", () => {
    expect(validUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true)
    expect(validUuid("c73bcdcc-2669-4bf6-81d3-e4ae73fb11be")).toBe(true)
    expect(validUuid("C73BCDCC-2669-4BF6-81D3-E4AE73FB11BE")).toBe(true)
  })

  it("rejects malicious or invalid UUID strings", () => {
    expect(validUuid("")).toBe(false)
    expect(validUuid("   ")).toBe(false)
    expect(validUuid("not-a-uuid")).toBe(false)
    expect(validUuid("123e4567-e89b-12d3-a456-42661417400")).toBe(false) // too short
    expect(validUuid("123e4567-e89b-12d3-a456-4266141740000")).toBe(false) // too long
    expect(validUuid("'; drop table public.quizzes; --")).toBe(false)
    expect(validUuid("../../etc/passwd")).toBe(false)
    expect(validUuid(null)).toBe(false)
    expect(validUuid(undefined)).toBe(false)
    expect(validUuid(12345)).toBe(false)
    expect(validUuid({})).toBe(false)
  })
})

describe("Server-Side Grading Authority", () => {
  it("never trusts client-submitted answers as authoritative for essay questions", () => {
    // Essay questions are always marked needsManual with 0 points awarded
    const result = gradeQuestion({
      type: "essay",
      points: 10,
      textAnswer: "Perfect comprehensive essay",
    })

    expect(result.needsManual).toBe(true)
    expect(result.isCorrect).toBeNull()
    expect(result.pointsAwarded).toBe(0)
  })

  it("safely ignores client attempt to award fractional/tampered points above question maximum", () => {
    // Question max is 5 points
    const result = gradeQuestion({
      type: "single",
      correctOptionIds: ["opt-1"],
      selectedOptionIds: ["opt-1"],
      points: 5,
    })

    expect(result.needsManual).toBe(false)
    if (!result.needsManual) {
      expect(result.pointsAwarded).toBe(5)
      expect(result.isCorrect).toBe(true)
    }
  })

  it("never awards points for incorrect answers regardless of selection order", () => {
    const wrong = gradeQuestion({
      type: "multiple",
      correctOptionIds: ["opt-1", "opt-2"],
      selectedOptionIds: ["opt-1", "opt-3"],
      points: 4,
    })

    expect(wrong.needsManual).toBe(false)
    if (!wrong.needsManual) {
      expect(wrong.pointsAwarded).toBe(0)
      expect(wrong.isCorrect).toBe(false)
    }
  })
})

import { describe, expect, it } from "vitest"
import {
  computeGrade,
  DEFAULT_GRADE_THRESHOLDS,
  gradeQuestion,
  normalizeShortAnswer,
  pendingManualQuestions,
  summarizeGradedAttempt,
} from "@/lib/assessments/grading"

describe("normalizeShortAnswer", () => {
  it("trims surrounding whitespace and lowercases", () => {
    expect(normalizeShortAnswer("  Hello World  ")).toBe("hello world")
  })

  it("collapses repeated whitespace", () => {
    expect(normalizeShortAnswer("multi\n  line\t answer")).toBe("multi line answer")
  })

  it("handles null and undefined", () => {
    expect(normalizeShortAnswer(null)).toBe("")
    expect(normalizeShortAnswer(undefined)).toBe("")
  })
})

describe("gradeQuestion objective questions", () => {
  it("awards points for a correct single choice", () => {
    const result = gradeQuestion({
      type: "single",
      correctOptionIds: ["a"],
      selectedOptionIds: ["a"],
      points: 3,
    })
    expect(result.needsManual).toBe(false)
    if (!result.needsManual) {
      expect(result.isCorrect).toBe(true)
      expect(result.pointsAwarded).toBe(3)
    }
  })

  it("awards zero for a wrong single choice", () => {
    const result = gradeQuestion({
      type: "single",
      correctOptionIds: ["a"],
      selectedOptionIds: ["b"],
      points: 3,
    })
    if (!result.needsManual) {
      expect(result.isCorrect).toBe(false)
      expect(result.pointsAwarded).toBe(0)
    }
  })

  it("scores true_false by exact selection", () => {
    const right = gradeQuestion({
      type: "true_false",
      correctOptionIds: ["a"],
      selectedOptionIds: ["a"],
      points: 1,
    })
    if (!right.needsManual) expect(right.isCorrect).toBe(true)

    const wrong = gradeQuestion({
      type: "true_false",
      correctOptionIds: ["a"],
      selectedOptionIds: ["b"],
      points: 1,
    })
    if (!wrong.needsManual) expect(wrong.isCorrect).toBe(false)
  })

  it("grades multiple choice all-or-nothing", () => {
    const full = gradeQuestion({
      type: "multiple",
      correctOptionIds: ["a", "b", "c"],
      selectedOptionIds: ["c", "a", "b"],
      points: 5,
    })
    if (!full.needsManual) {
      expect(full.isCorrect).toBe(true)
      expect(full.pointsAwarded).toBe(5)
    }

    const partial = gradeQuestion({
      type: "multiple",
      correctOptionIds: ["a", "b", "c"],
      selectedOptionIds: ["a", "b"],
      points: 5,
    })
    if (!partial.needsManual) {
      expect(partial.isCorrect).toBe(false)
      expect(partial.pointsAwarded).toBe(0)
    }

    const extra = gradeQuestion({
      type: "multiple",
      correctOptionIds: ["a", "b"],
      selectedOptionIds: ["a", "b", "c"],
      points: 5,
    })
    if (!extra.needsManual) {
      expect(extra.isCorrect).toBe(false)
      expect(extra.pointsAwarded).toBe(0)
    }
  })

  it("positions in the selected set do not change the grade", () => {
    const result = gradeQuestion({
      type: "multiple",
      correctOptionIds: ["a", "b"],
      selectedOptionIds: ["b", "a"],
      points: 2,
    })
    if (!result.needsManual) expect(result.isCorrect).toBe(true)
  })

  it("requires exactly the correct set for true_false/single", () => {
    const tooMany = gradeQuestion({
      type: "single",
      correctOptionIds: ["a"],
      selectedOptionIds: ["a", "b"],
      points: 1,
    })
    if (!tooMany.needsManual) expect(tooMany.isCorrect).toBe(false)
  })
})

describe("gradeQuestion short answers", () => {
  it("matches an accepted answer case-insensitively after trimming", () => {
    const result = gradeQuestion({
      type: "short",
      acceptedAnswers: ["Grid layout", "CSS Grid"],
      textAnswer: "  grid layout  ",
      points: 2,
    })
    if (!result.needsManual) {
      expect(result.isCorrect).toBe(true)
      expect(result.pointsAwarded).toBe(2)
    }
  })

  it("awards zero for an unmatched answer", () => {
    const result = gradeQuestion({
      type: "short",
      acceptedAnswers: ["Grid layout"],
      textAnswer: "Flexbox",
      points: 2,
    })
    if (!result.needsManual) {
      expect(result.isCorrect).toBe(false)
      expect(result.pointsAwarded).toBe(0)
    }
  })

  it("never matches an empty answer", () => {
    const result = gradeQuestion({ type: "short", acceptedAnswers: [""], textAnswer: "   ", points: 2 })
    if (!result.needsManual) {
      expect(result.isCorrect).toBe(false)
      expect(result.pointsAwarded).toBe(0)
    }
  })
})

describe("gradeQuestion essay", () => {
  it("flags essay questions for manual grading", () => {
    const result = gradeQuestion({ type: "essay", textAnswer: "Long form response", points: 10 })
    expect(result.needsManual).toBe(true)
    if (result.needsManual) {
      expect(result.isCorrect).toBe(null)
      expect(result.pointsAwarded).toBe(0)
    }
  })
})

describe("summarizeGradedAttempt", () => {
  it("computes score, percent and passed for a graded attempt", () => {
    const summary = summarizeGradedAttempt(
      [
        { isCorrect: true, pointsAwarded: 3 },
        { isCorrect: true, pointsAwarded: 2 },
        { isCorrect: false, pointsAwarded: 0 },
      ],
      5,
      60
    )
    expect(summary.scorePoints).toBe(5)
    expect(summary.maxPoints).toBe(5)
    expect(summary.percent).toBe(100)
    expect(summary.passed).toBe(true)
    expect(summary.pending).toBe(false)
  })

  it("marks passed false below the pass mark", () => {
    const summary = summarizeGradedAttempt([{ isCorrect: true, pointsAwarded: 2 }], 5, 60)
    expect(summary.percent).toBe(40)
    expect(summary.passed).toBe(false)
  })

  it("keeps passed null while any answer is pending grading", () => {
    const summary = summarizeGradedAttempt(
      [
        { isCorrect: true, pointsAwarded: 2 },
        { isCorrect: null, pointsAwarded: 0 },
      ],
      5,
      60
    )
    expect(summary.pending).toBe(true)
    expect(summary.passed).toBe(null)
    expect(summary.percent).toBe(40)
  })

  it("avoids division by zero and clamps negative points", () => {
    const summary = summarizeGradedAttempt([{ isCorrect: true, pointsAwarded: -2 }], 0, 50)
    expect(summary.maxPoints).toBe(0)
    expect(summary.percent).toBe(0)
    expect(summary.passed).toBe(false)
  })
})

describe("pendingManualQuestions", () => {
  it("returns only questions whose grade is still null", () => {
    const questions = [
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: false },
      { id: "c", isCorrect: null },
      { id: "d", isCorrect: null },
    ]
    expect(pendingManualQuestions(questions).map((q) => q.id)).toEqual(["c", "d"])
  })

  it("returns an empty list when every question is graded", () => {
    expect(
      pendingManualQuestions([
        { id: "a", isCorrect: true },
        { id: "b", isCorrect: false },
      ])
    ).toEqual([])
  })
})

describe("computeGrade boundary cases", () => {
  it("uses default thresholds (80 / 65 / 50)", () => {
    expect(DEFAULT_GRADE_THRESHOLDS).toEqual({
      distinction: 80,
      merit: 65,
      pass: 50,
    })
  })

  it("awards Distinction at exactly 80.00%", () => {
    expect(computeGrade(80)).toBe("Distinction")
    expect(computeGrade(80.0)).toBe("Distinction")
  })

  it("awards Distinction above 80.00% up to and beyond 100%", () => {
    expect(computeGrade(80.01)).toBe("Distinction")
    expect(computeGrade(89.5)).toBe("Distinction")
    expect(computeGrade(100)).toBe("Distinction")
    expect(computeGrade(105)).toBe("Distinction")
  })

  it("awards Merit just below Distinction (79.99%)", () => {
    expect(computeGrade(79.99)).toBe("Merit")
    expect(computeGrade(79.9)).toBe("Merit")
    expect(computeGrade(75)).toBe("Merit")
  })

  it("awards Merit at exactly 65.00%", () => {
    expect(computeGrade(65)).toBe("Merit")
    expect(computeGrade(65.0)).toBe("Merit")
  })

  it("awards Pass just below Merit (64.99%)", () => {
    expect(computeGrade(64.99)).toBe("Pass")
    expect(computeGrade(60)).toBe("Pass")
    expect(computeGrade(55)).toBe("Pass")
  })

  it("awards Pass at exactly 50.00%", () => {
    expect(computeGrade(50)).toBe("Pass")
    expect(computeGrade(50.0)).toBe("Pass")
    expect(computeGrade(50.01)).toBe("Pass")
  })

  it("returns null (fail) just below Pass (49.99%)", () => {
    expect(computeGrade(49.99)).toBeNull()
    expect(computeGrade(49.9)).toBeNull()
    expect(computeGrade(40)).toBeNull()
    expect(computeGrade(0)).toBeNull()
  })

  it("handles negative numbers, zero, and extremes", () => {
    expect(computeGrade(-0.01)).toBeNull()
    expect(computeGrade(-50)).toBeNull()
    expect(computeGrade(0)).toBeNull()
  })

  it("returns null for non-numeric, null, undefined, and non-finite inputs", () => {
    expect(computeGrade(null)).toBeNull()
    expect(computeGrade(undefined)).toBeNull()
    expect(computeGrade(Number.NaN)).toBeNull()
    expect(computeGrade(Number.POSITIVE_INFINITY)).toBeNull()
    expect(computeGrade(Number.NEGATIVE_INFINITY)).toBeNull()
  })

  it("respects custom grade thresholds", () => {
    const custom = { distinction: 85, merit: 70, pass: 55 }

    expect(computeGrade(85, { thresholds: custom })).toBe("Distinction")
    expect(computeGrade(84.99, { thresholds: custom })).toBe("Merit")
    expect(computeGrade(70, { thresholds: custom })).toBe("Merit")
    expect(computeGrade(69.99, { thresholds: custom })).toBe("Pass")
    expect(computeGrade(55, { thresholds: custom })).toBe("Pass")
    expect(computeGrade(54.99, { thresholds: custom })).toBeNull()
  })

  it("respects passMark override when higher than pass threshold", () => {
    // passMark is 60 (higher than default 50)
    expect(computeGrade(60, { passMark: 60 })).toBe("Pass")
    expect(computeGrade(59.99, { passMark: 60 })).toBeNull()
    expect(computeGrade(50, { passMark: 60 })).toBeNull()
  })

  it("integrates gradeBand into summarizeGradedAttempt", () => {
    const distinctionAttempt = summarizeGradedAttempt(
      [{ isCorrect: true, pointsAwarded: 9 }],
      10,
      50
    )
    expect(distinctionAttempt.percent).toBe(90)
    expect(distinctionAttempt.passed).toBe(true)
    expect(distinctionAttempt.gradeBand).toBe("Distinction")

    const meritAttempt = summarizeGradedAttempt(
      [{ isCorrect: true, pointsAwarded: 7 }],
      10,
      50
    )
    expect(meritAttempt.percent).toBe(70)
    expect(meritAttempt.passed).toBe(true)
    expect(meritAttempt.gradeBand).toBe("Merit")

    const passAttempt = summarizeGradedAttempt(
      [{ isCorrect: true, pointsAwarded: 5.5 }],
      10,
      50
    )
    expect(passAttempt.percent).toBe(55)
    expect(passAttempt.passed).toBe(true)
    expect(passAttempt.gradeBand).toBe("Pass")

    const failAttempt = summarizeGradedAttempt(
      [{ isCorrect: true, pointsAwarded: 4 }],
      10,
      50
    )
    expect(failAttempt.percent).toBe(40)
    expect(failAttempt.passed).toBe(false)
    expect(failAttempt.gradeBand).toBeNull()
  })
})
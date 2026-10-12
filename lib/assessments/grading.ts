export type QuestionType = "single" | "multiple" | "true_false" | "short" | "essay"

export type GradeInput = {
  type: QuestionType
  correctOptionIds?: string[]
  acceptedAnswers?: string[]
  selectedOptionIds?: string[]
  textAnswer?: string | null
  points: number
}

export type AutoGraded = {
  isCorrect: boolean
  pointsAwarded: number
  needsManual: false
}

export type NeedsManual = {
  isCorrect: null
  pointsAwarded: 0
  needsManual: true
}

export type GradeResult = AutoGraded | NeedsManual

export function normalizeShortAnswer(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}

function setsEqual(left: string[], right: string[]): boolean {
  const uniqueLeft = [...new Set(left)]
  return (
    uniqueLeft.length === right.length &&
    right.every((id) => uniqueLeft.includes(id))
  )
}

function sortIds(ids: string[]): string[] {
  return [...new Set(ids)].sort()
}

export function gradeQuestion(input: GradeInput): GradeResult {
  const selected = input.selectedOptionIds ?? []
  const points = Math.max(0, input.points)

  if (input.type === "essay") {
    return { isCorrect: null, pointsAwarded: 0, needsManual: true }
  }

  let isCorrect: boolean
  if (input.type === "short") {
    const accepted = (input.acceptedAnswers ?? []).map(normalizeShortAnswer).filter(Boolean)
    isCorrect =
      accepted.length > 0 &&
      normalizeShortAnswer(input.textAnswer) !== "" &&
      accepted.includes(normalizeShortAnswer(input.textAnswer))
  } else {
    const correct = input.correctOptionIds ?? []
    isCorrect = setsEqual(sortIds(selected), sortIds(correct))
  }

  return {
    isCorrect,
    pointsAwarded: isCorrect ? points : 0,
    needsManual: false,
  }
}

export type AttemptRow = {
  isCorrect: boolean | null
  pointsAwarded: number
}

/** Filters questions that still need a manual grade (essay or unanswered). */
export function pendingManualQuestions<T extends { isCorrect: boolean | null }>(
  questions: T[]
): T[] {
  return questions.filter((question) => question.isCorrect === null)
}

export type GradeBand = "Distinction" | "Merit" | "Pass"

export interface GradeBandThresholds {
  distinction: number
  merit: number
  pass: number
}

export const DEFAULT_GRADE_THRESHOLDS: GradeBandThresholds = {
  distinction: 80,
  merit: 65,
  pass: 50,
}

export interface ComputeGradeOptions {
  passMark?: number
  thresholds?: Partial<GradeBandThresholds>
}

/**
 * Computes the academic/vocational grade band ("Distinction" | "Merit" | "Pass")
 * for a given percentage score.
 *
 * Boundary rules:
 * - Scores below passMark (or pass threshold) return null (failing).
 * - Negative, NaN, null, undefined, or non-finite numbers return null.
 * - Upper bound: percentages >= distinction threshold (default 80%) receive "Distinction".
 * - Merit bound: percentages >= merit threshold (default 65%) and < distinction threshold receive "Merit".
 * - Pass bound: percentages >= pass threshold (default 50%) and < merit threshold receive "Pass".
 * - Supports custom thresholds and overriding passMark.
 * - Precision: rounded to 2 decimal places to avoid floating point anomalies.
 */
export function computeGrade(
  percent: number | null | undefined,
  options?: ComputeGradeOptions
): GradeBand | null {
  if (percent === null || percent === undefined) return null
  const num = Number(percent)
  if (!Number.isFinite(num) || Number.isNaN(num) || num < 0) return null

  const distinction = options?.thresholds?.distinction ?? DEFAULT_GRADE_THRESHOLDS.distinction
  const merit = options?.thresholds?.merit ?? DEFAULT_GRADE_THRESHOLDS.merit
  const pass = options?.thresholds?.pass ?? DEFAULT_GRADE_THRESHOLDS.pass
  const effectivePass = options?.passMark !== undefined ? Math.max(pass, options.passMark) : pass

  const normalized = Math.round(num * 100) / 100

  if (normalized < effectivePass) {
    return null
  }
  if (normalized >= distinction) {
    return "Distinction"
  }
  if (normalized >= merit) {
    return "Merit"
  }
  return "Pass"
}

export type GradeSummary = {
  scorePoints: number
  maxPoints: number
  percent: number
  passed: boolean | null
  gradeBand?: GradeBand | null
  pending: boolean
}

export function summarizeGradedAttempt(
  rows: AttemptRow[],
  maxPoints: number,
  passMarkPercent: number,
  thresholds?: Partial<GradeBandThresholds>
): GradeSummary {
  const pending = rows.some((row) => row.isCorrect === null)
  const scorePoints = rows.reduce((sum, row) => sum + Math.max(0, Number(row.pointsAwarded) || 0), 0)
  const safeMax = Math.max(0, Number(maxPoints) || 0)
  const percent = safeMax > 0 ? Math.round((scorePoints / safeMax) * 10000) / 100 : 0
  const passed = pending ? null : percent >= passMarkPercent
  const gradeBand = passed ? computeGrade(percent, { passMark: passMarkPercent, thresholds }) : null

  return {
    scorePoints,
    maxPoints: safeMax,
    percent,
    passed,
    gradeBand,
    pending,
  }
}
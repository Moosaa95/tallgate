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

export type GradeSummary = {
  scorePoints: number
  maxPoints: number
  percent: number
  passed: boolean | null
  pending: boolean
}

export function summarizeGradedAttempt(
  rows: AttemptRow[],
  maxPoints: number,
  passMarkPercent: number
): GradeSummary {
  const pending = rows.some((row) => row.isCorrect === null)
  const scorePoints = rows.reduce((sum, row) => sum + Math.max(0, Number(row.pointsAwarded) || 0), 0)
  const safeMax = Math.max(0, Number(maxPoints) || 0)
  const percent = safeMax > 0 ? Math.round((scorePoints / safeMax) * 10000) / 100 : 0

  return {
    scorePoints,
    maxPoints: safeMax,
    percent,
    passed: pending ? null : percent >= passMarkPercent,
    pending,
  }
}
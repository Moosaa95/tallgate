export type QuizKind = "quiz" | "practice" | "exam"

export type QuestionType = "single" | "multiple" | "true_false" | "short" | "essay"

export type GradeBand = "Distinction" | "Merit" | "Pass"

export type QuizSummary = {
  id: string
  module_id: string | null
  module_title: string | null
  kind: QuizKind
  title: string
  instructions: string | null
  time_limit_minutes: number | null
  pass_mark_percent: number
  max_attempts: number | null
  retake_cooldown_minutes: number | null
  feedback_mode: "immediate" | "after_submit"
  question_count: number | null
  is_required: boolean
  attemptCount: number
  attemptsRemaining: number | null
  bestPercent: number | null
  passed: boolean | null
  gradeBand?: GradeBand | null
  inProgressAttemptId: string | null
  nextEligibleAt: string | null
}

export type ReviewOption = {
  id: string
  label: string
  isCorrect: boolean | null
}

export type ReviewQuestion = {
  questionId: string
  type: QuestionType
  prompt: string
  points: number
  explanation: string | null
  selectedOptionIds: string[]
  textAnswer: string | null
  isCorrect: boolean | null
  pointsAwarded: number
  graderFeedback: string | null
  correctOptionIds: string[] | null
  acceptedAnswers: string[] | null
  options: ReviewOption[]
}

export type AttemptReview = {
  attemptId: string
  quizId: string
  quizTitle: string
  kind: QuizKind
  status: "in_progress" | "submitted" | "pending_grading" | "graded"
  feedbackMode: "immediate" | "after_submit"
  passMarkPercent: number
  scorePoints: number
  maxPoints: number
  percent: number | null
  passed: boolean | null
  gradeBand?: GradeBand | null
  startedAt: string
  expiresAt: string | null
  submittedAt: string | null
  tabSwitchCount: number
  questions: ReviewQuestion[]
}

export type RecallCard = {
  questionId: string
  prompt: string
  explanation: string | null
  box: number
  nextReviewAt: string | null
}

export type AttemptQuestionOrderEntry = {
  questionId: string
  optionIds: string[]
}

export function parseQuestionOrder(value: unknown): AttemptQuestionOrderEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const record = entry as Record<string, unknown>
    if (typeof record.questionId !== "string") return []
    const optionIds = Array.isArray(record.optionIds)
      ? record.optionIds.filter((id): id is string => typeof id === "string")
      : []
    return [{ questionId: record.questionId, optionIds }]
  })
}

export function reviewStatusLabel(status: AttemptReview["status"]): string {
  switch (status) {
    case "in_progress":
      return "In progress"
    case "pending_grading":
      return "Awaiting grading"
    case "graded":
      return "Graded"
    case "submitted":
      return "Submitted"
  }
}
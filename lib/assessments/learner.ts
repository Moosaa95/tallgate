import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/logger"
import type { AttemptReview, QuizKind, QuizSummary, RecallCard } from "@/lib/assessments/types"

export async function listCourseQuizzes(
  courseId: string,
  userId: string
): Promise<QuizSummary[]> {
  const supabase = await createClient()

  const [{ data: quizzes, error: quizError }, { data: modules }, { data: attempts, error: attemptError }] =
    await Promise.all([
      supabase
        .from("quizzes")
        .select(
          "id, module_id, kind, title, instructions, time_limit_minutes, pass_mark_percent, max_attempts, retake_cooldown_minutes, feedback_mode, question_count, is_required"
        )
        .eq("course_id", courseId)
        .eq("is_published", true)
        .order("title", { ascending: true }),
      supabase.from("course_modules").select("id, title").eq("course_id", courseId),
      supabase
        .from("quiz_attempts")
        .select("id, quiz_id, status, percent, passed, submitted_at, started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false }),
    ])

  if (quizError) logError("assessments.list_quizzes_failed", quizError, { courseId })
  if (attemptError) logError("assessments.list_attempts_failed", attemptError, { courseId })

  const moduleTitles = new Map((modules ?? []).map((mod) => [mod.id, mod.title]))
  const attemptsByQuiz = new Map<string, NonNullable<typeof attempts>>()
  for (const attempt of attempts ?? []) {
    const list = attemptsByQuiz.get(attempt.quiz_id) ?? []
    list.push(attempt)
    attemptsByQuiz.set(attempt.quiz_id, list)
  }

  return (quizzes ?? []).map((quiz) => {
    const quizAttempts = attemptsByQuiz.get(quiz.id) ?? []
    const finished = quizAttempts.filter((attempt) => attempt.status !== "in_progress")
    const inProgress = quizAttempts.find((attempt) => attempt.status === "in_progress")
    const graded = finished.filter((attempt) => attempt.percent !== null)
    const bestPercent = graded.length
      ? Math.max(...graded.map((attempt) => Number(attempt.percent) || 0))
      : null
    const passed =
      finished.some((attempt) => attempt.passed === true)
        ? true
        : finished.length > 0 && finished.every((attempt) => attempt.passed === false)
          ? false
          : null
    const attemptsRemaining =
      quiz.max_attempts === null ? null : Math.max(0, quiz.max_attempts - quizAttempts.length)

    const lastSubmitted = finished
      .map((attempt) => attempt.submitted_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1)
    let nextEligibleAt: string | null = null
    if (lastSubmitted && quiz.retake_cooldown_minutes) {
      const eligible = new Date(lastSubmitted).getTime() + quiz.retake_cooldown_minutes * 60_000
      if (eligible > Date.now()) nextEligibleAt = new Date(eligible).toISOString()
    }

    return {
      id: quiz.id,
      module_id: quiz.module_id,
      module_title: quiz.module_id ? moduleTitles.get(quiz.module_id) ?? null : null,
      kind: quiz.kind as QuizKind,
      title: quiz.title,
      instructions: quiz.instructions,
      time_limit_minutes: quiz.time_limit_minutes,
      pass_mark_percent: quiz.pass_mark_percent,
      max_attempts: quiz.max_attempts,
      retake_cooldown_minutes: quiz.retake_cooldown_minutes,
      feedback_mode: quiz.feedback_mode,
      question_count: quiz.question_count,
      is_required: quiz.is_required,
      attemptCount: quizAttempts.length,
      attemptsRemaining,
      bestPercent,
      passed,
      inProgressAttemptId: inProgress?.id ?? null,
      nextEligibleAt,
    }
  })
}

export async function getAttemptReview(attemptId: string): Promise<AttemptReview | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_attempt_review", { p_attempt_id: attemptId })
  if (error) {
    logError("assessments.get_attempt_review_failed", error, { attemptId })
    return null
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const review = data as unknown as AttemptReview
  if (typeof review.attemptId !== "string") return null
  return review
}

export async function listRecallCards(courseId: string, userId: string): Promise<RecallCard[]> {
  const supabase = await createClient()

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, prompt, explanation")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .order("created_at", { ascending: true })

  if (error) {
    logError("assessments.recall_questions_failed", error, { courseId })
    return []
  }

  const questionIds = (questions ?? []).map((question) => question.id)
  const progressByQuestion = new Map<string, { box: number; next_review_at: string }>()
  if (questionIds.length > 0) {
    const { data: progress } = await supabase
      .from("recall_progress")
      .select("question_id, box, next_review_at")
      .eq("user_id", userId)
      .in("question_id", questionIds)
    for (const row of progress ?? []) {
      progressByQuestion.set(row.question_id, { box: row.box, next_review_at: row.next_review_at })
    }
  }

  return (questions ?? []).map((question) => {
    const progress = progressByQuestion.get(question.id)
    return {
      questionId: question.id,
      prompt: question.prompt,
      explanation: question.explanation,
      box: progress?.box ?? 1,
      nextReviewAt: progress?.next_review_at ?? null,
    }
  })
}
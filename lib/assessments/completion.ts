import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  issueCourseCertificate,
  type IssueCertificateInput,
} from "@/lib/certificates/issueCertificate"
import { computeGrade } from "@/lib/assessments/grading"
import { logError } from "@/lib/logging/logger"

export type CompletionResult = {
  isComplete: boolean
  progressPercent: number
  certificateIssued: boolean
  certificateStatus: "created" | "existing" | "none" | "failed"
}

/**
 * Recomputes a course's completion from database state only (never from client
 * input) and, when the course is complete and `auto_issue_certificate` is set,
 * mints the learner's certificate through the shared, idempotent issuance
 * function. Must be called from every server path that can complete a course:
 * attempt submission, admin grading, and lesson completion.
 */
export async function checkCourseCompletion(
  userId: string,
  courseId: string
): Promise<CompletionResult> {
  const client = createAdminClient()

  const { data, error } = await client.rpc("recompute_course_completion", {
    p_user_id: userId,
    p_course_id: courseId,
  })

  if (error) {
    logError("completion.recompute_failed", error, { userId, courseId })
    return {
      isComplete: false,
      progressPercent: 0,
      certificateIssued: false,
      certificateStatus: "none",
    }
  }

  const isComplete = Boolean(data?.isComplete)
  const progressPercent = Number(data?.progressPercent) || 0

  if (!isComplete) {
    return { isComplete, progressPercent, certificateIssued: false, certificateStatus: "none" }
  }

  const { data: course, error: courseError } = await client
    .from("courses")
    .select("auto_issue_certificate, title")
    .eq("id", courseId)
    .maybeSingle()

  if (courseError) {
    logError("completion.course_lookup_failed", courseError, { courseId })
  }
  if (!course?.auto_issue_certificate) {
    return { isComplete, progressPercent, certificateIssued: false, certificateStatus: "none" }
  }

  const { data: existing } = await client
    .from("certificates")
    .select("id, storage_path")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle()

  if (existing?.storage_path) {
    return {
      isComplete,
      progressPercent,
      certificateIssued: true,
      certificateStatus: "existing",
    }
  }

  // Calculate the learner's overall grade band across required quizzes
  const { data: requiredQuizzes } = await client
    .from("quizzes")
    .select("id, pass_mark_percent")
    .eq("course_id", courseId)
    .eq("is_required", true)
    .eq("is_published", true)
    .neq("kind", "practice")

  let computedGrade: string = "Distinction"

  if (requiredQuizzes && requiredQuizzes.length > 0) {
    const quizIds = requiredQuizzes.map((q) => q.id)
    const { data: attempts } = await client
      .from("quiz_attempts")
      .select("quiz_id, percent")
      .eq("user_id", userId)
      .in("quiz_id", quizIds)
      .eq("status", "graded")
      .eq("passed", true)

    const bestByQuiz = new Map<string, number>()
    for (const att of attempts ?? []) {
      const current = bestByQuiz.get(att.quiz_id) ?? -1
      const p = Number(att.percent) || 0
      if (p > current) bestByQuiz.set(att.quiz_id, p)
    }

    const scores = requiredQuizzes.map((q) => bestByQuiz.get(q.id) ?? 0)
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
    computedGrade = computeGrade(avgScore) ?? "Pass"
  }

  const input: IssueCertificateInput = {
    userId,
    courseId,
    courseTitle: course.title,
    grade: computedGrade,
  }
  const result = await issueCourseCertificate(input)

  if (result.status === "error") {
    return {
      isComplete,
      progressPercent,
      certificateIssued: false,
      certificateStatus: "failed",
    }
  }

  return {
    isComplete,
    progressPercent,
    certificateIssued: true,
    certificateStatus: result.status,
  }
}
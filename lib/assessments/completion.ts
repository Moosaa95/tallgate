import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  issueCourseCertificate,
  type IssueCertificateInput,
} from "@/lib/certificates/issueCertificate"
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

  const input: IssueCertificateInput = {
    userId,
    courseId,
    courseTitle: course.title,
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
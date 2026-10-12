"use server"

import { requireUser } from "@/lib/auth/guards"
import { createClient } from "@/lib/supabase/server"
import { checkCourseCompletion } from "@/lib/assessments/completion"
import { logError } from "@/lib/logging/logger"

export type LessonProgressResult =
  | { ok: true; completed: boolean; courseCompleted: boolean }
  | { ok: false; error: string }

function failure(error: string): LessonProgressResult {
  return { ok: false, error }
}

export async function completeLesson(lessonId: string): Promise<LessonProgressResult> {
  const user = await requireUser()

  const supabase = await createClient()

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("module_id, course_modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle()

  if (lessonError) {
    logError("lesson_progress.lesson_lookup_failed", lessonError, { lessonId })
    return failure("The lesson could not be updated.")
  }
  const courseId = lesson?.course_modules?.course_id
  if (!lesson || !courseId) {
    return failure("The lesson could not be found.")
  }

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .in("status", ["active", "completed"])
    .maybeSingle()

  if (!enrollment) {
    return failure("You are not enrolled in this course.")
  }

  const { error: progressError } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      is_completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  )

  if (progressError) {
    logError("lesson_progress.upsert_failed", progressError, { lessonId })
    return failure("Your progress could not be saved.")
  }

  let courseCompleted = false
  try {
    const completion = await checkCourseCompletion(user.id, courseId)
    courseCompleted = completion.isComplete
  } catch (error) {
    logError("lesson_progress.completion_failed", error, { courseId })
  }

  return { ok: true, completed: true, courseCompleted }
}

export async function saveLessonWatchProgress(
  lessonId: string,
  watchTimeSeconds: number
): Promise<LessonProgressResult> {
  const user = await requireUser()

  if (!Number.isFinite(watchTimeSeconds) || watchTimeSeconds < 0 || watchTimeSeconds > 86400) {
    return failure("Invalid watch duration.")
  }

  const supabase = await createClient()

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("module_id, course_modules(course_id)")
    .eq("id", lessonId)
    .maybeSingle()

  if (lessonError) {
    logError("lesson_progress.lesson_lookup_failed", lessonError, { lessonId })
    return failure("The lesson could not be updated.")
  }
  const courseId = lesson?.course_modules?.course_id
  if (!lesson || !courseId) {
    return failure("The lesson could not be found.")
  }

  const { error: progressError } = await supabase.from("lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      watch_time_seconds: Math.round(watchTimeSeconds),
      last_watched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  )

  if (progressError) {
    logError("lesson_progress.watch_upsert_failed", progressError, { lessonId })
    return failure("Your progress could not be saved.")
  }

  return { ok: true, completed: false, courseCompleted: false }
}
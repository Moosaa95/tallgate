import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, RateLimitUnavailableError, rateLimitResponse, rateLimitUnavailableResponse } from "@/lib/api/rateLimit"
import { readJsonObject } from "@/lib/api/request"
import { logError } from "@/lib/logging/logger"
import { authFailure, getAuthUser, rpcErrorResponse, validUuid } from "@/lib/assessments/rpc"
import { checkCourseCompletion } from "@/lib/assessments/completion"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAuthUser()
  if (!user) return authFailure()

  let allowed = false
  try {
    allowed = await checkRateLimit(req, "assessment", 10, 60, `user:${user.id}`)
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse()
    logError("attempts.submit.rate_limit_failed", error)
    return rateLimitUnavailableResponse()
  }
  if (!allowed) return rateLimitResponse(60)

  const parsed = await readJsonObject(req)
  if (parsed.response) return parsed.response
  const { attemptId } = parsed.data

  if (!validUuid(attemptId)) {
    return NextResponse.json({ error: "A valid attempt id is required." }, { status: 400 })
  }

  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_attempt_id: attemptId })

  if (error) {
    return rpcErrorResponse(error, "The attempt could not be submitted.", "attempts.submit.rpc_failed")
  }

  const { data: attemptRow, error: rowError } = await supabase
    .from("quiz_attempts")
    .select("quizzes(course_id)")
    .eq("id", attemptId)
    .single()

  if (rowError) {
    logError("attempts.submit.course_lookup_failed", rowError, { attemptId })
  }

  const courseId = attemptRow?.quizzes?.course_id ?? null
  let completion = null
  if (courseId) {
    try {
      completion = await checkCourseCompletion(user.id, courseId)
    } catch (completionError) {
      logError("attempts.submit.completion_failed", completionError, { attemptId, courseId })
    }
  }

  return NextResponse.json({ attempt: data, completion })
}
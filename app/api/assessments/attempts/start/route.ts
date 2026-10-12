import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, RateLimitUnavailableError, rateLimitResponse, rateLimitUnavailableResponse } from "@/lib/api/rateLimit"
import { readJsonObject } from "@/lib/api/request"
import { logError } from "@/lib/logging/logger"
import { authFailure, getAuthUser, rpcErrorResponse, validUuid } from "@/lib/assessments/rpc"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAuthUser()
  if (!user) return authFailure()

  let allowed = false
  try {
    allowed = await checkRateLimit(req, "assessment", 10, 60, `user:${user.id}`)
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse()
    logError("attempts.start.rate_limit_failed", error)
    return rateLimitUnavailableResponse()
  }
  if (!allowed) return rateLimitResponse(60)

  const parsed = await readJsonObject(req)
  if (parsed.response) return parsed.response
  const { quizId } = parsed.data

  if (!validUuid(quizId)) {
    return NextResponse.json({ error: "A valid quiz id is required." }, { status: 400 })
  }

  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId })

  if (error) {
    return rpcErrorResponse(error, "The quiz could not be started.", "attempts.start.rpc_failed")
  }

  return NextResponse.json({ attempt: data })
}
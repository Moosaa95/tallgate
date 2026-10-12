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
    allowed = await checkRateLimit(req, "assessment", 120, 60, `user:${user.id}`)
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse()
    logError("attempts.tabSwitch.rate_limit_failed", error)
    return rateLimitUnavailableResponse()
  }
  if (!allowed) return rateLimitResponse(60)

  const parsed = await readJsonObject(req)
  if (parsed.response) return parsed.response
  const { attemptId } = parsed.data

  if (!validUuid(attemptId)) {
    return NextResponse.json({ error: "A valid attempt id is required." }, { status: 400 })
  }

  const { data, error } = await supabase.rpc("log_attempt_tab_switch", { p_attempt_id: attemptId })

  if (error) {
    return rpcErrorResponse(error, "The attempt could not be updated.", "attempts.tabSwitch.rpc_failed")
  }

  return NextResponse.json({ tabSwitchCount: data?.tabSwitchCount ?? 0 })
}
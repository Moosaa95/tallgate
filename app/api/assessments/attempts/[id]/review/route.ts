import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, RateLimitUnavailableError, rateLimitResponse, rateLimitUnavailableResponse } from "@/lib/api/rateLimit"
import { logError } from "@/lib/logging/logger"
import { authFailure, getAuthUser, validUuid } from "@/lib/assessments/rpc"
import { getAttemptReview } from "@/lib/assessments/learner"

export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthUser()
  if (!user) return authFailure()

  let allowed = false
  try {
    allowed = await checkRateLimit(req, "assessment", 120, 60, `user:${user.id}`)
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse()
    logError("attempts.review.rate_limit_failed", error)
    return rateLimitUnavailableResponse()
  }
  if (!allowed) return rateLimitResponse(60)

  const { id } = await params
  if (!validUuid(id)) {
    return NextResponse.json({ error: "A valid attempt id is required." }, { status: 400 })
  }

  const review = await getAttemptReview(id)
  if (!review) {
    return NextResponse.json({ error: "This attempt could not be found." }, { status: 404 })
  }

  return NextResponse.json({ review })
}
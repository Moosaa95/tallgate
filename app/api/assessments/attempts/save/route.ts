import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, RateLimitUnavailableError, rateLimitResponse, rateLimitUnavailableResponse } from "@/lib/api/rateLimit"
import { readJsonObject } from "@/lib/api/request"
import { logError } from "@/lib/logging/logger"
import { authFailure, getAuthUser, rpcErrorResponse, validUuid } from "@/lib/assessments/rpc"
import { isRecord } from "@/lib/utils"

export const runtime = "nodejs"

const UUID_LIST = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:,(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}))*$/i

export async function POST(req: NextRequest) {
  const { user, supabase } = await getAuthUser()
  if (!user) return authFailure()

  let allowed = false
  try {
    allowed = await checkRateLimit(req, "assessment", 120, 60, `user:${user.id}`)
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse()
    logError("attempts.save.rate_limit_failed", error)
    return rateLimitUnavailableResponse()
  }
  if (!allowed) return rateLimitResponse(60)

  const parsed = await readJsonObject(req)
  if (parsed.response) return parsed.response
  const payload = parsed.data

  if (!isRecord(payload)) {
    return NextResponse.json({ error: "A valid payload is required." }, { status: 400 })
  }
  const attemptId = payload.attemptId
  const questionId = payload.questionId
  if (!isRecord(payload) || !validUuid(attemptId) || !validUuid(questionId)) {
    return NextResponse.json(
      { error: "A valid attempt id and question id are required." },
      { status: 400 }
    )
  }

  const selectedOptionIdsRaw = payload.selectedOptionIds
  let selectedOptionIds: string[] = []
  if (selectedOptionIdsRaw !== undefined && selectedOptionIdsRaw !== null) {
    if (
      !Array.isArray(selectedOptionIdsRaw) ||
      selectedOptionIdsRaw.some((value) => typeof value !== "string") ||
      !UUID_LIST.test(selectedOptionIdsRaw.join(","))
    ) {
      return NextResponse.json({ error: "Invalid selected options." }, { status: 400 })
    }
    selectedOptionIds = selectedOptionIdsRaw
  }

  const textAnswer = payload.textAnswer
  if (textAnswer !== undefined && textAnswer !== null && typeof textAnswer !== "string") {
    return NextResponse.json({ error: "Invalid answer text." }, { status: 400 })
  }

  const { data, error } = await supabase.rpc("save_attempt_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_option_ids: selectedOptionIds.length > 0 ? selectedOptionIds : undefined,
    p_text_answer: typeof textAnswer === "string" ? textAnswer : undefined,
  })

  if (error) {
    return rpcErrorResponse(error, "Your answer could not be saved.", "attempts.save.rpc_failed")
  }

  return NextResponse.json({ saved: data?.saved ?? true })
}
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logging/logger"
import { isNonEmptyString } from "@/lib/utils"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RpcError = { message?: string; code?: string } | null

export function rpcErrorMessage(error: RpcError, fallback: string): string {
  if (!error?.message) return fallback
  const known: Record<string, string> = {
    NOT_AUTHENTICATED: "Please sign in to continue.",
    QUIZ_NOT_FOUND: "This quiz could not be found.",
    QUIZ_NOT_PUBLISHED: "This quiz is not published yet.",
    NOT_ENROLLED: "You are not enrolled in this course.",
    ATTEMPT_LIMIT: "You have used all allowed attempts for this quiz.",
    COOLDOWN: "Please wait before retaking this quiz.",
    NO_QUESTIONS: "This quiz does not have any questions yet.",
    ATTEMPT_NOT_FOUND: "This attempt could not be found.",
    ATTEMPT_NOT_EDITABLE: "This attempt can no longer be edited.",
    ATTEMPT_EXPIRED: "The time for this attempt has expired.",
    QUESTION_NOT_IN_ATTEMPT: "This question is not part of the current attempt.",
    TEXT_TOO_LONG: "Your answer is too long.",
    NOT_AUTHORIZED: "You are not authorized to perform this action.",
  }
  return known[error.message] ?? fallback
}

export function authFailure(): NextResponse {
  return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 })
}

export async function getAuthUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { supabase, user: null as null }
  return { supabase, user: data.user }
}

export function validUuid(value: unknown): value is string {
  return isNonEmptyString(value) && UUID_PATTERN.test(value)
}

export function rpcErrorResponse(error: unknown, fallback: string, context: string): NextResponse {
  logError(context, error)
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: string }).code
    : undefined
  if (code === "22023" || code === "P0002" || code === "42501") {
    const message = rpcErrorMessage(error as RpcError, fallback)
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return NextResponse.json({ error: fallback }, { status: 500 })
}
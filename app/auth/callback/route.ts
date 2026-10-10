import { NextResponse } from "next/server"
import { createClient } from "@/lib/database/server"
import { safeNextPath } from "@/lib/auth/redirect"
import { isEmailOtpType } from "@/lib/auth/emailOtp"

/**
 * Auth callback used by both OAuth and email links.
 *
 * Email confirmation, magic links, invites, and recovery arrive with a
 * `token_hash` and `type`, which `verifyOtp` can verify without the PKCE code
 * verifier cookie. That makes them work when the link is opened on a different
 * device or browser. OAuth sign-in (and same-browser PKCE links) arrive with a
 * `code` that is exchanged for a session using the stored verifier.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = safeNextPath(searchParams.get("next")) ?? "/dashboard"
  const redirectUrl = new URL(next, origin)

  const supabase = await createClient()

  if (tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (!error) {
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(redirectUrl)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}

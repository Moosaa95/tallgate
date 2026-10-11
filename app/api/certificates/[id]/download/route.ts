import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth/guards"
import { logError } from "@/lib/logging/logger"

export const runtime = "nodejs"

const CERTIFICATE_BUCKET = "certificates"
const SIGNED_URL_TTL_SECONDS = 300

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireUser()

    const supabase = createAdminClient()

    const { data: certificate, error } = await supabase
      .from("certificates")
      .select("user_id, storage_path")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      logError("certificate_download.record_read_failed", error, { certificateId: id })
      return NextResponse.json(
        { error: "Certificate could not be loaded." },
        { status: 503 }
      )
    }

    if (!certificate || certificate.user_id !== user.id) {
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 }
      )
    }

    if (!certificate.storage_path) {
      return NextResponse.json(
        { error: "No certificate document is stored for this record." },
        { status: 404 }
      )
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(CERTIFICATE_BUCKET)
      .createSignedUrl(certificate.storage_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      logError("certificate_download.sign_failed", signError, { certificateId: id })
      return NextResponse.json(
        { error: "Certificate document could not be prepared." },
        { status: 503 }
      )
    }

    return NextResponse.redirect(signed.signedUrl, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error: unknown) {
    logError("certificate_download.request_failed", error)
    return NextResponse.json(
      { error: "Certificate document could not be prepared." },
      { status: 500 }
    )
  }
}
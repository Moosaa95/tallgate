import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth/guards"
import {
  generateUploadSignature,
  isCloudinaryConfigured,
  SignUploadOptions,
} from "@/lib/storage/cloudinary"
import { logError } from "@/lib/logging/logger"

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (admin.error) return admin.error

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment.",
      },
      { status: 503 }
    )
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<SignUploadOptions>
    const folder = typeof body.folder === "string" && body.folder.trim() ? body.folder.trim() : "tallgate/course-content"
    const validResourceTypes = ["auto", "image", "video", "raw"] as const
    const resource_type =
      body.resource_type && (validResourceTypes as readonly string[]).includes(body.resource_type)
        ? body.resource_type
        : "auto"

    const payload = generateUploadSignature({
      folder,
      resource_type,
    })

    return NextResponse.json(payload)
  } catch (err) {
    logError("admin.media_sign_failed", err)
    return NextResponse.json(
      { error: "Could not generate Cloudinary upload authorization." },
      { status: 500 }
    )
  }
}


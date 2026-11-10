import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth/guards"
import {
  isCloudinaryConfigured,
  uploadMediaBuffer,
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
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const folder = (formData.get("folder") as string | null) || "tallgate/course-content"
    const resourceType =
      (formData.get("resource_type") as "auto" | "image" | "video" | "raw" | null) || "auto"

    if (!file) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadResult = await uploadMediaBuffer(buffer, {
      folder,
      resource_type: resourceType,
    })

    return NextResponse.json({
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      resource_type: uploadResult.resource_type,
    })
  } catch (err) {
    logError("admin.media_server_upload_failed", err)
    return NextResponse.json(
      { error: "Failed to upload file to Cloudinary." },
      { status: 500 }
    )
  }
}


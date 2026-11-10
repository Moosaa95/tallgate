import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth/guards"
import {
  deleteCloudinaryMedia,
  isCloudinaryConfigured,
} from "@/lib/storage/cloudinary"
import { logError } from "@/lib/logging/logger"

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (admin.error) return admin.error

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured." },
      { status: 503 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const url = typeof body.url === "string" ? body.url.trim() : ""
    const publicId = typeof body.publicId === "string" ? body.publicId.trim() : ""
    const resourceType =
      body.resourceType === "video" || body.resourceType === "raw" || body.resourceType === "image"
        ? body.resourceType
        : undefined

    const target = url || publicId
    if (!target) {
      return NextResponse.json(
        { error: "A valid media URL or publicId is required." },
        { status: 400 }
      )
    }

    const result = await deleteCloudinaryMedia(target, resourceType)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    logError("admin.media_delete_failed", err)
    return NextResponse.json(
      { error: "Failed to delete Cloudinary media asset." },
      { status: 500 }
    )
  }
}


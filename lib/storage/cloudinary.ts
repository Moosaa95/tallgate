import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from "cloudinary"
import { logError } from "@/lib/logging/logger"

/**
 * Checks whether Cloudinary environment variables are configured.
 */
export function isCloudinaryConfigured(): boolean {
  const url = process.env.CLOUDINARY_URL
  if (url && url.trim()) return true

  const cloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  return Boolean(cloudName && apiKey && apiSecret)
}

/**
 * Retrieves the Cloudinary cloud name.
 */
export function getCloudinaryCloudName(): string {
  const cloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME
  if (cloudName && cloudName.trim()) return cloudName.trim()

  const url = process.env.CLOUDINARY_URL
  if (url) {
    const match = url.match(/@([^@/]+)$/)
    if (match?.[1]) return match[1].trim()
  }

  return ""
}

/**
 * Retrieves the Cloudinary API key.
 */
export function getCloudinaryApiKey(): string {
  const key = process.env.CLOUDINARY_API_KEY
  if (key && key.trim()) return key.trim()

  const url = process.env.CLOUDINARY_URL
  if (url) {
    const match = url.match(/cloudinary:\/\/([^:]+):/)
    if (match?.[1]) return match[1].trim()
  }

  return ""
}

/**
 * Retrieves the Cloudinary API secret.
 */
export function getCloudinaryApiSecret(): string {
  const secret = process.env.CLOUDINARY_API_SECRET
  if (secret && secret.trim()) return secret.trim()

  const url = process.env.CLOUDINARY_URL
  if (url) {
    const match = url.match(/cloudinary:\/\/[^:]+:([^@]+)@/)
    if (match?.[1]) return match[1].trim()
  }

  return ""
}

/**
 * Initializes and returns the configured Cloudinary SDK instance.
 */
export function getCloudinaryClient() {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary credentials are not configured.")
  }

  const url = process.env.CLOUDINARY_URL
  if (url && url.trim()) {
    cloudinary.config({ cloudinary_url: url.trim() })
  } else {
    cloudinary.config({
      cloud_name: getCloudinaryCloudName(),
      api_key: getCloudinaryApiKey(),
      api_secret: getCloudinaryApiSecret(),
      secure: true,
    })
  }

  return cloudinary
}

export type SignUploadOptions = {
  folder?: string
  resource_type?: "auto" | "image" | "video" | "raw"
  public_id?: string
  tags?: string
}

export type SignedUploadPayload = {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder?: string
  resourceType: "auto" | "image" | "video" | "raw"
  uploadUrl: string
}

/**
 * Generates a signed payload for client-side direct uploads.
 * Direct uploads bypass Next.js / Vercel body limits (e.g. 4.5MB),
 * allowing large video files and high-res documents to be uploaded directly to Cloudinary.
 */
export function generateUploadSignature(
  options: SignUploadOptions = {}
): SignedUploadPayload {
  const client = getCloudinaryClient()
  const apiSecret = getCloudinaryApiSecret()
  const apiKey = getCloudinaryApiKey()
  const cloudName = getCloudinaryCloudName()

  const timestamp = Math.round(Date.now() / 1000)
  const resourceType = options.resource_type ?? "auto"

  const paramsToSign: Record<string, string | number> = {
    timestamp,
  }

  if (options.folder) {
    paramsToSign.folder = options.folder
  }
  if (options.public_id) {
    paramsToSign.public_id = options.public_id
  }
  if (options.tags) {
    paramsToSign.tags = options.tags
  }

  const signature = client.utils.api_sign_request(paramsToSign, apiSecret)

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder: options.folder,
    resourceType,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
  }
}

/**
 * Checks if a given string or URL is hosted on Cloudinary.
 */
export function isCloudinaryUrl(url?: string | null): boolean {
  if (!url) return false
  return (
    url.includes("res.cloudinary.com") ||
    url.includes("api.cloudinary.com") ||
    url.startsWith("cloudinary://")
  )
}

export type ExtractedCloudinaryInfo = {
  publicId: string
  resourceType: "image" | "video" | "raw"
  format?: string
}

/**
 * Extracts publicId, resourceType, and format from a Cloudinary delivery URL.
 * Example URL:
 * https://res.cloudinary.com/cloudname/video/upload/v123456789/tallgate/course-content/video.mp4
 */
export function extractCloudinaryInfo(url: string): ExtractedCloudinaryInfo | null {
  if (!isCloudinaryUrl(url)) return null

  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split("/").filter(Boolean)
    // Format: [<cloudName>, <resource_type>, <upload_type>, ...transformations, <v1234>?, ...publicIdParts]
    if (segments.length < 4) return null

    const cloudNameIndex = 0
    const rawResourceType = segments[cloudNameIndex + 1]
    const resourceType =
      rawResourceType === "video" || rawResourceType === "raw" ? rawResourceType : "image"

    // Find index of 'upload' or delivery type
    const uploadIndex = segments.findIndex(
      (segment, idx) => idx > cloudNameIndex && (segment === "upload" || segment === "authenticated" || segment === "private")
    )

    if (uploadIndex === -1 || uploadIndex + 1 >= segments.length) return null

    // Rest of parts after upload and optional transformations
    const afterUpload = segments.slice(uploadIndex + 1)

    // Skip transformation segments and version segment (starts with 'v' followed by digits)
    const publicIdSegments: string[] = []
    let passedVersion = false

    for (const segment of afterUpload) {
      if (!passedVersion && /^v\d+$/.test(segment)) {
        passedVersion = true
        continue
      }
      // If we haven't seen version yet, check if this looks like a transformation (contains _, contains comma)
      if (!passedVersion && (segment.includes(",") || /^[a-z]_[a-z0-9_-]+$/i.test(segment))) {
        continue
      }
      publicIdSegments.push(segment)
    }

    if (publicIdSegments.length === 0) return null

    const rawLast = publicIdSegments[publicIdSegments.length - 1]
    const lastDotIndex = rawLast.lastIndexOf(".")
    let format: string | undefined

    if (resourceType === "raw") {
      // In Cloudinary, raw assets usually retain their file extension in public_id
      return {
        publicId: publicIdSegments.join("/"),
        resourceType,
        format: lastDotIndex !== -1 ? rawLast.slice(lastDotIndex + 1) : undefined,
      }
    }

    if (lastDotIndex !== -1) {
      format = rawLast.slice(lastDotIndex + 1)
      publicIdSegments[publicIdSegments.length - 1] = rawLast.slice(0, lastDotIndex)
    }

    return {
      publicId: publicIdSegments.join("/"),
      resourceType,
      format,
    }
  } catch (err) {
    logError("cloudinary.extract_info_failed", err, { url })
    return null
  }
}

/**
 * Server-side helper to delete an asset from Cloudinary.
 */
export async function deleteCloudinaryMedia(
  publicIdOrUrl: string,
  resourceType?: "image" | "video" | "raw"
): Promise<{ result: string }> {
  const client = getCloudinaryClient()

  let targetPublicId = publicIdOrUrl
  let targetResourceType = resourceType ?? "image"

  if (isCloudinaryUrl(publicIdOrUrl)) {
    const extracted = extractCloudinaryInfo(publicIdOrUrl)
    if (extracted) {
      targetPublicId = extracted.publicId
      targetResourceType = resourceType ?? extracted.resourceType
    }
  }

  try {
    const result = await client.uploader.destroy(targetPublicId, {
      resource_type: targetResourceType,
      invalidate: true,
    })
    return result as { result: string }
  } catch (err) {
    logError("cloudinary.delete_failed", err, { publicId: targetPublicId, resourceType: targetResourceType })
    throw err
  }
}

/**
 * Server-side fallback helper to upload a Buffer or stream to Cloudinary.
 */
export async function uploadMediaBuffer(
  buffer: Buffer,
  options: UploadApiOptions = {}
): Promise<UploadApiResponse> {
  const client = getCloudinaryClient()

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = client.uploader.upload_stream(
      {
        resource_type: options.resource_type ?? "auto",
        ...options,
      },
      (error, result) => {
        if (error || !result) {
          logError("cloudinary.upload_stream_failed", error)
          reject(error || new Error("Upload to Cloudinary failed with empty result."))
        } else {
          resolve(result)
        }
      }
    )

    uploadStream.end(buffer)
  })
}


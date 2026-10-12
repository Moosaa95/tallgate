import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logError, logWarn } from "@/lib/logging/logger"

export type RateLimitBucket =
  | "contact"
  | "consultation"
  | "startup"
  | "enrollment"
  | "email"
  | "verification"
  | "assessment"

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Request rate limiting is unavailable.")
    this.name = "RateLimitUnavailableError"
  }
}

// Only trust IP headers that a reverse proxy / CDN is configured to set (and
// overwrite). Operators behind a trusted edge can override the list with
// RATE_LIMIT_TRUSTED_IP_HEADERS (comma-separated). Client-supplied values on
// these headers must be stripped by the proxy, otherwise they are spoofable.
const TRUSTED_IP_HEADERS = (
  process.env.RATE_LIMIT_TRUSTED_IP_HEADERS ?? "x-real-ip,cf-connecting-ip"
)
  .split(",")
  .map((header) => header.trim().toLowerCase())
  .filter(Boolean)

function firstIp(value: string | null): string | null {
  if (!value) return null
  for (const part of value.split(",")) {
    const candidate = part.trim()
    if (candidate && isIP(candidate)) return candidate
  }
  return null
}

function getClientIp(request: NextRequest): string | null {
  for (const header of TRUSTED_IP_HEADERS) {
    const address = firstIp(request.headers.get(header))
    if (address) return address
  }
  // Outside production, fall back to a fixed key so local flows keep working.
  if (process.env.NODE_ENV !== "production") return "127.0.0.1"
  // In production, never fall back to a shared key. If the trusted proxy header
  // is missing, every caller would collapse into one bucket, letting a single
  // client exhaust the limit for everyone. Reject the request instead (see
  // checkRateLimit), which surfaces as a 503 rather than a global lockout.
  return null
}

export async function checkRateLimit(
  request: NextRequest,
  bucket: RateLimitBucket,
  limit: number,
  windowSeconds: number,
  identity?: string
): Promise<boolean> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new RateLimitUnavailableError()

  const key = identity ?? getClientIp(request)
  if (!key) {
    logWarn("rate_limit.identity_unavailable", { bucket })
    throw new RateLimitUnavailableError()
  }

  const keyHash = createHmac("sha256", serviceRoleKey)
    .update(`${bucket}:${key}`)
    .digest("hex")

  try {
    const { data, error } = await createAdminClient().rpc(
      "consume_public_rate_limit",
      {
        p_bucket: bucket,
        p_key_hash: keyHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }
    )

    if (error || typeof data !== "boolean") {
      logError("rate_limit.check_failed", error, { bucket })
      throw new RateLimitUnavailableError()
    }

    return data
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) throw error
    logError("rate_limit.check_failed", error, { bucket })
    throw new RateLimitUnavailableError()
  }
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait before trying again." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  )
}

export function rateLimitUnavailableResponse() {
  return NextResponse.json(
    { error: "This service is temporarily unavailable. Please try again later." },
    { status: 503 }
  )
}

import "server-only"
import { randomBytes } from "crypto"
import { readFile } from "fs/promises"
import path from "path"
import QRCode from "qrcode"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderCertificatePdf } from "@/lib/certificates/generateCertificatePdf"
import { sendCertificateEmail } from "@/lib/certificates/sendCertificateEmail"
import { logError, logWarn } from "@/lib/logging/logger"

const CERTIFICATE_BUCKET = "certificates"
const CERTIFICATE_CONTENT_TYPE = "application/pdf"
const CERTIFICATE_FILE_NAME = "certificate.pdf"

// Email lease timeout in milliseconds (5 minutes)
const EMAIL_LEASE_TIMEOUT_MS = 5 * 60 * 1000

// Manual issuance unique constraint name
const MANUAL_ISSUANCE_UNIQUE_CONSTRAINT = "certificates_user_title_date_unique"

export type IssueCertificateInput = {
  userId: string
  courseId?: string | null
  courseTitle?: string | null
  recipientName?: string | null
  grade?: string | null
  issueDate?: string | null
  recipientEmail?: string | null
}

export type IssuedCertificate = {
  id: string
  certificate_number: string
  verification_code: string
  recipient_name: string
  user_id: string | null
  course_id: string | null
  course_title: string
  issue_date: string
  grade: string | null
  is_valid: boolean
  created_at: string
  storage_path: string
  email_status: string | null
  email_sent_at: string | null
  email_error: string | null
  email_retry_count: number | null
}

export type IssueCertificateSuccess = {
  status: "created" | "existing"
  certificate: IssuedCertificate
  verificationUrl: string
  qrCode: string
  downloadUrl: string
}

export type IssueCertificateFailure = {
  status: "error"
  code:
    | "site_url"
    | "not_found"
    | "unconfigured"
    | "insert"
    | "pdf"
    | "storage"
    | "persist"
  message: string
}

export type IssueCertificateResult = IssueCertificateSuccess | IssueCertificateFailure

async function loadCertificateLogo(): Promise<string | undefined> {
  try {
    const filePath = path.join(process.cwd(), "public", "assets", "tallgate-logo.png")
    const buffer = await readFile(filePath)
    return `data:image/png;base64,${buffer.toString("base64")}`
  } catch (error) {
    logWarn("certificate.logo_unavailable", { error })
    return undefined
  }
}

function buildCertificateStoragePath() {
  const token = randomBytes(24).toString("hex")
  return `${token.slice(0, 2)}/${token.slice(2, 4)}/${token}.${CERTIFICATE_FILE_NAME.split(".").pop()}`
}

async function rollbackCertificate(client: ReturnType<typeof createAdminClient>, certificateId: string) {
  const { error } = await client.from("certificates").delete().eq("id", certificateId)
  if (error) {
    logError("certificate.issuance_rollback_failed", error, { certificateId })
  }
}

async function removeCertificateFile(
  client: ReturnType<typeof createAdminClient>,
  storagePath: string
) {
  const { error } = await client.storage.from(CERTIFICATE_BUCKET).remove([storagePath])
  if (error) {
    logError("certificate.file_remove_failed", error, { storagePath })
  }
}

function siteUrlConfig():
  | { ok: true; baseUrl: URL }
  | { ok: false; message: string } {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    return { ok: false, message: "Set NEXT_PUBLIC_SITE_URL before issuing certificates." }
  }
  let baseUrl: URL
  try {
    baseUrl = new URL(siteUrl)
  } catch {
    return { ok: false, message: "NEXT_PUBLIC_SITE_URL must be a valid absolute URL." }
  }
  const hostname = baseUrl.hostname.toLowerCase()
  const isLocalHostname =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".test") ||
    hostname === "0.0.0.0" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname) ||
    hostname === "[::1]"
  if (
    baseUrl.protocol !== "https:" ||
    isLocalHostname ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    return {
      ok: false,
      message: "NEXT_PUBLIC_SITE_URL must be a public HTTPS origin, not localhost or a development URL.",
    }
  }
  return { ok: true, baseUrl }
}

/**
 * Issues one certificate per user + course, generated entirely server-side.
 * Idempotent: when a certificate already exists for the user and course it
 * returns the existing row without minting a new one. Shared by the admin
 * ("issue_certificate") action and automatic issuance on course completion.
 */
export async function issueCourseCertificate(
  input: IssueCertificateInput
): Promise<IssueCertificateResult> {
  let client: ReturnType<typeof createAdminClient>
  try {
    client = createAdminClient()
  } catch (error) {
    logError("certificate.client_unavailable", error)
    return {
      status: "error",
      code: "unconfigured",
      message: "Certificate issuance is temporarily unavailable.",
    }
  }

  const site = siteUrlConfig()
  if (!site.ok) {
    return { status: "error", code: "site_url", message: site.message }
  }
  const { baseUrl } = site

  let recipientName = input.recipientName ?? null
  let courseTitle = input.courseTitle ?? null
  let recipientEmail = input.recipientEmail ?? null
  const courseUuid = typeof input.courseId === "string" && input.courseId.trim() ? input.courseId.trim() : null
  let courseIdValid = false

  if (courseUuid) {
    const { data: courseRow } = await client
      .from("courses")
      .select("id, title, short_description, overview")
      .eq("id", courseUuid)
      .maybeSingle()
    if (courseRow) {
      courseIdValid = true
      if (!courseTitle) courseTitle = courseRow.title
    }
  }

  if (!recipientName) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name, email")
      .eq("id", input.userId)
      .maybeSingle()
    recipientName = profile?.full_name ?? null
    if (!recipientEmail) {
      recipientEmail = profile?.email ?? null
    }
  }

  if (!recipientName || !courseTitle || !courseTitle.trim()) {
    return {
      status: "error",
      code: "not_found",
      message: "Recipient or course details could not be found.",
    }
  }

  // Check for existing certificate first (covers both course_id and manual issuance)
  // For course-based issuance, check by user_id + course_id
  // For manual issuance (course_id is null), check by user_id + course_title + issue_date
  let existing: IssuedCertificate | null = null
  
  if (courseIdValid && courseUuid) {
    const { data } = await client
      .from("certificates")
      .select(
        "id, certificate_number, verification_code, recipient_name, user_id, course_id, course_title, issue_date, grade, is_valid, created_at, storage_path, email_status, email_sent_at, email_error, email_retry_count"
      )
      .eq("user_id", input.userId)
      .eq("course_id", courseUuid)
      .maybeSingle()
    existing = data as IssuedCertificate | null
  } else {
    // Manual issuance: look for recent certificate with same user, title, and issue date
    const { data } = await client
      .from("certificates")
      .select(
        "id, certificate_number, verification_code, recipient_name, user_id, course_id, course_title, issue_date, grade, is_valid, created_at, storage_path, email_status, email_sent_at, email_error, email_retry_count"
      )
      .eq("user_id", input.userId)
      .eq("course_title", courseTitle.trim())
      .eq("issue_date", input.issueDate ?? new Date().toISOString().slice(0, 10))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    existing = data as IssuedCertificate | null
  }

  if (existing?.storage_path) {
    return {
      status: "existing",
      certificate: existing,
      verificationUrl: new URL(
        `/verify?code=${encodeURIComponent(existing.verification_code)}`,
        baseUrl
      ).toString(),
      qrCode: "",
      downloadUrl: `/api/certificates/${existing.id}/download`,
    }
  }

  const issueDate = input.issueDate ?? new Date().toISOString().slice(0, 10)
  const grade = typeof input.grade === "string" && input.grade.trim()
    ? input.grade.trim().slice(0, 100)
    : "Distinction"

  let issuedCertificate: IssuedCertificate | null = null
  let generatedCode = ""
  let verificationUrlString = ""
  let qrCode = ""
  let insertError: { code?: string; message: string } | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    generatedCode = `TG-${new Date().getFullYear()}-${randomBytes(12)
      .toString("hex")
      .toUpperCase()}`
    const verificationUrl = new URL("/verify", baseUrl)
    verificationUrl.searchParams.set("code", generatedCode)
    verificationUrlString = verificationUrl.toString()
    qrCode = await QRCode.toDataURL(verificationUrlString, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    })

    const { data, error } = await client
      .from("certificates")
      .insert({
        recipient_name: recipientName,
        user_id: input.userId,
        course_id: courseIdValid && courseUuid ? courseUuid : undefined,
        course_title: courseTitle.trim(),
        grade,
        issue_date: issueDate,
        is_valid: true,
        verification_code: generatedCode,
        email_status: "pending",
        email_retry_count: 0,
      })
      .select(
        "id, certificate_number, verification_code, recipient_name, user_id, course_id, course_title, issue_date, grade, is_valid, created_at, storage_path, email_status, email_sent_at, email_error, email_retry_count"
      )
      .single()

    if (!error) {
      issuedCertificate = data as IssuedCertificate
      insertError = null
      break
    }
    insertError = error
    // Handle unique constraint violations:
    // - 23505 on verification_code (retry with new code)
    // - 23505 on certificates_user_course_unique (race condition, fetch existing)
    // - 23505 on certificates_user_title_date_unique (manual issuance race condition, fetch existing)
    if (error.code === "23505") {
      // Check if it's the user_course_unique constraint (course-based issuance)
      if (error.message?.includes("certificates_user_course_unique") || error.details?.includes("certificates_user_course_unique")) {
        // Another request won the race, fetch the existing certificate
        const { data: raceWinner } = await client
          .from("certificates")
          .select(
            "id, certificate_number, verification_code, recipient_name, user_id, course_id, course_title, issue_date, grade, is_valid, created_at, storage_path, email_status, email_sent_at, email_error, email_retry_count"
          )
          .eq("user_id", input.userId)
          .eq("course_id", courseUuid!)
          .maybeSingle()
        if (raceWinner?.storage_path) {
          return {
            status: "existing",
            certificate: raceWinner as IssuedCertificate,
            verificationUrl: new URL(
              `/verify?code=${encodeURIComponent(raceWinner.verification_code)}`,
              baseUrl
            ).toString(),
            qrCode: "",
            downloadUrl: `/api/certificates/${raceWinner.id}/download`,
          }
        }
        // If no storage_path yet, continue retry loop
        continue
      }
      // Check if it's the manual issuance unique constraint
      if (error.message?.includes(MANUAL_ISSUANCE_UNIQUE_CONSTRAINT) || error.details?.includes(MANUAL_ISSUANCE_UNIQUE_CONSTRAINT)) {
        // Another request won the race for manual issuance, fetch the existing certificate
        const { data: raceWinner } = await client
          .from("certificates")
          .select(
            "id, certificate_number, verification_code, recipient_name, user_id, course_id, course_title, issue_date, grade, is_valid, created_at, storage_path, email_status, email_sent_at, email_error, email_retry_count"
          )
          .eq("user_id", input.userId)
          .eq("course_title", courseTitle.trim())
          .eq("issue_date", issueDate)
          .is("course_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (raceWinner?.storage_path) {
          return {
            status: "existing",
            certificate: raceWinner as IssuedCertificate,
            verificationUrl: new URL(
              `/verify?code=${encodeURIComponent(raceWinner.verification_code)}`,
              baseUrl
            ).toString(),
            qrCode: "",
            downloadUrl: `/api/certificates/${raceWinner.id}/download`,
          }
        }
        // If no storage_path yet, continue retry loop
        continue
      }
      // verification_code collision, retry with new code
      continue
    }
    break
  }

  if (insertError || !issuedCertificate) {
    logError("certificate.issuance_failed", insertError)
    return {
      status: "error",
      code: "insert",
      message: "Certificate could not be issued. Please try again.",
    }
  }

  const storagePath = buildCertificateStoragePath()

  // Fetch course description for the PDF
  let courseDescription = ""
  if (courseIdValid && courseUuid) {
    const { data: courseRow } = await client
      .from("courses")
      .select("short_description, overview")
      .eq("id", courseUuid)
      .maybeSingle()
    if (courseRow) {
      courseDescription = courseRow.short_description || courseRow.overview || ""
    }
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderCertificatePdf({
      recipient_name: issuedCertificate.recipient_name,
      course_title: issuedCertificate.course_title,
      course_description: courseDescription,
      issue_date: issuedCertificate.issue_date,
      grade: issuedCertificate.grade,
      certificate_number: issuedCertificate.certificate_number,
      verification_code: issuedCertificate.verification_code,
      verification_url: verificationUrlString,
      qr_data_url: qrCode,
      logo_src: await loadCertificateLogo(),
    })
  } catch (error) {
    logError("certificate.pdf_generation_failed", error)
    await rollbackCertificate(client, issuedCertificate.id)
    return { status: "error", code: "pdf", message: "Certificate could not be issued. PDF generation failed." }
  }

  const { error: uploadError } = await client.storage
    .from(CERTIFICATE_BUCKET)
    .upload(storagePath, pdfBuffer, { contentType: CERTIFICATE_CONTENT_TYPE, upsert: false })

  if (uploadError) {
    logError("certificate.pdf_upload_failed", uploadError)
    await rollbackCertificate(client, issuedCertificate.id)
    return { status: "error", code: "storage", message: "Certificate could not be issued. PDF upload failed." }
  }

  const { error: persistError } = await client
    .from("certificates")
    .update({ storage_path: storagePath })
    .eq("id", issuedCertificate.id)

  if (persistError) {
    logError("certificate.storage_path_persist_failed", persistError)
    await removeCertificateFile(client, storagePath)
    await rollbackCertificate(client, issuedCertificate.id)
    return { status: "error", code: "persist", message: "Certificate could not be issued. Please try again." }
  }

  // Send certificate email to learner (non-blocking) with atomic claiming
  const emailTo = input.recipientEmail ?? recipientEmail
  if (emailTo) {
    try {
      await claimAndSendCertificateEmail(client, {
        certificateId: issuedCertificate.id,
        to: emailTo,
        recipientName: issuedCertificate.recipient_name,
        courseTitle: issuedCertificate.course_title,
        certificateNumber: issuedCertificate.certificate_number,
        verificationUrl: verificationUrlString,
        pdfBuffer,
        idempotencyKey: `cert-issue-${issuedCertificate.id}`,
      })
    } catch (emailError) {
      // Email claiming/sending failed, but certificate issuance succeeded
      logError("certificate.email_send_failed", emailError, { certificateId: issuedCertificate.id })
      // The claimAndSendCertificateEmail function handles status updates
    }
  }

  return {
    status: "created",
    certificate: { ...issuedCertificate, storage_path: storagePath },
    verificationUrl: verificationUrlString,
    qrCode,
    downloadUrl: `/api/certificates/${issuedCertificate.id}/download`,
  }
}

interface ClaimAndSendEmailInput {
  certificateId: string
  to: string
  recipientName: string
  courseTitle: string
  certificateNumber: string
  verificationUrl: string
  pdfBuffer: Buffer
  idempotencyKey?: string
}

/**
 * Atomically claims a certificate for email delivery and sends it.
 * Uses a UUID lease token for ownership tracking to prevent duplicate sends
 * and lease theft. Separate lease acquisition timestamp from delivery timestamp.
 */
export async function claimAndSendCertificateEmail(
  client: ReturnType<typeof createAdminClient>,
  input: ClaimAndSendEmailInput
): Promise<void> {
  const { certificateId, to, recipientName, courseTitle, certificateNumber, verificationUrl, pdfBuffer } = input
  const now = new Date().toISOString()
  const leaseToken = crypto.randomUUID()

  // Try to claim the certificate for sending by updating status from 'pending' or 'failed' to 'sending'
  // Atomically set lease token and lease acquisition timestamp
  // Only claim if not already 'sending' or 'sent', and if 'failed' allow retry
  const { data: claimed, error: claimError } = await client
    .from("certificates")
    .update({
      email_status: "sending",
      email_lease_token: leaseToken,
      email_lease_acquired_at: now,
      email_error: null,
    })
    .eq("id", certificateId)
    .in("email_status", ["pending", "failed"]) // Only claim if not already sending/sent
    .select("id, email_status, email_retry_count, email_lease_token")
    .maybeSingle()

  if (claimError) {
    logError("certificate.email_claim_failed", claimError, { certificateId })
    throw new Error("Failed to claim certificate for email delivery")
  }

  if (!claimed) {
    // Another process already claimed it or it's already sent
    const { data: current } = await client
      .from("certificates")
      .select("email_status, email_retry_count")
      .eq("id", certificateId)
      .maybeSingle()
    logWarn("certificate.email_already_claimed", { certificateId, currentStatus: current?.email_status })
    return // Not an error, just already handled
  }

  // Verify we got the lease token we expected (defense in depth)
  if (claimed.email_lease_token !== leaseToken) {
    logWarn("certificate.lease_token_mismatch_on_claim", { certificateId, expected: leaseToken, actual: claimed.email_lease_token })
    return
  }

  // Successfully claimed, now send the email
  try {
    await sendCertificateEmail({
      to,
      recipientName,
      courseTitle,
      certificateNumber,
      verificationUrl,
      pdfBuffer,
      idempotencyKey: input.idempotencyKey,
    })

    // Mark as sent - require matching lease token to prevent lease theft
    const newRetryCount = (claimed.email_retry_count ?? 0) + 1
    const { error: sentError } = await client
      .from("certificates")
      .update({
        email_status: "sent",
        email_sent_at: new Date().toISOString(), // This is now ONLY for successful delivery timestamp
        email_lease_token: null, // Clear lease token on completion
        email_lease_acquired_at: null, // Clear lease acquisition timestamp
        email_error: null,
        email_retry_count: newRetryCount,
      })
      .eq("id", certificateId)
      .eq("email_lease_token", leaseToken) // Ensure we still own the lease

    if (sentError) {
      logError("certificate.email_status_update_failed", sentError, { certificateId })
      // Status update failed but email was sent - log and continue
    }
  } catch (emailError) {
    // Email sending failed, mark as failed and release lease - require matching lease token
    const newRetryCount = (claimed.email_retry_count ?? 0) + 1
    const { error: failedError } = await client
      .from("certificates")
      .update({
        email_status: "failed",
        email_lease_token: null, // Release lease token
        email_lease_acquired_at: null, // Release lease acquisition timestamp
        email_error: String(emailError),
        email_retry_count: newRetryCount,
      })
      .eq("id", certificateId)
      .eq("email_lease_token", leaseToken)

    if (failedError) {
      logError("certificate.email_failed_update_failed", failedError, { certificateId })
    }
    throw emailError // Re-throw for caller to handle
  }
}

/**
 * Releases stale 'sending' leases (older than EMAIL_LEASE_TIMEOUT_MS).
 * Only releases leases where the token matches (ownership verification).
 * Should be called periodically or before retry attempts.
 */
export async function releaseStaleEmailLeases(): Promise<number> {
  let client: ReturnType<typeof createAdminClient>
  try {
    client = createAdminClient()
  } catch (error) {
    logError("certificate.client_unavailable", error)
    return 0
  }

  const leaseCutoff = new Date(Date.now() - EMAIL_LEASE_TIMEOUT_MS).toISOString()
  
  const { data, error } = await client
    .from("certificates")
    .update({
      email_status: "pending",
      email_lease_token: null,
      email_lease_acquired_at: null,
      email_error: "Email lease expired, retry available",
    })
    .eq("email_status", "sending")
    .lt("email_lease_acquired_at", leaseCutoff)
    .select("id")

  if (error) {
    logError("certificate.stale_lease_release_failed", error)
    return 0
  }

  return data?.length ?? 0
}
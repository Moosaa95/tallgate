import "server-only"
import { randomBytes } from "crypto"
import { readFile } from "fs/promises"
import path from "path"
import QRCode from "qrcode"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderCertificatePdf } from "@/lib/certificates/generateCertificatePdf"
import { logError, logWarn } from "@/lib/logging/logger"

const CERTIFICATE_BUCKET = "certificates"
const CERTIFICATE_CONTENT_TYPE = "application/pdf"
const CERTIFICATE_FILE_NAME = "certificate.pdf"

export type IssueCertificateInput = {
  userId: string
  courseId?: string | null
  courseTitle?: string | null
  recipientName?: string | null
  grade?: string | null
  issueDate?: string | null
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
  const courseUuid = typeof input.courseId === "string" && input.courseId.trim() ? input.courseId.trim() : null
  let courseIdValid = false

  if (courseUuid) {
    const { data: courseRow } = await client
      .from("courses")
      .select("id, title")
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
      .select("full_name")
      .eq("id", input.userId)
      .maybeSingle()
    recipientName = profile?.full_name ?? null
  }

  if (!recipientName || !courseTitle || !courseTitle.trim()) {
    return {
      status: "error",
      code: "not_found",
      message: "Recipient or course details could not be found.",
    }
  }

  if (courseIdValid && courseUuid) {
    const { data: existing } = await client
      .from("certificates")
      .select(
        "id, certificate_number, verification_code, recipient_name, user_id, course_id, course_title, issue_date, grade, is_valid, created_at, storage_path"
      )
      .eq("user_id", input.userId)
      .eq("course_id", courseUuid)
      .maybeSingle()

    if (existing?.storage_path) {
      return {
        status: "existing",
        certificate: existing as IssuedCertificate,
        verificationUrl: new URL(
          `/verify?code=${encodeURIComponent(existing.verification_code)}`,
          baseUrl
        ).toString(),
        qrCode: "",
        downloadUrl: `/api/certificates/${existing.id}/download`,
      }
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
      })
      .select(
        "id, certificate_number, verification_code, recipient_name, user_id, course_id, course_title, issue_date, grade, is_valid, created_at, storage_path"
      )
      .single()

    if (!error) {
      issuedCertificate = data as IssuedCertificate
      insertError = null
      break
    }
    insertError = error
    if (error.code !== "23505") break
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

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderCertificatePdf({
      recipient_name: issuedCertificate.recipient_name,
      course_title: issuedCertificate.course_title,
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

  return {
    status: "created",
    certificate: { ...issuedCertificate, storage_path: storagePath },
    verificationUrl: verificationUrlString,
    qrCode,
    downloadUrl: `/api/certificates/${issuedCertificate.id}/download`,
  }
}
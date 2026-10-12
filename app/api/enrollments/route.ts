import { NextRequest, NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isNonEmptyString } from "@/lib/utils"
import {
  isNonEmptyText,
  isOptionalText,
  isValidEmailAddress,
  readJsonObject,
} from "@/lib/api/request"
import {
  checkRateLimit,
  rateLimitResponse,
  rateLimitUnavailableResponse,
  RateLimitUnavailableError,
} from "@/lib/api/rateLimit"
import { resolveEnrollmentCourse } from "@/lib/catalogue/enrollmentCourse"
import { logError } from "@/lib/logging/logger"

/**
 * POST /api/enrollments
 * Handles course enrollment intake from both guests and authenticated users.
 * 
 * NOTE: This intentionally writes to `service_inquiries` (as a lead/application) 
 * instead of `course_enrollments`. 
 * 
 * The manual admin workflow is:
 * 1. Admin reviews application in /admin/inquiries
 * 2. Admin contacts applicant and confirms payment
 * 3. Admin manually creates a user account (if guest)
 * 4. Admin manually inserts a record into `course_enrollments` to grant lesson player access.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = await readJsonObject(req)
    if (parsed.response) return parsed.response
    const {
      fullName,
      email,
      phone,
      courseSlug,
      courseTitle,
      schedulePreference,
      learningMode,
    } = parsed.data

    const courseSlugValue = isNonEmptyText(courseSlug, 120)
      ? courseSlug.trim()
      : null
    const courseTitleValue = isNonEmptyText(courseTitle, 200)
      ? courseTitle.trim()
      : null

    if (
      !isNonEmptyText(fullName, 120) ||
      !isValidEmailAddress(email) ||
      !isNonEmptyText(phone, 40) ||
      (!courseSlugValue && !courseTitleValue) ||
      !isOptionalText(schedulePreference, 120) ||
      !isOptionalText(learningMode, 120)
    ) {
      return NextResponse.json(
        { error: "Missing required enrollment information." },
        { status: 400 }
      )
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Enrollment requests are temporarily unavailable." },
        { status: 503 }
      )
    }

    if (!(await checkRateLimit(req, "enrollment", 5, 900))) {
      return rateLimitResponse(900)
    }

    const supabase = createAdminClient()

    // Course enrollment always carries a slug and is validated against the
    // published catalogue, so the server owns the authoritative title and price
    // and a tampered client cannot enroll in an unpublished course. Non-course
    // programme tracks (e.g. Startup Hub) legitimately submit a plain title.
    let courseLabel: string
    let coursePrice: number | null = null

    if (courseSlugValue) {
      const { data: courseRow, error: courseError } = await supabase
        .from("courses")
        .select("title, price_ngn, is_published")
        .eq("slug", courseSlugValue)
        .maybeSingle()

      if (courseError) {
        logError("enrollment.course_lookup_failed", courseError)
        return NextResponse.json(
          { error: "Enrollment requests are temporarily unavailable." },
          { status: 503 }
        )
      }

      const course = resolveEnrollmentCourse(courseRow)
      if (!course) {
        return NextResponse.json(
          { error: "This course is not available for enrollment." },
          { status: 400 }
        )
      }

      courseLabel = course.title
      coursePrice = course.priceNgn
    } else {
      courseLabel = courseTitleValue ?? ""
    }

    const priceSuffix =
      coursePrice === null ? "" : ` (₦${coursePrice.toLocaleString("en-NG")})`

    const { error: dbError } = await supabase.from("service_inquiries").insert([
      {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        company_name: `Enrollment: ${courseLabel}${priceSuffix}`,
        message: `Applicant requested enrollment for course ${courseLabel}${priceSuffix}. Schedule: ${
          isNonEmptyString(schedulePreference) ? schedulePreference : "Standard"
        }. Mode: ${isNonEmptyString(learningMode) ? learningMode : "Hybrid"}.`,
        status: "new",
      },
    ])

    if (dbError) {
      logError("enrollment.insert_failed", dbError)
      return NextResponse.json(
        { error: "Enrollment request could not be saved. Please try again." },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { success: true, message: "Enrollment application received." },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return rateLimitUnavailableResponse()
    }
    logError("enrollment.request_failed", error)
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    )
  }
}

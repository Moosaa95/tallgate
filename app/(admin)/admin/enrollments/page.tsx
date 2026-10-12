import React from "react"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { mockEnrollments, type MockEnrollment } from "@/lib/data/adminMockData"
import { toEnrollment } from "@/lib/data/adminRowMappers"
import { ADMIN_QUERY_LIMIT } from "@/lib/admin/queryLimits"
import EnrollmentsClient from "@/components/admin/EnrollmentsClient"
import { logError } from "@/lib/logging/logger"

export const metadata = {
  title: "Student Cohorts & Enrollments | TallGate Admin",
  description: "Monitor student progression, completion rates, and cohort velocity.",
}

export default async function AdminEnrollmentsPage() {
  const supabase = await createClient()
  const useMockData = !isSupabaseConfigured() && process.env.NODE_ENV === "development"

  // Mock data is only ever a development placeholder for an unconfigured
  // project. Once Supabase answers, its result is authoritative even when it
  // is empty: a zero-row table must render as empty, never as seeded rows.
  let enrollments: MockEnrollment[] = useMockData ? mockEnrollments : []
  let dataWarning = ""

  if (!isSupabaseConfigured()) {
    dataWarning = useMockData
      ? "Supabase is not configured, so this cohort view is showing sample data."
      : "Enrollments are unavailable because Supabase is not configured."
  } else {
    try {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select("*, profiles(full_name, email), courses(title)")
        .order("enrolled_at", { ascending: false })
        .limit(ADMIN_QUERY_LIMIT)

      if (error) {
        logError("admin.enrollments_query_failed", error)
        dataWarning = "Enrollments could not be loaded. This cohort view may be incomplete."
      } else {
        enrollments = (data ?? []).map((item) => toEnrollment(item, "Enrolled Student", "Technical Track"))
        if (enrollments.length === ADMIN_QUERY_LIMIT) {
          dataWarning = `Showing the ${ADMIN_QUERY_LIMIT} most recent enrollments. Older records are not displayed.`
        }
      }
    } catch (err) {
      logError("admin.enrollments_query_failed", err)
      dataWarning = "Enrollments could not be loaded. This cohort view may be incomplete."
    }
  }

  return (
    <div className="space-y-6">
      {dataWarning && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900"
        >
          {dataWarning}
        </div>
      )}
      <EnrollmentsClient initialEnrollments={enrollments} />
    </div>
  )
}
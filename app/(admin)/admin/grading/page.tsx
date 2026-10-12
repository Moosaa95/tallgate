import React from "react"
import Link from "next/link"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { ADMIN_QUERY_LIMIT } from "@/lib/admin/queryLimits"
import { logError } from "@/lib/logging/logger"
import { reviewStatusLabel } from "@/lib/assessments/types"
import { HiOutlineClipboardDocumentCheck, HiOutlineArrowRight } from "react-icons/hi2"

export const metadata = {
  title: "Attempt Grading | TallGate Admin",
  description: "Grade open-response assessment answers and complete pending attempts.",
}

type PendingAttempt = {
  id: string
  status: "in_progress" | "submitted" | "pending_grading" | "graded"
  submitted_at: string | null
  profiles: { full_name: string | null; email: string | null } | null
  quizzes: {
    title: string
    courses: { title: string | null; slug: string | null } | null
  } | null
}

function formatSubmitted(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default async function AdminGradingPage() {
  let attempts: PendingAttempt[] = []
  let loadWarning = ""
  let loadFailed = false

  if (!isSupabaseConfigured()) {
    loadFailed = true
    loadWarning = "Pending attempts are unavailable because Supabase is not configured."
  } else {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(
        "id, status, submitted_at, profiles(full_name, email), quizzes(title, courses(title, slug))"
      )
      .eq("status", "pending_grading")
      .order("submitted_at", { ascending: false })
      .limit(ADMIN_QUERY_LIMIT)

    if (error) {
      loadFailed = true
      logError("admin.grading_pending_load_failed", error)
      loadWarning =
        "Pending attempts could not be loaded. Check that the assessments migration has been applied."
    } else {
      attempts = (data ?? []) as PendingAttempt[]
      if (attempts.length === ADMIN_QUERY_LIMIT) {
        loadWarning = `Showing the ${ADMIN_QUERY_LIMIT} most recent pending attempts. Older records are not displayed.`
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Attempt Grading</h1>
        <p className="text-sm text-slate-300 mt-1">
          Grade open-response answers on submitted assessments. Grading a final open-response
          question completes the attempt, recomputes course progress, and triggers certificate
          issuance when the course is complete.
        </p>
      </div>

      {loadWarning && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900"
        >
          {loadWarning}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 shadow-lg shadow-slate-950/40 overflow-hidden">
        {!loadFailed && attempts.length === 0 && (
          <div className="p-10 text-center space-y-2">
            <HiOutlineClipboardDocumentCheck className="w-10 h-10 text-slate-500 mx-auto" aria-hidden="true" />
            <p className="text-sm font-semibold text-white">Nothing awaiting grading</p>
            <p className="text-xs text-slate-400">
              Attempts that only contain auto-graded questions never appear here. Open-response
              answers appear once a learner submits.
            </p>
          </div>
        )}

        {attempts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-semibold">Learner</th>
                  <th className="px-5 py-3 font-semibold">Assessment</th>
                  <th className="px-5 py-3 font-semibold">Course</th>
                  <th className="px-5 py-3 font-semibold">Submitted</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">
                        {attempt.profiles?.full_name || "Unknown learner"}
                      </p>
                      {attempt.profiles?.email && (
                        <p className="text-xs text-slate-400">{attempt.profiles.email}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-200">
                      {attempt.quizzes?.title || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {attempt.quizzes?.courses?.title || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {formatSubmitted(attempt.submitted_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="badge-neutral text-[11px]">
                        {reviewStatusLabel(attempt.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/grading/${attempt.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-white transition-colors"
                      >
                        Grade
                        <HiOutlineArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
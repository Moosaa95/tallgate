import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/database/server"
import { logError } from "@/lib/logging/logger"
import { reviewStatusLabel } from "@/lib/assessments/types"
import { HiOutlineArrowLeft } from "react-icons/hi"

export const metadata = {
  title: "Attempt History | TallGate",
  robots: { index: false, follow: false },
}

export default async function QuizHistoryPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>
}) {
  const { slug, quizId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/learn/courses/${slug}/quizzes/${quizId}/history`)

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title")
    .eq("id", quizId)
    .maybeSingle()
  if (!quiz) notFound()

  const { data: attempts, error } = await supabase
    .from("quiz_attempts")
    .select("id, status, percent, passed, score_points, max_points, started_at, submitted_at")
    .eq("quiz_id", quizId)
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })

  if (error) logError("assessments.history_failed", error, { quizId })

  return (
    <div className="site-shell min-h-screen text-slate-100 bg-[#09091a]">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link
            href={`/learn/courses/${slug}/quizzes`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <HiOutlineArrowLeft className="w-4 h-4" aria-hidden="true" />
            Assessments
          </Link>
          <h1 className="text-sm font-semibold text-white truncate">{quiz.title} — Attempts</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-3">
        {(!attempts || attempts.length === 0) && (
          <p className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            You have not attempted this assessment yet.
          </p>
        )}
        {(attempts ?? []).map((attempt, index) => (
          <div
            key={attempt.id}
            className="card-flat bg-slate-900/60 border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <p className="text-sm font-semibold text-white">Attempt {attempts!.length - index}</p>
              <p className="text-xs text-slate-400">
                {reviewStatusLabel(attempt.status)}
                {attempt.submitted_at
                  ? ` · ${new Date(attempt.submitted_at).toLocaleString()}`
                  : ` · started ${new Date(attempt.started_at).toLocaleString()}`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold text-white">
                  {attempt.percent === null ? "—" : `${Math.round(Number(attempt.percent))}%`}
                </p>
                {attempt.passed !== null && (
                  <p
                    className={`text-[11px] ${
                      attempt.passed ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {attempt.passed ? "Passed" : "Not passed"}
                  </p>
                )}
              </div>
              <Link
                href={`/learn/courses/${slug}/quizzes/${quizId}/results/${attempt.id}`}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/database/server"
import { logError } from "@/lib/logging/logger"
import { listCourseQuizzes } from "@/lib/assessments/learner"
import { QuizStartButton } from "@/components/learning/QuizStartButton"
import {
  HiOutlineArrowLeft,
  HiOutlineLockClosed,
  HiOutlineAcademicCap,
  HiOutlineLightningBolt,
} from "react-icons/hi"
import type { QuizSummary } from "@/lib/assessments/types"

export const metadata = {
  title: "Quizzes & Exams | TallGate",
  robots: { index: false, follow: false },
}

const KIND_LABELS: Record<QuizSummary["kind"], string> = {
  quiz: "Quiz",
  practice: "Practice test",
  exam: "Exam",
}

function formatCooldown(iso: string): string {
  const remaining = new Date(iso).getTime() - Date.now()
  if (remaining <= 0) return ""
  const minutes = Math.ceil(remaining / 60_000)
  if (minutes < 60) return `Available in ${minutes} min`
  const hours = Math.ceil(minutes / 60)
  return `Available in ${hours} hr`
}

export default async function CourseQuizzesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle()

  if (courseError) logError("assessments.quizzes_page_course_failed", courseError, { slug })
  if (!course) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let enrolled = false
  if (user) {
    const { data } = await supabase.rpc("is_enrolled", { p_course_id: course.id })
    enrolled = data === true
  }

  const quizzes = user && enrolled ? await listCourseQuizzes(course.id, user.id) : []

  const grouped = new Map<string, QuizSummary[]>()
  for (const quiz of quizzes) {
    const key = quiz.module_title ?? "General"
    const list = grouped.get(key) ?? []
    list.push(quiz)
    grouped.set(key, list)
  }

  return (
    <div className="site-shell min-h-screen text-slate-100 bg-[#09091a]">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href={`/learn/courses/${slug}/learn`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              <HiOutlineArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Back to course</span>
            </Link>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <h1 className="text-sm font-semibold text-white truncate">
              Quizzes &amp; Exams — {course.title}
            </h1>
          </div>
          {enrolled && (
            <Link
              href={`/learn/courses/${slug}/recall`}
              className="btn-secondary inline-flex items-center gap-2 text-xs px-3 py-1.5"
            >
              <HiOutlineLightningBolt className="w-3.5 h-3.5" aria-hidden="true" />
              Active recall
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {(!user || !enrolled) && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 sm:p-12 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <HiOutlineLockClosed className="w-7 h-7" aria-hidden="true" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h2 className="text-lg font-bold text-white">Enrollment required</h2>
              <p className="text-sm text-slate-400">
                Quizzes and exams are available to enrolled learners. Enroll in this course to
                track your assessment progress.
              </p>
            </div>
            <Link href={`/learning-hub/${slug}`} className="btn-primary inline-flex text-sm">
              View course details
            </Link>
          </div>
        )}

        {user && enrolled && quizzes.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-10 text-center space-y-3">
            <HiOutlineAcademicCap className="w-10 h-10 text-slate-500 mx-auto" aria-hidden="true" />
            <h2 className="text-base font-bold text-white">No assessments yet</h2>
            <p className="text-sm text-slate-400">
              This course does not have any published quizzes or exams. Check back later.
            </p>
          </div>
        )}

        {user &&
          enrolled &&
          [...grouped.entries()].map(([moduleTitle, items]) => (
            <section key={moduleTitle} className="space-y-4">
              <h2 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                {moduleTitle}
              </h2>
              <div className="space-y-3">
                {items.map((quiz) => {
                  const cooldown = quiz.nextEligibleAt ? formatCooldown(quiz.nextEligibleAt) : ""
                  const noAttemptsLeft =
                    quiz.attemptsRemaining !== null && quiz.attemptsRemaining <= 0
                  const startDisabled = !quiz.inProgressAttemptId && (noAttemptsLeft || Boolean(cooldown))
                  const disabledReason = quiz.inProgressAttemptId
                    ? null
                    : noAttemptsLeft
                      ? "No attempts remaining"
                      : cooldown || null

                  return (
                    <div
                      key={quiz.id}
                      className="card-flat bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-neutral text-[11px]">{KIND_LABELS[quiz.kind]}</span>
                        {quiz.is_required && (
                          <span className="badge-primary text-[11px]">Required</span>
                        )}
                        {quiz.passed && (
                          <span className="badge-success text-[11px]">Passed</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{quiz.title}</h3>
                        {quiz.instructions && (
                          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                            {quiz.instructions}
                          </p>
                        )}
                      </div>
                      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
                        {quiz.question_count !== null && (
                          <div className="flex gap-1.5">
                            <dt>Questions:</dt>
                            <dd className="text-slate-200">{quiz.question_count}</dd>
                          </div>
                        )}
                        {quiz.time_limit_minutes !== null && (
                          <div className="flex gap-1.5">
                            <dt>Time limit:</dt>
                            <dd className="text-slate-200">{quiz.time_limit_minutes} min</dd>
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <dt>Pass mark:</dt>
                          <dd className="text-slate-200">{quiz.pass_mark_percent}%</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt>Attempts:</dt>
                          <dd className="text-slate-200">
                            {quiz.attemptCount}
                            {quiz.max_attempts !== null ? ` of ${quiz.max_attempts}` : ""}
                          </dd>
                        </div>
                        {quiz.bestPercent !== null && (
                          <div className="flex gap-1.5">
                            <dt>Best score:</dt>
                            <dd className="text-slate-200">{Math.round(quiz.bestPercent)}%</dd>
                          </div>
                        )}
                      </dl>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <QuizStartButton
                          quizId={quiz.id}
                          courseSlug={slug}
                          label={
                            quiz.inProgressAttemptId
                              ? "Resume attempt"
                              : quiz.attemptCount > 0
                                ? "Retake"
                                : "Start"
                          }
                          resume={Boolean(quiz.inProgressAttemptId)}
                          variant={quiz.inProgressAttemptId ? "primary" : "secondary"}
                          disabledReason={disabledReason}
                        />
                        {quiz.attemptCount > 0 && (
                          <Link
                            href={`/learn/courses/${slug}/quizzes/${quiz.id}/history`}
                            className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
                          >
                            View attempts
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
      </main>
    </div>
  )
}
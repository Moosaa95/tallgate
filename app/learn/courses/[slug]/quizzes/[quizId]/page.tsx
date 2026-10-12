import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/database/server"
import { logError } from "@/lib/logging/logger"
import { getAttemptReview } from "@/lib/assessments/learner"
import { parseQuestionOrder, type QuizKind } from "@/lib/assessments/types"
import { QuizRunner } from "@/components/learning/QuizRunner"

export const metadata = {
  title: "Assessment | TallGate",
  robots: { index: false, follow: false },
}

export default async function QuizRunnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; quizId: string }>
  searchParams: Promise<{ attempt?: string }>
}) {
  const { slug, quizId } = await params
  const { attempt: attemptParam } = await searchParams
  const supabase = await createClient()

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()
  if (!course) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/learn/courses/${slug}/quizzes/${quizId}`)

  const { data: enrolled } = await supabase.rpc("is_enrolled", { p_course_id: course.id })
  if (enrolled !== true) redirect(`/learn/courses/${slug}/quizzes`)

  let attemptId = attemptParam
  if (!attemptId) {
    const { data: inProgress } = await supabase
      .from("quiz_attempts")
      .select("id")
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .maybeSingle()
    if (!inProgress) redirect(`/learn/courses/${slug}/quizzes`)
    attemptId = inProgress.id
  }

  const { data: attemptRow } = await supabase
    .from("quiz_attempts")
    .select("id, quiz_id, user_id, status, question_order, expires_at")
    .eq("id", attemptId)
    .maybeSingle()

  if (!attemptRow || attemptRow.user_id !== user.id) notFound()
  if (attemptRow.status !== "in_progress") {
    redirect(`/learn/courses/${slug}/quizzes/${quizId}/results/${attemptRow.id}`)
  }

  const review = await getAttemptReview(attemptRow.id)
  if (!review) notFound()

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("title, kind, instructions, feedback_mode, time_limit_minutes")
    .eq("id", quizId)
    .maybeSingle()

  if (quizError) logError("assessments.runner_quiz_failed", quizError, { quizId })
  if (!quiz) notFound()

  return (
    <div className="site-shell min-h-screen text-slate-100 bg-[#09091a]">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <QuizRunner
          courseSlug={slug}
          quizId={quizId}
          quizTitle={quiz.title}
          kind={quiz.kind as QuizKind}
          instructions={quiz.instructions}
          feedbackMode={quiz.feedback_mode}
          initialReview={review}
          questionOrder={parseQuestionOrder(attemptRow.question_order)}
        />
      </main>
    </div>
  )
}
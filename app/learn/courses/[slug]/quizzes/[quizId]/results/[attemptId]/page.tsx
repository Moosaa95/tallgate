import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/database/server"
import { getAttemptReview } from "@/lib/assessments/learner"
import { QuizResults } from "@/components/learning/QuizResults"

export const metadata = {
  title: "Assessment Results | TallGate",
  robots: { index: false, follow: false },
}

export default async function QuizResultsPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string; attemptId: string }>
}) {
  const { slug, quizId, attemptId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/learn/courses/${slug}/quizzes/${quizId}/results/${attemptId}`)

  const review = await getAttemptReview(attemptId)
  if (!review) notFound()
  if (review.status === "in_progress") {
    redirect(`/learn/courses/${slug}/quizzes/${quizId}?attempt=${attemptId}`)
  }

  return (
    <div className="site-shell min-h-screen text-slate-100 bg-[#09091a]">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <QuizResults review={review} courseSlug={slug} quizId={quizId} />
      </main>
    </div>
  )
}
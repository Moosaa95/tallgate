import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/database/server"
import { listRecallCards } from "@/lib/assessments/learner"
import { RecallFlashcards } from "@/components/learning/RecallFlashcards"
import { HiOutlineArrowLeft } from "react-icons/hi"

export const metadata = {
  title: "Active Recall | TallGate",
  robots: { index: false, follow: false },
}

export default async function RecallPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/learn/courses/${slug}/recall`)

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("slug", slug)
    .maybeSingle()
  if (!course) notFound()

  const { data: enrolled } = await supabase.rpc("is_enrolled", { p_course_id: course.id })
  if (enrolled !== true) redirect(`/learn/courses/${slug}/quizzes`)

  const cards = await listRecallCards(course.id, user.id)

  return (
    <div className="site-shell min-h-screen text-slate-100 bg-[#09091a]">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href={`/learn/courses/${slug}/quizzes`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <HiOutlineArrowLeft className="w-4 h-4" aria-hidden="true" />
              Assessments
            </Link>
            <h1 className="text-sm font-semibold text-white truncate">
              Active recall — {course.title}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <RecallFlashcards courseSlug={slug} userId={user.id} cards={cards} />
      </main>
    </div>
  )
}
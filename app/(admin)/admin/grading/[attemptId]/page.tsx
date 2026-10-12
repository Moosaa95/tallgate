import React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getAttemptReview } from "@/lib/assessments/learner"
import { AttemptGradingClient } from "@/components/admin/AttemptGradingClient"
import { HiOutlineArrowLeft } from "react-icons/hi2"

export const metadata = {
  title: "Grade Attempt | TallGate Admin",
  robots: { index: false, follow: false },
}

export default async function AdminGradeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>
}) {
  const { attemptId } = await params
  const review = await getAttemptReview(attemptId)
  if (!review) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/grading"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <HiOutlineArrowLeft className="w-4 h-4" aria-hidden="true" />
          Pending attempts
        </Link>
      </div>

      <AttemptGradingClient attemptId={attemptId} review={review} />
    </div>
  )
}
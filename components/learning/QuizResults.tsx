"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineMinusCircle,
  HiOutlineClock,
} from "react-icons/hi"
import type { AttemptReview, ReviewQuestion } from "@/lib/assessments/types"
import { reviewStatusLabel } from "@/lib/assessments/types"

type Filter = "all" | "correct" | "incorrect" | "unanswered"

interface QuizResultsProps {
  review: AttemptReview
  courseSlug: string
  quizId: string
}

function isAnswered(question: ReviewQuestion): boolean {
  return question.selectedOptionIds.length > 0 || (question.textAnswer ?? "").trim().length > 0
}

export function QuizResults({ review, courseSlug, quizId }: QuizResultsProps) {
  const [filter, setFilter] = useState<Filter>("all")

  const counts = useMemo(() => {
    let correct = 0
    let incorrect = 0
    let unanswered = 0
    for (const question of review.questions) {
      if (!isAnswered(question)) unanswered += 1
      else if (question.isCorrect === true) correct += 1
      else if (question.isCorrect === false) incorrect += 1
    }
    return { correct, incorrect, unanswered }
  }, [review.questions])

  const visible = review.questions.filter((question) => {
    if (filter === "all") return true
    if (filter === "correct") return question.isCorrect === true
    if (filter === "incorrect") return question.isCorrect === false
    return !isAnswered(question)
  })

  const scorePassed = review.passed === true
  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "All", count: review.questions.length },
    { key: "correct", label: "Correct", count: counts.correct },
    { key: "incorrect", label: "Incorrect", count: counts.incorrect },
    { key: "unanswered", label: "Unanswered", count: counts.unanswered },
  ]

  return (
    <div className="space-y-6">
      <div className="card-flat bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {review.quizTitle}
            </h1>
            <p className="text-xs text-slate-400">{reviewStatusLabel(review.status)}</p>
          </div>
          <Link
            href={`/learn/courses/${courseSlug}/quizzes`}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Back to assessments
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400">Score</p>
            <p className="text-2xl font-bold text-white">
              {Math.round(review.scorePoints)}
              <span className="text-sm text-slate-400">/{Math.round(review.maxPoints)}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Percentage</p>
            <p className="text-2xl font-bold text-white">
              {review.percent === null ? "—" : `${Math.round(review.percent)}%`}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Pass mark</p>
            <p className="text-2xl font-bold text-white">{review.passMarkPercent}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Outcome</p>
            <p
              className={`text-2xl font-bold ${
                review.passed === null
                  ? "text-slate-300"
                  : scorePassed
                    ? "text-emerald-400"
                    : "text-rose-400"
              }`}
            >
              {review.passed === null ? "Pending" : scorePassed ? "Passed" : "Not passed"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-white/10 pt-4 text-xs text-slate-400">
          {review.submittedAt && (
            <span className="flex items-center gap-1.5">
              <HiOutlineClock className="w-3.5 h-3.5" aria-hidden="true" />
              Submitted {new Date(review.submittedAt).toLocaleString()}
            </span>
          )}
          {review.kind === "exam" && <span>Tab switches: {review.tabSwitchCount}</span>}
        </div>

        {review.status === "pending_grading" && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-100">
            Some written answers are awaiting grading. Your final score will update once grading is
            complete.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            aria-pressed={filter === item.key}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === item.key
                ? "border-indigo-500/60 bg-indigo-600/20 text-white"
                : "border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visible.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            No questions match this filter.
          </p>
        )}
        {visible.map((question) => {
          const index = review.questions.indexOf(question)
          const answered = isAnswered(question)
          const answeredCorrect = question.isCorrect === true
          const answeredIncorrect = question.isCorrect === false
          return (
            <div
              key={question.questionId}
              className="card-flat bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0">
                  {answeredCorrect ? (
                    <HiOutlineCheckCircle className="w-5 h-5 text-emerald-400" aria-label="Correct" />
                  ) : answeredIncorrect ? (
                    <HiOutlineXCircle className="w-5 h-5 text-rose-400" aria-label="Incorrect" />
                  ) : (
                    <HiOutlineMinusCircle className="w-5 h-5 text-slate-500" aria-label="Not marked" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    <span className="text-slate-500">Q{index + 1}.</span> {question.prompt}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {question.points} {question.points === 1 ? "point" : "points"}
                    {question.isCorrect !== null && (
                      <>
                        {" · "}
                        {Math.round(question.pointsAwarded)} awarded
                      </>
                    )}
                  </p>
                </div>
              </div>

              {question.options.length > 0 && (
                <ul className="space-y-2 pl-8">
                  {question.options.map((option) => {
                    const selected = question.selectedOptionIds.includes(option.id)
                    const correct = option.isCorrect === true
                    return (
                      <li
                        key={option.id}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          correct
                            ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-100"
                            : selected
                              ? "border-rose-500/40 bg-rose-950/20 text-rose-100"
                              : "border-white/10 text-slate-300"
                        }`}
                      >
                        {option.label}
                        {correct && <span className="ml-2 text-emerald-400">Correct answer</span>}
                        {!correct && selected && (
                          <span className="ml-2 text-rose-400">Your answer</span>
                        )}
                        {correct && selected && (
                          <span className="ml-2 text-emerald-300">Your answer</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {(question.type === "short" || question.type === "essay") && (
                <div className="pl-8 space-y-2 text-xs">
                  <p className="text-slate-400">Your answer</p>
                  <p className="rounded-lg border border-white/10 bg-slate-950/40 p-3 text-slate-200 whitespace-pre-wrap">
                    {question.textAnswer?.trim() ? question.textAnswer : "No answer submitted"}
                  </p>
                  {question.graderFeedback && (
                    <p className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-3 text-indigo-100">
                      <span className="font-semibold text-indigo-300">Instructor feedback: </span>
                      {question.graderFeedback}
                    </p>
                  )}
                  {question.acceptedAnswers && question.acceptedAnswers.length > 0 && (
                    <p className="text-emerald-300">
                      Accepted: {question.acceptedAnswers.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {question.explanation && (
                <p className="pl-8 text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-200">Explanation: </span>
                  {question.explanation}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/learn/courses/${courseSlug}/quizzes/${quizId}`}
          className="btn-primary inline-flex text-sm"
        >
          {review.kind === "practice" ? "Practice again" : "Retake"}
        </Link>
      </div>
    </div>
  )
}
"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import type { AttemptReview, QuestionType } from "@/lib/assessments/types"

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "Single choice",
  multiple: "Multiple choice",
  true_false: "True / False",
  short: "Short answer",
  essay: "Essay",
}

interface AnswerGradeState {
  points: string
  feedback: string
}

export function AttemptGradingClient({
  attemptId,
  review,
}: {
  attemptId: string
  review: AttemptReview
}) {
  const router = useRouter()
  const [grades, setGrades] = useState<Record<string, AnswerGradeState>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [actionError, setActionError] = useState("")

  const pending = review.questions.filter((question) => question.isCorrect === null)
  const graded = review.questions.filter((question) => question.isCorrect !== null)

  function gradeState(questionId: string, fallback: string): AnswerGradeState {
    return grades[questionId] ?? { points: fallback, feedback: "" }
  }

  function selectedLabels(questionId: string): string[] {
    const question = review.questions.find((item) => item.questionId === questionId)
    if (!question) return []
    return question.options
      .filter((option) => question.selectedOptionIds.includes(option.id))
      .map((option) => option.label)
  }

  function correctLabels(question: (typeof review.questions)[number]): string[] {
    return question.options
      .filter((option) => option.isCorrect === true)
      .map((option) => option.label)
  }

  async function handleGrade(question: (typeof review.questions)[number]) {
    const state = gradeState(question.questionId, "0")
    const points = Number(state.points)
    if (!Number.isFinite(points) || points < 0 || points > question.points) {
      setActionError(`Points must be between 0 and ${question.points}.`)
      return
    }

    setActionError("")
    setSubmitting(question.questionId)

    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grade_attempt_answer",
          payload: {
            attempt_id: attemptId,
            question_id: question.questionId,
            points,
            feedback: state.feedback.trim() || null,
          },
        }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) {
        throw new Error(result.error || "The answer could not be graded.")
      }
      router.refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The answer could not be graded.")
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{review.quizTitle}</h1>
          <p className="text-sm text-slate-300 mt-1">
            {review.status === "graded"
              ? "Attempt complete"
              : "Grade each open-response answer to complete this attempt."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-bold text-white">
              {review.percent === null ? "—" : `${Math.round(review.percent)}%`}
            </p>
            <p className="text-[11px] text-slate-400">
              {review.scorePoints} / {review.maxPoints} points
            </p>
          </div>
<span
                    className={`badge px-3 py-1 text-xs ${
                      review.passed === true
                        ? "badge-success"
                        : review.passed === false
                          ? "badge-warning"
                          : "badge-neutral"
                    }`}
                  >
            {review.passed === true
              ? "Passed"
              : review.passed === false
                ? "Not passed"
                : "Awaiting grading"}
          </span>
        </div>
      </div>

      {review.status === "pending_grading" && pending.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-200">
          All answers for this attempt are graded now.
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-200"
        >
          {actionError}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
          Needs grading ({pending.length})
        </h2>
        {pending.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-400">
            No open-response answers remain. This attempt is ready.
          </p>
        )}
        {pending.map((question) => {
          const state = gradeState(question.questionId, "0")
          return (
            <div
              key={question.questionId}
              className="card-flat bg-slate-900/60 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-primary text-[11px]">
                  {QUESTION_TYPE_LABELS[question.type]}
                </span>
                <span className="badge-neutral text-[11px]">Worth {question.points} pt</span>
              </div>

              <p className="text-sm font-semibold text-white leading-relaxed">{question.prompt}</p>

              <div className="rounded-xl bg-slate-950/60 border border-white/10 p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">
                  Learner&apos;s answer
                </p>
                {question.type === "single" ||
                question.type === "multiple" ||
                question.type === "true_false" ? (
                  question.selectedOptionIds.length > 0 ? (
                    <ul className="space-y-1 text-sm text-slate-200">
                      {selectedLabels(question.questionId).map((label) => (
                        <li key={label}>• {label}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No selection given.</p>
                  )
                ) : question.textAnswer && question.textAnswer.trim() ? (
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {question.textAnswer}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 italic">No answer submitted.</p>
                )}
              </div>

              {(question.explanation || question.acceptedAnswers?.length || correctLabels(question).length > 0) && (
                <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-4 space-y-2">
                  {correctLabels(question).length > 0 && (
                    <div className="text-xs text-slate-300">
                      <span className="font-semibold text-indigo-300">Correct options: </span>
                      {correctLabels(question).join(", ")}
                    </div>
                  )}
                  {question.acceptedAnswers && question.acceptedAnswers.length > 0 && (
                    <div className="text-xs text-slate-300">
                      <span className="font-semibold text-indigo-300">Accepted answers: </span>
                      {question.acceptedAnswers.join(" · ")}
                    </div>
                  )}
                  {question.explanation && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      <span className="font-semibold text-indigo-300">Guidance: </span>
                      {question.explanation}
                    </p>
                  )}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    Points awarded (max {question.points})
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={question.points}
                    step={1}
                    value={state.points}
                    onChange={(event) =>
                      setGrades((current) => ({
                        ...current,
                        [question.questionId]: {
                          ...state,
                          points: event.target.value,
                        },
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">
                    Feedback (optional)
                  </span>
                  <input
                    type="text"
                    maxLength={4000}
                    value={state.feedback}
                    onChange={(event) =>
                      setGrades((current) => ({
                        ...current,
                        [question.questionId]: {
                          ...state,
                          feedback: event.target.value,
                        },
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    placeholder="Comment for the learner (optional)"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleGrade(question)}
                  disabled={submitting !== null}
                  className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {submitting === question.questionId ? "Saving…" : "Save grade"}
                </button>
              </div>
            </div>
          )
        })}
      </section>

      {graded.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Graded questions ({graded.length})
          </h2>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 divide-y divide-white/5">
            {graded.map((question) => (
              <div key={question.questionId} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200 leading-relaxed">
                    {question.prompt}
                  </p>
                  <span
                    className={`badge text-[11px] ${
                      question.isCorrect === true
                        ? "badge-success"
                        : question.isCorrect === false
                          ? "badge-alert"
                          : "badge-neutral"
                    }`}
                  >
                    {question.isCorrect === true
                      ? "Correct"
                      : question.isCorrect === false
                        ? "Incorrect"
                        : "Manual"}
                    {" · "}
                    {question.pointsAwarded}/{question.points}
                  </span>
                </div>
                {question.graderFeedback && (
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-300 font-semibold">Feedback: </span>
                    {question.graderFeedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  HiOutlineFlag,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineExclamationCircle,
} from "react-icons/hi"
import type {
  AttemptReview,
  AttemptQuestionOrderEntry,
  QuizKind,
  ReviewQuestion,
} from "@/lib/assessments/types"

interface QuizRunnerProps {
  courseSlug: string
  quizId: string
  quizTitle: string
  kind: QuizKind
  instructions: string | null
  feedbackMode: "immediate" | "after_submit"
  initialReview: AttemptReview
  questionOrder: AttemptQuestionOrderEntry[]
}

type SaveState = "idle" | "saving" | "saved" | "error"

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function QuizRunner({
  courseSlug,
  quizId,
  quizTitle,
  kind,
  instructions,
  feedbackMode,
  initialReview,
  questionOrder,
}: QuizRunnerProps) {
  const router = useRouter()
  const timed = Boolean(initialReview.expiresAt) && kind !== "practice"

  const orderedQuestions = useMemo(() => {
    const orderIndex = new Map(questionOrder.map((entry, index) => [entry.questionId, index]))
    const optionIndex = new Map(
      questionOrder.map((entry) => [entry.questionId, entry.optionIds])
    )
    return [...initialReview.questions]
      .sort(
        (a, b) =>
          (orderIndex.get(a.questionId) ?? 0) - (orderIndex.get(b.questionId) ?? 0)
      )
      .map((question) => {
        const optionIds = optionIndex.get(question.questionId)
        if (!optionIds || optionIds.length === 0) return question
        const byId = new Map(question.options.map((option) => [option.id, option]))
        const ordered = optionIds
          .map((id) => byId.get(id))
          .filter((option): option is ReviewQuestion["options"][number] => Boolean(option))
        const extras = question.options.filter((option) => !optionIds.includes(option.id))
        return { ...question, options: [...ordered, ...extras] }
      })
  }, [initialReview.questions, questionOrder])

  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; text: string }>>(
    () => {
      const initial: Record<string, { selected: string[]; text: string }> = {}
      for (const question of initialReview.questions) {
        initial[question.questionId] = {
          selected: question.selectedOptionIds ?? [],
          text: question.textAnswer ?? "",
        }
      }
      return initial
    }
  )
  const [flags, setFlags] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})
  const [results, setResults] = useState<Record<string, ReviewQuestion>>({})
  const [remaining, setRemaining] = useState(() =>
    initialReview.expiresAt
      ? Math.max(0, Math.floor((new Date(initialReview.expiresAt).getTime() - Date.now()) / 1000))
      : 0
  )
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [tabSwitches, setTabSwitches] = useState(initialReview.tabSwitchCount)

  const answersRef = useRef(answers)

  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const submittedRef = useRef(false)

  const refreshReview = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessments/attempts/${initialReview.attemptId}/review`, {
        cache: "no-store",
      })
      if (!res.ok) return
      const payload = await res.json().catch(() => null)
      const questions: ReviewQuestion[] | undefined = payload?.review?.questions
      if (!Array.isArray(questions)) return
      const map: Record<string, ReviewQuestion> = {}
      for (const question of questions) map[question.questionId] = question
      setResults(map)
    } catch {
      // Immediate feedback is best-effort; a failed refresh does not block the attempt.
    }
  }, [initialReview.attemptId])

  const persistAnswer = useCallback(
    async (questionId: string) => {
      const answer = answersRef.current[questionId]
      if (!answer) return
      setSaveState((state) => ({ ...state, [questionId]: "saving" }))
      try {
        const res = await fetch("/api/assessments/attempts/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: initialReview.attemptId,
            questionId,
            selectedOptionIds: answer.selected,
            textAnswer: answer.text,
          }),
        })
        if (!res.ok) {
          setSaveState((state) => ({ ...state, [questionId]: "error" }))
          return
        }
        setSaveState((state) => ({ ...state, [questionId]: "saved" }))
        if (feedbackMode === "immediate") await refreshReview()
      } catch {
        setSaveState((state) => ({ ...state, [questionId]: "error" }))
      }
    },
    [feedbackMode, initialReview.attemptId, refreshReview]
  )

  const scheduleSave = useCallback(
    (questionId: string) => {
      const existing = debounceRef.current[questionId]
      if (existing) clearTimeout(existing)
      debounceRef.current[questionId] = setTimeout(() => {
        void persistAnswer(questionId)
      }, 700)
    },
    [persistAnswer]
  )

  const submitAttempt = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      setSubmitError("")
      try {
        const res = await fetch("/api/assessments/attempts/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: initialReview.attemptId }),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          submittedRef.current = false
          setSubmitting(false)
          setSubmitError(payload?.error ?? "Your attempt could not be submitted. Please try again.")
          return
        }
        router.push(
          `/learn/courses/${courseSlug}/quizzes/${quizId}/results/${initialReview.attemptId}`
        )
        router.refresh()
      } catch {
        submittedRef.current = false
        setSubmitting(false)
        setSubmitError(
          auto
            ? "Time is up, but your attempt could not be submitted. Please submit manually."
            : "Your attempt could not be submitted. Please check your connection and try again."
        )
        setConfirming(true)
      }
    },
    [courseSlug, initialReview.attemptId, quizId, router]
  )

  useEffect(() => {
    if (!timed) return
    const tick = () => {
      const secs = Math.max(
        0,
        Math.floor((new Date(initialReview.expiresAt as string).getTime() - Date.now()) / 1000)
      )
      setRemaining(secs)
      if (secs <= 0 && !submittedRef.current) void submitAttempt(true)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timed, initialReview.expiresAt, submitAttempt])

  useEffect(() => {
    if (kind !== "exam") return
    const handler = () => {
      if (document.hidden && !submittedRef.current) {
        setTabSwitches((count) => count + 1)
        void fetch("/api/assessments/attempts/tab-switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: initialReview.attemptId }),
        }).catch(() => undefined)
      }
    }
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [kind, initialReview.attemptId])

  useEffect(() => {
    const timers = debounceRef.current
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer)
    }
  }, [])

  const question = orderedQuestions[current]
  const progress = saveState[question.questionId]
  const currentResult = results[question.questionId]
  const answeredCount = orderedQuestions.filter((item) => {
    const answer = answers[item.questionId]
    return answer && (answer.selected.length > 0 || answer.text.trim().length > 0)
  }).length

  function setAnswer(questionId: string, updater: (prev: { selected: string[]; text: string }) => { selected: string[]; text: string }) {
    setAnswers((state) => {
      const previous = state[questionId] ?? { selected: [], text: "" }
      return { ...state, [questionId]: updater(previous) }
    })
    scheduleSave(questionId)
  }

  function toggleOption(questionId: string, optionId: string, multiple: boolean) {
    setAnswer(questionId, (prev) => {
      if (multiple) {
        const exists = prev.selected.includes(optionId)
        return {
          ...prev,
          selected: exists
            ? prev.selected.filter((id) => id !== optionId)
            : [...prev.selected, optionId],
        }
      }
      return { ...prev, selected: [optionId] }
    })
  }

  function toggleFlag(questionId: string) {
    setFlags((state) => {
      const next = new Set(state)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  const isMultiple = question.type === "multiple"
  const isText = question.type === "short" || question.type === "essay"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{quizTitle}</h1>
          <p className="text-xs text-slate-400">
            Question {current + 1} of {orderedQuestions.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {progress && (
            <span
              className="text-xs text-slate-400"
              role="status"
              aria-live="polite"
            >
              {progress === "saving"
                ? "Saving…"
                : progress === "saved"
                  ? "Saved"
                  : progress === "error"
                    ? "Not saved — retrying on next change"
                    : ""}
            </span>
          )}
          {timed && (
            <span
              className={`text-sm font-semibold tabular-nums ${
                remaining <= 60 ? "text-rose-400" : "text-white"
              }`}
              aria-label={`Time remaining ${formatClock(remaining)}`}
            >
              {formatClock(remaining)}
            </span>
          )}
        </div>
      </div>

      {instructions && current === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300 leading-relaxed">
          {instructions}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8">
          <div className="card-flat bg-slate-900/60 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm sm:text-base font-medium text-white leading-relaxed">
                {question.prompt}
              </p>
              <button
                type="button"
                onClick={() => toggleFlag(question.questionId)}
                aria-pressed={flags.has(question.questionId)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  flags.has(question.questionId)
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : "border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <HiOutlineFlag className="w-3.5 h-3.5" aria-hidden="true" />
                {flags.has(question.questionId) ? "Flagged" : "Flag"}
              </button>
            </div>

            {isText ? (
              question.type === "essay" ? (
                <textarea
                  value={answers[question.questionId]?.text ?? ""}
                  onChange={(event) =>
                    setAnswer(question.questionId, (prev) => ({ ...prev, text: event.target.value }))
                  }
                  rows={6}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white focus:border-indigo-500/60 focus:outline-none"
                  placeholder="Type your answer…"
                />
              ) : (
                <input
                  type="text"
                  value={answers[question.questionId]?.text ?? ""}
                  onChange={(event) =>
                    setAnswer(question.questionId, (prev) => ({ ...prev, text: event.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white focus:border-indigo-500/60 focus:outline-none"
                  placeholder="Type your answer…"
                />
              )
            ) : (
              <fieldset className="space-y-2">
                <legend className="sr-only">{question.prompt}</legend>
                {question.options.map((option) => {
                  const checked = answers[question.questionId]?.selected.includes(option.id) ?? false
                  const showCorrect = currentResult && option.isCorrect !== null
                  return (
                    <label
                      key={option.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-sm cursor-pointer transition-colors ${
                        checked
                          ? "border-indigo-500/50 bg-indigo-600/10 text-white"
                          : "border-white/10 text-slate-300 hover:border-white/20"
                      } ${
                        showCorrect && option.isCorrect
                          ? "border-emerald-500/50"
                          : showCorrect && checked && !option.isCorrect
                            ? "border-rose-500/50"
                            : ""
                      }`}
                    >
                      <input
                        type={isMultiple ? "checkbox" : "radio"}
                        name={question.questionId}
                        checked={checked}
                        onChange={() => toggleOption(question.questionId, option.id, isMultiple)}
                        className="mt-0.5"
                      />
                      <span className="flex-1">{option.label}</span>
                    </label>
                  )
                })}
              </fieldset>
            )}

            {feedbackMode === "immediate" && currentResult && currentResult.isCorrect !== null && (
              <div
                className={`rounded-xl border p-4 text-sm space-y-2 ${
                  currentResult.isCorrect
                    ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                    : "border-rose-500/40 bg-rose-950/30 text-rose-100"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {currentResult.isCorrect ? (
                    <HiOutlineCheckCircle className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <HiOutlineXCircle className="w-4 h-4" aria-hidden="true" />
                  )}
                  {currentResult.isCorrect ? "Correct" : "Incorrect"}
                </div>
                {currentResult.explanation && (
                  <p className="text-xs leading-relaxed text-slate-200">
                    {currentResult.explanation}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setCurrent((index) => Math.max(0, index - 1))}
                disabled={current === 0}
                className="btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-40"
              >
                <HiOutlineChevronLeft className="w-4 h-4" aria-hidden="true" />
                Previous
              </button>
              {current < orderedQuestions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrent((index) => Math.min(orderedQuestions.length - 1, index + 1))}
                  className="btn-primary inline-flex items-center gap-1.5 text-sm"
                >
                  Next
                  <HiOutlineChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="btn-primary inline-flex items-center gap-1.5 text-sm"
                >
                  Review &amp; submit
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-4">
          <div className="card-flat bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Questions</h2>
              <span className="text-xs text-slate-400">
                {answeredCount}/{orderedQuestions.length} answered
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {orderedQuestions.map((item, index) => {
                const answer = answers[item.questionId]
                const isAnswered = answer && (answer.selected.length > 0 || answer.text.trim().length > 0)
                return (
                  <button
                    key={item.questionId}
                    type="button"
                    onClick={() => setCurrent(index)}
                    aria-current={index === current ? "true" : undefined}
                    aria-label={`Question ${index + 1}${isAnswered ? ", answered" : ", unanswered"}${
                      flags.has(item.questionId) ? ", flagged" : ""
                    }`}
                    className={`relative aspect-square rounded-lg border text-xs font-medium transition-colors ${
                      index === current
                        ? "border-indigo-500/60 bg-indigo-600/20 text-white"
                        : isAnswered
                          ? "border-white/15 bg-white/[0.06] text-white"
                          : "border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    {index + 1}
                    {flags.has(item.questionId) && (
                      <HiOutlineFlag
                        className="absolute right-0.5 top-0.5 w-2.5 h-2.5 text-amber-400"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {kind === "exam" && tabSwitches > 0 && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-300">
                <HiOutlineExclamationCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {tabSwitches} tab switch{tabSwitches === 1 ? "" : "es"} recorded
              </p>
            )}

            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="btn-primary w-full text-sm"
            >
              Submit attempt
            </button>
          </div>
        </aside>
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 space-y-4">
            <h2 id="submit-confirm-title" className="text-base font-bold text-white">
              Submit this attempt?
            </h2>
            <p className="text-sm text-slate-300">
              You have answered {answeredCount} of {orderedQuestions.length} questions. Once
              submitted you cannot change your answers.
            </p>
            {submitError && (
              <p role="alert" className="text-xs text-rose-400">
                {submitError}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="btn-secondary text-sm"
              >
                Keep working
              </button>
              <button
                type="button"
                onClick={() => void submitAttempt(false)}
                disabled={submitting}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit attempt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { RecallCard } from "@/lib/assessments/types"

const BOX_INTERVALS_MINUTES: Record<number, number> = {
  1: 10,
  2: 60 * 24,
  3: 60 * 24 * 4,
}

interface RecallFlashcardsProps {
  courseSlug: string
  userId: string
  cards: RecallCard[]
}

export function RecallFlashcards({ courseSlug, userId, cards }: RecallFlashcardsProps) {
  const supabase = useMemo(() => createClient(), [])

  const [queue, setQueue] = useState<RecallCard[]>(() =>
    [...cards].sort((a, b) => {
      const aDue = !a.nextReviewAt || new Date(a.nextReviewAt).getTime() <= Date.now()
      const bDue = !b.nextReviewAt || new Date(b.nextReviewAt).getTime() <= Date.now()
      if (aDue !== bDue) return aDue ? -1 : 1
      return a.box - b.box
    })
  )
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [saveError, setSaveError] = useState("")

  const card = queue[index]
  const done = !card

  async function record(card: RecallCard, gotIt: boolean) {
    const nextBox = gotIt ? Math.min(3, card.box + 1) : 1
    const nextReviewAt = new Date(
      Date.now() + BOX_INTERVALS_MINUTES[nextBox] * 60_000
    ).toISOString()

    setQueue((current) =>
      current.map((item) =>
        item.questionId === card.questionId
          ? { ...item, box: nextBox, nextReviewAt }
          : item
      )
    )
    setReviewed((count) => count + 1)
    setRevealed(false)
    setIndex((current) => current + 1)
    setSaveError("")

    const { error } = await supabase.from("recall_progress").upsert(
      {
        user_id: userId,
        question_id: card.questionId,
        box: nextBox,
        next_review_at: nextReviewAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,question_id" }
    )
    if (error) setSaveError("Your progress could not be saved. Check your connection.")
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-10 text-center space-y-3">
        <h2 className="text-base font-bold text-white">No recall cards yet</h2>
        <p className="text-sm text-slate-400">
          Active recall uses this course&apos;s questions. Once questions are added, they will appear
          here as flashcards.
        </p>
        <Link href={`/learn/courses/${courseSlug}/quizzes`} className="btn-secondary inline-flex text-sm">
          Back to assessments
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-10 text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Session complete</h2>
        <p className="text-sm text-slate-300">
          You reviewed {reviewed} {reviewed === 1 ? "card" : "cards"} this session.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIndex(0)
              setReviewed(0)
              setRevealed(false)
            }}
            className="btn-primary text-sm"
          >
            Review again
          </button>
          <Link href={`/learn/courses/${courseSlug}/quizzes`} className="btn-secondary text-sm">
            Back to assessments
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Card {index + 1} of {queue.length}
        </span>
        <span>Recall box {card.box} of 3</span>
      </div>

      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="w-full text-left card-flat bg-slate-900/60 border border-white/10 rounded-2xl p-6 sm:p-10 min-h-[16rem] flex flex-col justify-center gap-4 transition-colors hover:border-white/20"
      >
        <p className="text-xs uppercase tracking-wider text-indigo-300">Prompt</p>
        <p className="text-base sm:text-lg font-medium text-white leading-relaxed">{card.prompt}</p>
        {!revealed ? (
          <p className="text-xs text-slate-500">Tap to reveal</p>
        ) : (
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Answer</p>
            <p className="mt-1 text-sm text-slate-200 leading-relaxed">
              {card.explanation || "No answer explanation is available for this card."}
            </p>
          </div>
        )}
      </button>

      {saveError && (
        <p role="alert" className="text-xs text-rose-400">
          {saveError}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => void record(card, false)}
          disabled={!revealed}
          className="btn-secondary flex-1 text-sm disabled:opacity-40"
        >
          Again
        </button>
        <button
          type="button"
          onClick={() => void record(card, true)}
          disabled={!revealed}
          className="btn-primary flex-1 text-sm disabled:opacity-40"
        >
          Got it
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Reveal the answer before marking whether you recalled it.
      </p>
    </div>
  )
}
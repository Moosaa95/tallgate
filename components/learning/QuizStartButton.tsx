"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HiOutlinePlay, HiOutlineRefresh } from "react-icons/hi"

interface QuizStartButtonProps {
  quizId: string
  courseSlug: string
  label: string
  disabledReason?: string | null
  variant?: "primary" | "secondary"
  resume?: boolean
}

export function QuizStartButton({
  quizId,
  courseSlug,
  label,
  disabledReason,
  variant = "primary",
  resume = false,
}: QuizStartButtonProps) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [starting, setStarting] = useState(false)
  const [, startTransition] = useTransition()

  const disabled = Boolean(disabledReason) || starting

  async function handleStart() {
    if (disabled) return
    setStarting(true)
    setError("")
    try {
      const res = await fetch("/api/assessments/attempts/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? "The quiz could not be started. Please try again.")
        setStarting(false)
        return
      }
      const attemptId = payload?.attempt?.attemptId
      if (!attemptId) {
        setError("The quiz could not be started. Please try again.")
        setStarting(false)
        return
      }
      startTransition(() => {
        router.push(`/learn/courses/${courseSlug}/quizzes/${quizId}?attempt=${attemptId}`)
      })
    } catch {
      setError("The quiz could not be started. Please check your connection and try again.")
      setStarting(false)
    }
  }

  const base = variant === "primary" ? "btn-primary" : "btn-secondary"
  const Icon = resume ? HiOutlineRefresh : HiOutlinePlay

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleStart}
        disabled={disabled}
        aria-disabled={disabled}
        className={`${base} inline-flex items-center justify-center gap-2 text-sm ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
        {starting ? "Starting…" : label}
      </button>
      {disabledReason && (
        <p className="text-[11px] text-slate-400">{disabledReason}</p>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-rose-400">
          {error}
        </p>
      )}
    </div>
  )
}
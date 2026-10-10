"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { HiOutlineExclamationCircle, HiOutlineRefresh } from "react-icons/hi"
import { CATALOGUE_UNAVAILABLE_MESSAGE } from "@/lib/catalogue/publicCatalogue"

interface CatalogueNoticeProps {
  message?: string
  tone?: "dark" | "light"
}

/**
 * Explicit, retryable error state shown when the published catalogue cannot be
 * loaded. Retrying asks the server component to re-render rather than falling
 * back to any cached/static copy of the catalogue.
 */
export default function CatalogueNotice({
  message = CATALOGUE_UNAVAILABLE_MESSAGE,
  tone = "dark",
}: CatalogueNoticeProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const isDark = tone === "dark"

  return (
    <div
      role="alert"
      className={`card-flat mx-auto max-w-xl p-8 text-center space-y-4 border ${
        isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <HiOutlineExclamationCircle
        className={`w-10 h-10 mx-auto ${isDark ? "text-amber-400" : "text-amber-500"}`}
      />
      <div className="space-y-2">
        <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
          Catalogue Unavailable
        </h3>
        <p className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        className="btn-primary text-xs px-5 py-2 inline-flex items-center gap-2 disabled:opacity-60"
      >
        <HiOutlineRefresh className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Retrying..." : "Try Again"}
      </button>
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { fetchCurrentRoleNames } from "@/lib/auth/roles"
import { getPostLoginPath } from "@/lib/auth/redirect"
import {
  GENERIC_SIGNUP_ERROR,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  resolveSignUpOutcome,
  validatePassword,
} from "@/lib/auth/registration"
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineUser, HiOutlineInformationCircle } from "react-icons/hi"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    accountType: "learner",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const passwordError = validatePassword(formData.password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            account_type: formData.accountType,
          },
        },
      })

      // The outcome is identical for a brand-new address and an address that
      // already exists, so registration cannot be used to enumerate accounts.
      // The specific reason is only written to the server-side log.
      const outcome = resolveSignUpOutcome({
        error: authError,
        session: data?.session,
      })

      if (outcome.kind === "error") {
        console.error("Registration failed:", authError?.status, authError?.code)
        setError(outcome.message)
        return
      }

      if (outcome.kind === "verify-email") {
        router.push("/verify-email")
        return
      }

      const roles = await fetchCurrentRoleNames(supabase)
      router.push(getPostLoginPath(roles))
      router.refresh()
    } catch (err: unknown) {
      console.error("Registration error:", err)
      setError(GENERIC_SIGNUP_ERROR)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create a TallGate Account</h2>
        <p className="text-xs text-slate-500 mt-1">
          Join Nigeria&apos;s leading technology ecosystem.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-status-danger rounded-lg text-xs flex items-center gap-2">
          <HiOutlineInformationCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="form-label">
              First Name
              <span className="ml-1 font-normal text-slate-500">(required)</span>
            </label>
            <div className="relative">
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={handleChange}
                placeholder="e.g. Musa"
                className="form-input text-sm pl-9"
              />
              <HiOutlineUser className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label htmlFor="lastName" className="form-label">
              Last Name
              <span className="ml-1 font-normal text-slate-500">(required)</span>
            </label>
            <div className="relative">
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                value={formData.lastName}
                onChange={handleChange}
                placeholder="e.g. Abdullahi"
                className="form-input text-sm pl-9"
              />
              <HiOutlineUser className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="email" className="form-label">
            Email Address
            <span className="ml-1 font-normal text-slate-500">(required)</span>
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="you@company.com"
              className="form-input text-sm pl-9"
            />
            <HiOutlineMail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        <div>
          <label htmlFor="accountType" className="form-label">
            I am joining as a
          </label>
          <select
            id="accountType"
            name="accountType"
            value={formData.accountType}
            onChange={handleChange}
            className="form-select text-xs"
          >
            <option value="learner">Student / Academy Learner</option>
            <option value="startup_founder">Startup Founder / Entrepreneur</option>
            <option value="business_owner">Business Owner / Enterprise Client</option>
          </select>
        </div>

        <div>
          <label htmlFor="password" className="form-label">
            Create Password
            <span className="ml-1 font-normal text-slate-500">(required)</span>
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={formData.password}
              onChange={handleChange}
              placeholder={`Min. ${PASSWORD_MIN_LENGTH} characters`}
              className="form-input text-sm pl-9"
            />
            <HiOutlineLockClosed className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center text-sm py-2.5 font-semibold disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-primary hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  )
}

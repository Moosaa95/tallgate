import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { uniqueRoles } from "@/lib/auth/roles"
import { logError } from "@/lib/logging/logger"

export type CurrentUser = {
  id: string
  email?: string
  profile: {
    full_name?: string | null
    email?: string | null
    phone?: string | null
    company_name?: string | null
    avatar_url?: string | null
    location?: string | null
    bio?: string | null
  } | null
  roles: string[]
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  await cookies()

  if (!isSupabaseConfigured()) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email, phone, company_name, avatar_url, location, bio")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    logError("auth.profile_load_failed", profileError, { userId: user.id })
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id)

  if (rolesError) {
    logError("auth.roles_load_failed", rolesError, { userId: user.id })
  }

  const roles = uniqueRoles((roleRows ?? []).map((row) => row.roles?.name))

  return {
    id: user.id,
    email: user.email,
    profile,
    roles,
  }
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (!user.roles.includes("admin")) {
    redirect("/dashboard")
  }
  return user
}

export async function requireAdminApi() {
  const user = await getCurrentUser()
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  if (!user.roles.includes("admin")) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { user, error: null }
}

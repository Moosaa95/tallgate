import { createAdminClient } from "@/lib/supabase/admin"

export type AdminAuditOutcome = "success" | "failure"

/**
 * Payload keys, in priority order, that identify what an admin action acted on.
 * Only an opaque id is stored - never names, emails, or other free text.
 */
export const AUDIT_TARGET_KEYS = [
  "id",
  "user_id",
  "course_id",
  "certificate_id",
  "module_id",
  "lesson_id",
] as const

export function extractAuditTarget(payload: Record<string, unknown>): string | null {
  for (const key of AUDIT_TARGET_KEYS) {
    const value = payload[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 200)
    }
  }
  return null
}

export function auditOutcomeFromStatus(status: number): AdminAuditOutcome {
  return status >= 200 && status < 300 ? "success" : "failure"
}

export type AdminAuditEntry = {
  actorId: string
  action: string
  target?: string | null
  outcome: AdminAuditOutcome
}

/**
 * Best-effort append to the admin audit log. An audit failure must never change
 * the outcome of the action the admin requested, so failures are logged (without
 * the row contents) and swallowed. The service-role client is used so entries
 * cannot be forged or blocked by RLS.
 */
export async function recordAdminAudit(entry: AdminAuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("admin_audit_log").insert({
      actor_id: entry.actorId,
      action: entry.action.slice(0, 64),
      target: entry.target ? entry.target.slice(0, 200) : null,
      outcome: entry.outcome,
    })

    if (error) {
      console.error("Admin audit log write failed:", error.code)
    }
  } catch {
    console.error("Admin audit log write failed: admin client unavailable.")
  }
}

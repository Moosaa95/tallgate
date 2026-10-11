/**
 * Minimal structured logger for server-side code.
 *
 * Each call writes a single JSON line so logs can be shipped and queried
 * without brittle string parsing. Design goals:
 *
 * - the event name is a stable identifier and values are attached as separate
 *   fields (never interpolated into a message);
 * - known-sensitive keys are redacted and strings are length-capped, so tokens,
 *   credentials and free text cannot leak into or bloat the log stream;
 * - a logging failure can never throw into the caller or change a request's
 *   outcome.
 *
 * Intended for the server runtime (route handlers, server components, server
 * actions). Client components should keep using `console`.
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogContext = Record<string, unknown>

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/**
 * Substrings that mark a context key as sensitive (matched case-insensitively).
 * A key that matches is replaced with `[redacted]` rather than dropped so the
 * shape of the log is preserved without exposing the value.
 */
const SENSITIVE_KEY =
  /(pass|pwd|secret|token|apikey|api[-_]?key|authorization|cookie|session|credential|bearer|jwt|private|email|phone|full_?name|ssn)/i

const MAX_DEPTH = 4
const MAX_KEYS = 30
const MAX_ARRAY = 20
const MAX_STRING = 300
const MAX_ERROR_MESSAGE = 500

const REDACTED = "[redacted]"
const TRUNCATED = "[truncated]"
const COLLAPSED = "[object]"

function shouldLog(level: LogLevel): boolean {
  const configured = (
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug")
  ).toLowerCase()
  const threshold = LEVELS[configured as LogLevel] ?? LEVELS.info
  return LEVELS[level] >= threshold
}

function capString(value: string, max = MAX_STRING): string {
  return value.length > max ? `${value.slice(0, max)}${TRUNCATED}` : value
}

function serializeError(error: Error, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: error.name,
    message: capString(error.message, MAX_ERROR_MESSAGE),
  }

  const code = (error as { code?: unknown }).code
  if (typeof code === "string" || typeof code === "number") {
    out.code = code
  }

  // Stack traces are only useful outside production and are trimmed to the
  // first few frames to keep log volume predictable.
  if (error.stack && process.env.NODE_ENV !== "production") {
    out.stack = error.stack
      .split("\n")
      .slice(1, 4)
      .map((line) => line.trim())
      .filter(Boolean)
  }

  if (error.cause !== undefined && depth < MAX_DEPTH) {
    out.cause = serializeValue(error.cause, depth + 1)
  }

  return out
}

/**
 * Converts an arbitrary runtime value into a JSON-safe, redacted copy.
 * Exported so the redaction/bounding rules can be unit-tested directly.
 */
export function serializeValue(value: unknown, depth = 1): unknown {
  if (value === null || value === undefined) return value

  const type = typeof value
  if (type === "string") return capString(value as string)
  if (type === "number" || type === "boolean") return value
  if (type === "bigint") return (value as bigint).toString()
  if (type === "function" || type === "symbol") return `[${type}]`

  if (value instanceof Error) return serializeError(value, depth)
  if (value instanceof Date) return value.toISOString()

  if (depth > MAX_DEPTH) return COLLAPSED

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((item) => serializeValue(item, depth + 1))
    if (value.length > MAX_ARRAY) items.push(TRUNCATED)
    return items
  }

  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  let count = 0

  for (const key of Object.keys(source)) {
    if (count >= MAX_KEYS) {
      out._truncated = true
      break
    }
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : serializeValue(source[key], depth + 1)
    count += 1
  }

  return out
}

function emit(level: LogLevel, event: string, context?: LogContext): void {
  if (!shouldLog(level)) return

  try {
    const fields =
      context && Object.keys(context).length > 0
        ? (serializeValue(context, 1) as Record<string, unknown>)
        : {}

    // Fixed fields are assigned last so a caller cannot spoof the timestamp,
    // level or event name through the context object.
    const entry = {
      ...fields,
      ts: new Date().toISOString(),
      level,
      event: capString(event, 120),
    }

    const line = JSON.stringify(entry)
    if (level === "error") console.error(line)
    else if (level === "warn") console.warn(line)
    else console.log(line)
  } catch {
    // Logging must never break the caller.
  }
}

export function logDebug(event: string, context?: LogContext): void {
  emit("debug", event, context)
}

export function logInfo(event: string, context?: LogContext): void {
  emit("info", event, context)
}

export function logWarn(event: string, context?: LogContext): void {
  emit("warn", event, context)
}

export function logError(event: string, error: unknown, context?: LogContext): void {
  emit("error", event, { ...context, error })
}

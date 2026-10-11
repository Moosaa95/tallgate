import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  logDebug,
  logError,
  logInfo,
  logWarn,
  serializeValue,
} from "@/lib/logging/logger"

let logSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function lastEntry(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const calls = spy.mock.calls
  return JSON.parse(String(calls[calls.length - 1]?.[0]))
}

describe("logger output", () => {
  it("writes one JSON line with fixed fields and context", () => {
    logInfo("course.published", { courseId: "c1", count: 2 })

    expect(logSpy).toHaveBeenCalledTimes(1)
    const entry = lastEntry(logSpy)
    expect(entry.event).toBe("course.published")
    expect(entry.level).toBe("info")
    expect(entry.courseId).toBe("c1")
    expect(entry.count).toBe(2)
    expect(typeof entry.ts).toBe("string")
    expect(Number.isNaN(Date.parse(String(entry.ts)))).toBe(false)
  })

  it("routes each level to the matching console method", () => {
    logDebug("debug.event")
    expect(logSpy).toHaveBeenCalledTimes(1)

    logInfo("info.event")
    logWarn("warn.event")
    logError("error.event", new Error("boom"))

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it("cannot have the fixed fields spoofed by context", () => {
    logInfo("real.event", { level: "error", event: "spoofed", ts: "nope" })

    const entry = lastEntry(logSpy)
    expect(entry.level).toBe("info")
    expect(entry.event).toBe("real.event")
    expect(entry.ts).not.toBe("nope")
  })

  it("serializes an error with name, message and code", () => {
    const error = Object.assign(new Error("insert failed"), { code: "23505" })
    logError("db.insert_failed", error)

    const entry = lastEntry(errorSpy)
    expect(entry.error).toMatchObject({
      name: "Error",
      message: "insert failed",
      code: "23505",
    })
  })

  it("respects the configured LOG_LEVEL threshold", () => {
    vi.stubEnv("LOG_LEVEL", "warn")

    logInfo("quiet.event")
    logWarn("loud.event")

    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})

describe("serializeValue", () => {
  it("redacts sensitive keys but keeps the rest", () => {
    const result = serializeValue({
      userId: "u1",
      password: "hunter2",
      access_token: "abc",
      authorization: "Bearer x",
      email: "a@b.com",
      nested: { apiKey: "secret", name: "ok" },
    }) as Record<string, unknown>

    expect(result.userId).toBe("u1")
    expect(result.password).toBe("[redacted]")
    expect(result.access_token).toBe("[redacted]")
    expect(result.authorization).toBe("[redacted]")
    expect(result.email).toBe("[redacted]")
    expect(result.nested).toEqual({ apiKey: "[redacted]", name: "ok" })
  })

  it("caps long strings", () => {
    const result = serializeValue("x".repeat(1000)) as string
    expect(result.length).toBe(300 + "[truncated]".length)
    expect(result.endsWith("[truncated]")).toBe(true)
  })

  it("bounds array length", () => {
    const result = serializeValue(Array.from({ length: 50 }, (_, i) => i)) as unknown[]
    expect(result).toHaveLength(21)
    expect(result[20]).toBe("[truncated]")
  })

  it("survives circular references without throwing", () => {
    const circular: Record<string, unknown> = { name: "root" }
    circular.self = circular

    expect(() => serializeValue(circular)).not.toThrow()
  })

  it("converts bigint, date and function values safely", () => {
    expect(serializeValue(BigInt(10))).toBe("10")
    expect(serializeValue(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      "2026-01-02T03:04:05.000Z"
    )
    expect(serializeValue(() => {})).toBe("[function]")
  })
})

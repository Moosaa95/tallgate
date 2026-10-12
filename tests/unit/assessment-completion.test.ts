import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  rpcMock,
  courseSelectMock,
  certSelectMock,
  quizzesSelectMock,
  attemptsSelectMock,
  issueCertificateMock,
} = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  courseSelectMock: vi.fn(),
  certSelectMock: vi.fn(),
  quizzesSelectMock: vi.fn(),
  attemptsSelectMock: vi.fn(),
  issueCertificateMock: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: rpcMock,
    from: (table: string) => {
      if (table === "courses") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: courseSelectMock,
            }),
          }),
        }
      }
      if (table === "certificates") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: certSelectMock,
              }),
            }),
          }),
        }
      }
      if (table === "quizzes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  neq: quizzesSelectMock,
                }),
              }),
            }),
          }),
        }
      }
      if (table === "quiz_attempts") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                eq: () => ({
                  eq: attemptsSelectMock,
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  })),
}))

vi.mock("@/lib/certificates/issueCertificate", () => ({
  issueCourseCertificate: issueCertificateMock,
}))

import { checkCourseCompletion } from "@/lib/assessments/completion"

describe("checkCourseCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns isComplete false when course completion recomputation indicates incomplete", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { isComplete: false, progressPercent: 45 },
      error: null,
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result).toEqual({
      isComplete: false,
      progressPercent: 45,
      certificateIssued: false,
      certificateStatus: "none",
    })
    expect(issueCertificateMock).not.toHaveBeenCalled()
  })

  it("handles RPC errors gracefully", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "DB failure" },
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result).toEqual({
      isComplete: false,
      progressPercent: 0,
      certificateIssued: false,
      certificateStatus: "none",
    })
    expect(issueCertificateMock).not.toHaveBeenCalled()
  })

  it("does not issue certificate when auto_issue_certificate is false", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { isComplete: true, progressPercent: 100 },
      error: null,
    })
    courseSelectMock.mockResolvedValueOnce({
      data: { auto_issue_certificate: false, title: "AI Engineering" },
      error: null,
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result).toEqual({
      isComplete: true,
      progressPercent: 100,
      certificateIssued: false,
      certificateStatus: "none",
    })
    expect(issueCertificateMock).not.toHaveBeenCalled()
  })

  it("returns existing certificate status when a certificate is already minted", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { isComplete: true, progressPercent: 100 },
      error: null,
    })
    courseSelectMock.mockResolvedValueOnce({
      data: { auto_issue_certificate: true, title: "AI Engineering" },
      error: null,
    })
    certSelectMock.mockResolvedValueOnce({
      data: { id: "cert-1", storage_path: "path/to/cert.pdf" },
      error: null,
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result).toEqual({
      isComplete: true,
      progressPercent: 100,
      certificateIssued: true,
      certificateStatus: "existing",
    })
    expect(issueCertificateMock).not.toHaveBeenCalled()
  })

  it("calculates Distinction grade band and issues certificate when learner achieves >= 80% on required quizzes", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { isComplete: true, progressPercent: 100 },
      error: null,
    })
    courseSelectMock.mockResolvedValueOnce({
      data: { auto_issue_certificate: true, title: "AI Engineering" },
      error: null,
    })
    certSelectMock.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    quizzesSelectMock.mockResolvedValueOnce({
      data: [
        { id: "quiz-1", pass_mark_percent: 50 },
        { id: "quiz-2", pass_mark_percent: 50 },
      ],
      error: null,
    })
    attemptsSelectMock.mockResolvedValueOnce({
      data: [
        { quiz_id: "quiz-1", percent: 85 },
        { quiz_id: "quiz-2", percent: 95 },
      ],
      error: null,
    })
    issueCertificateMock.mockResolvedValueOnce({
      status: "created",
      certificate: { id: "cert-new" },
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result).toEqual({
      isComplete: true,
      progressPercent: 100,
      certificateIssued: true,
      certificateStatus: "created",
    })
    expect(issueCertificateMock).toHaveBeenCalledWith({
      userId: "user-1",
      courseId: "course-1",
      courseTitle: "AI Engineering",
      grade: "Distinction", // (85 + 95) / 2 = 90% -> Distinction
    })
  })

  it("calculates Merit grade band when learner average is between 65% and 79.99%", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { isComplete: true, progressPercent: 100 },
      error: null,
    })
    courseSelectMock.mockResolvedValueOnce({
      data: { auto_issue_certificate: true, title: "AI Engineering" },
      error: null,
    })
    certSelectMock.mockResolvedValueOnce({ data: null, error: null })
    quizzesSelectMock.mockResolvedValueOnce({
      data: [
        { id: "quiz-1", pass_mark_percent: 50 },
        { id: "quiz-2", pass_mark_percent: 50 },
      ],
      error: null,
    })
    attemptsSelectMock.mockResolvedValueOnce({
      data: [
        { quiz_id: "quiz-1", percent: 70 },
        { quiz_id: "quiz-2", percent: 72 },
      ],
      error: null,
    })
    issueCertificateMock.mockResolvedValueOnce({
      status: "created",
      certificate: { id: "cert-merit" },
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result.certificateStatus).toBe("created")
    expect(issueCertificateMock).toHaveBeenCalledWith({
      userId: "user-1",
      courseId: "course-1",
      courseTitle: "AI Engineering",
      grade: "Merit", // 71% -> Merit
    })
  })

  it("calculates Pass grade band when learner average is between 50% and 64.99%", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { isComplete: true, progressPercent: 100 },
      error: null,
    })
    courseSelectMock.mockResolvedValueOnce({
      data: { auto_issue_certificate: true, title: "AI Engineering" },
      error: null,
    })
    certSelectMock.mockResolvedValueOnce({ data: null, error: null })
    quizzesSelectMock.mockResolvedValueOnce({
      data: [{ id: "quiz-1", pass_mark_percent: 50 }],
      error: null,
    })
    attemptsSelectMock.mockResolvedValueOnce({
      data: [{ quiz_id: "quiz-1", percent: 55 }],
      error: null,
    })
    issueCertificateMock.mockResolvedValueOnce({
      status: "created",
      certificate: { id: "cert-pass" },
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result.certificateStatus).toBe("created")
    expect(issueCertificateMock).toHaveBeenCalledWith({
      userId: "user-1",
      courseId: "course-1",
      courseTitle: "AI Engineering",
      grade: "Pass", // 55% -> Pass
    })
  })

  it("defaults to Distinction for courses without required quizzes (video completion)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { isComplete: true, progressPercent: 100 },
      error: null,
    })
    courseSelectMock.mockResolvedValueOnce({
      data: { auto_issue_certificate: true, title: "Video Masterclass" },
      error: null,
    })
    certSelectMock.mockResolvedValueOnce({ data: null, error: null })
    quizzesSelectMock.mockResolvedValueOnce({
      data: [],
      error: null,
    })
    issueCertificateMock.mockResolvedValueOnce({
      status: "created",
      certificate: { id: "cert-video" },
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result.certificateStatus).toBe("created")
    expect(issueCertificateMock).toHaveBeenCalledWith({
      userId: "user-1",
      courseId: "course-1",
      courseTitle: "Video Masterclass",
      grade: "Distinction",
    })
  })

  it("reports failed certificateStatus when issuance reports an error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { isComplete: true, progressPercent: 100 },
      error: null,
    })
    courseSelectMock.mockResolvedValueOnce({
      data: { auto_issue_certificate: true, title: "AI Engineering" },
      error: null,
    })
    certSelectMock.mockResolvedValueOnce({ data: null, error: null })
    quizzesSelectMock.mockResolvedValueOnce({ data: [], error: null })
    issueCertificateMock.mockResolvedValueOnce({
      status: "error",
      code: "pdf",
      message: "PDF generation failed",
    })

    const result = await checkCourseCompletion("user-1", "course-1")
    expect(result).toEqual({
      isComplete: true,
      progressPercent: 100,
      certificateIssued: false,
      certificateStatus: "failed",
    })
  })
})

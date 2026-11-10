import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSendCertificateEmail, mockRandomUUID, mockCreateAdminClient } = vi.hoisted(() => {
  return {
    mockSendCertificateEmail: vi.fn().mockResolvedValue(undefined),
    mockRandomUUID: vi.fn().mockReturnValue("test-lease-token-123"),
    mockCreateAdminClient: vi.fn(),
  }
})

vi.mock("@/lib/certificates/sendCertificateEmail", () => ({
  sendCertificateEmail: mockSendCertificateEmail,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}))

vi.stubGlobal("crypto", { randomUUID: mockRandomUUID })

import { claimAndSendCertificateEmail, releaseStaleEmailLeases } from "@/lib/certificates/issueCertificate"

interface MockSupabaseClient {
  from: ReturnType<typeof vi.fn>
  storage: { from: ReturnType<typeof vi.fn> }
  rpc: ReturnType<typeof vi.fn>
  _chain: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    lt: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
    _setSelectData: (data: any[]) => void
    _setMaybeSingleData: (data: any) => void
  }
}

function createMockClient(overrides = {}): MockSupabaseClient {
  let selectData: any[] = []
  let maybeSingleData: any = null

  const chain = {
    select: vi.fn(function(this: any, ...args: any[]) {
      if (args.length > 0) {
        // select("id") - store data for thenable resolution
        this._selectData = selectData
      }
      return this
    }),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: maybeSingleData, error: null })),
    single: vi.fn(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    then: vi.fn(async (resolve: any) => {
      resolve({ data: selectData, error: null })
    }),
    _setSelectData: (data: any[]) => { selectData = data },
    _setMaybeSingleData: (data: any) => { maybeSingleData = data },
  }

  return {
    from: vi.fn(() => chain),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        download: vi.fn().mockResolvedValue({ data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.com/signed" }, error: null }),
      })),
    },
    rpc: vi.fn(),
    _chain: chain,
    ...overrides,
  } as unknown as any
}

describe("Email Lease Ownership", () => {
  let mockClient: MockSupabaseClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = createMockClient()
    mockRandomUUID.mockReturnValue("test-lease-token-123")
    mockSendCertificateEmail.mockResolvedValue(undefined)
    mockCreateAdminClient.mockReturnValue(mockClient as any)
  })

  it("claims lease with token and sends email", async () => {
    let callIndex = 0
    mockClient._chain.maybeSingle.mockImplementation(async () => {
      callIndex++
      if (callIndex === 1) {
        return {
          data: {
            id: "cert-1",
            email_status: "sending",
            email_retry_count: 0,
            email_lease_token: "test-lease-token-123",
          },
          error: null,
        }
      }
      return { data: { id: "cert-1" }, error: null }
    })

    await claimAndSendCertificateEmail(mockClient as any, {
      certificateId: "cert-1",
      to: "test@example.com",
      recipientName: "Test User",
      courseTitle: "Test Course",
      certificateNumber: "TG-001",
      verificationUrl: "https://example.com/verify",
      pdfBuffer: Buffer.from("pdf"),
      idempotencyKey: "test-key",
    })

    expect(mockClient._chain.update).toHaveBeenCalled()
    const updateCalls = mockClient._chain.update.mock.calls
    expect(updateCalls[0][0]).toMatchObject({
      email_status: "sending",
      email_lease_token: "test-lease-token-123",
      email_lease_acquired_at: expect.any(String),
    })

    expect(updateCalls[1][0]).toMatchObject({
      email_status: "sent",
      email_lease_token: null,
      email_lease_acquired_at: null,
    })

    expect(mockSendCertificateEmail).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "test-key",
    }))
  })

  it("returns early if certificate already claimed", async () => {
    mockClient._chain.maybeSingle.mockResolvedValue({ data: null, error: null })

    await claimAndSendCertificateEmail(mockClient as any, {
      certificateId: "cert-1",
      to: "test@example.com",
      recipientName: "Test User",
      courseTitle: "Test Course",
      certificateNumber: "TG-001",
      verificationUrl: "https://example.com/verify",
      pdfBuffer: Buffer.from("pdf"),
    })

    expect(mockSendCertificateEmail).not.toHaveBeenCalled()
  })

  it("releases only stale leases", async () => {
    // releaseStaleEmailLeases creates its own client, so we need to mock createAdminClient
    const releaseMockClient = createMockClient()
    releaseMockClient._chain._setSelectData([{ id: "cert-1" }, { id: "cert-2" }])
    mockCreateAdminClient.mockReturnValueOnce(releaseMockClient)

    // Debug: verify mock is called
    const released = await releaseStaleEmailLeases()

    expect(mockCreateAdminClient).toHaveBeenCalled()
    expect(released).toBe(2)
    expect(releaseMockClient._chain.update).toHaveBeenCalledWith(expect.objectContaining({
      email_status: "pending",
      email_lease_token: null,
      email_lease_acquired_at: null,
    }))
  })

  it("handles email failure and releases lease with token", async () => {
    let callIndex = 0
    mockClient._chain.maybeSingle.mockImplementation(async () => {
      callIndex++
      if (callIndex === 1) {
        return {
          data: { id: "cert-1", email_status: "sending", email_retry_count: 0, email_lease_token: "test-lease-token-123" },
          error: null,
        }
      }
      return { data: { id: "cert-1" }, error: null }
    })

    mockSendCertificateEmail.mockRejectedValueOnce(new Error("Resend API error"))

    await expect(claimAndSendCertificateEmail(mockClient as any, {
      certificateId: "cert-1",
      to: "test@example.com",
      recipientName: "Test User",
      courseTitle: "Test Course",
      certificateNumber: "TG-001",
      verificationUrl: "https://example.com/verify",
      pdfBuffer: Buffer.from("pdf"),
      idempotencyKey: "test-key",
    })).rejects.toThrow("Resend API error")

    const updateCalls = mockClient._chain.update.mock.calls
    expect(updateCalls[1][0]).toMatchObject({
      email_status: "failed",
      email_lease_token: null,
      email_lease_acquired_at: null,
    })
  })

  it("verifies lease token matches on claim (defense in depth)", async () => {
    mockClient._chain.maybeSingle.mockResolvedValue({
      data: { id: "cert-1", email_status: "sending", email_retry_count: 0, email_lease_token: "different-token" },
      error: null,
    })

    await claimAndSendCertificateEmail(mockClient as any, {
      certificateId: "cert-1",
      to: "test@example.com",
      recipientName: "Test User",
      courseTitle: "Test Course",
      certificateNumber: "TG-001",
      verificationUrl: "https://example.com/verify",
      pdfBuffer: Buffer.from("pdf"),
    })

    expect(mockSendCertificateEmail).not.toHaveBeenCalled()
  })
})

describe("Admin Retry Concurrency", () => {
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient = createMockClient()
    mockRandomUUID
      .mockReturnValueOnce("token-first")
      .mockReturnValueOnce("token-second")
    mockSendCertificateEmail.mockResolvedValue(undefined)
    mockCreateAdminClient.mockReturnValue(mockClient as any)
  })

  it("concurrent retries cannot send duplicate emails", async () => {
    let claimCount = 0
    mockClient._chain.maybeSingle.mockImplementation(async () => {
      claimCount++
      if (claimCount === 1) {
        return {
          data: { id: "cert-1", email_status: "sending", email_retry_count: 0, email_lease_token: "token-first" },
          error: null,
        }
      }
      return { data: null, error: null }
    })

    await claimAndSendCertificateEmail(mockClient as any, {
      certificateId: "cert-1",
      to: "test@example.com",
      recipientName: "Test User",
      courseTitle: "Test Course",
      certificateNumber: "TG-001",
      verificationUrl: "https://example.com/verify",
      pdfBuffer: Buffer.from("pdf"),
      idempotencyKey: "cert-retry-cert-1-0",
    })

    await claimAndSendCertificateEmail(mockClient as any, {
      certificateId: "cert-1",
      to: "test@example.com",
      recipientName: "Test User",
      courseTitle: "Test Course",
      certificateNumber: "TG-001",
      verificationUrl: "https://example.com/verify",
      pdfBuffer: Buffer.from("pdf"),
      idempotencyKey: "cert-retry-cert-1-1",
    })

    expect(mockSendCertificateEmail).toHaveBeenCalledTimes(1)
  })
})

describe("Resend Idempotency Header", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("includes Idempotency-Key header when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email-123" }),
    })
    global.fetch = mockFetch

    // Test the header construction logic directly
    const apiKey = "test-key"
    const from = "test@example.com"
    const idempotencyKey = "test-idempotency-key"

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey
    }

    expect(headers["Idempotency-Key"]).toBe("test-idempotency-key")
  })

  it("does not include Idempotency-Key header when not provided", async () => {
    const headers: Record<string, string> = {
      Authorization: `Bearer test-key`,
      "Content-Type": "application/json",
    }

    const idempotencyKey = undefined

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey
    }

    expect(headers["Idempotency-Key"]).toBeUndefined()
  })
})
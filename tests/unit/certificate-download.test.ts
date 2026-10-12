import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { requireUser, requireAdminApi, createAdminClient, storageFromMock } = vi.hoisted(() => {
  const requireUser = vi.fn()
  const requireAdminApi = vi.fn()
  const storageFromMock = vi.fn()

  const createAdminClient = vi.fn(() => ({
    from: vi.fn(),
    storage: {
      from: storageFromMock,
    },
  }))

  return {
    requireUser,
    requireAdminApi,
    createAdminClient,
    storageFromMock,
  }
})

vi.mock("@/lib/auth/guards", () => ({
  requireUser,
  requireAdminApi,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}))

import { GET as userDownloadGET } from "@/app/api/certificates/[id]/download/route"
import { GET as adminDownloadGET } from "@/app/api/admin/certificates/[id]/download/route"

describe("Certificate Download Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Learner download route (GET /api/certificates/[id]/download)", () => {
    it("denies access when certificate belongs to another user", async () => {
      requireUser.mockResolvedValue({ id: "user-victim-123" })

      const selectMock = vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { user_id: "user-attacker-456", storage_path: "path/to/cert.pdf" },
            error: null,
          })),
        })),
      }))

      createAdminClient.mockReturnValue({
        from: () => ({ select: selectMock }),
        storage: { from: storageFromMock },
      } as unknown as ReturnType<typeof createAdminClient>)

      const req = new NextRequest("https://tallgate.ng/api/certificates/cert-1/download")
      const res = await userDownloadGET(req, { params: Promise.resolve({ id: "cert-1" }) })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.error).toBe("Certificate not found.")
    })

    it("generates a signed URL only for the authorized owner", async () => {
      requireUser.mockResolvedValue({ id: "user-owner-123" })

      const selectMock = vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { user_id: "user-owner-123", storage_path: "01/02/token.pdf" },
            error: null,
          })),
        })),
      }))

      const createSignedUrl = vi.fn(async () => ({
        data: { signedUrl: "https://storage.supabase.co/signed/token.pdf" },
        error: null,
      }))

      createAdminClient.mockReturnValue({
        from: () => ({ select: selectMock }),
        storage: { from: () => ({ createSignedUrl }) },
      } as unknown as ReturnType<typeof createAdminClient>)

      const req = new NextRequest("https://tallgate.ng/api/certificates/cert-1/download")
      const res = await userDownloadGET(req, { params: Promise.resolve({ id: "cert-1" }) })

      expect(res.status).toBe(302)
      expect(res.headers.get("location")).toBe("https://storage.supabase.co/signed/token.pdf")
      expect(createSignedUrl).toHaveBeenCalledWith("01/02/token.pdf", 300)
    })
  })

  describe("Admin download route (GET /api/admin/certificates/[id]/download)", () => {
    it("denies access to non-admins", async () => {
      requireAdminApi.mockResolvedValue({
        error: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
      })

      const req = new NextRequest("https://tallgate.ng/api/admin/certificates/cert-1/download")
      const res = await adminDownloadGET(req, { params: Promise.resolve({ id: "cert-1" }) })

      expect(res.status).toBe(403)
    })
  })
})

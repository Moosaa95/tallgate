export type CloudinaryUploadResult = {
  secure_url: string
  public_id: string
  format?: string
  resource_type: string
  bytes: number
  original_filename?: string
}

export type UploadProgress = {
  loaded: number
  total: number
  percentage: number
}

export type UploadProgressCallback = (progress: UploadProgress) => void

export type UploadOptions = {
  folder?: string
  resourceType?: "auto" | "image" | "video" | "raw"
  onProgress?: UploadProgressCallback
}

/**
 * Uploads a file directly to Cloudinary using signed authentication.
 * Bypasses serverless payload size limitations, allowing large videos and materials.
 */
export async function uploadToCloudinary(
  file: File,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  // Step 1: Request signed upload payload from the secure backend
  const signResponse = await fetch("/api/admin/media/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folder: options.folder,
      resource_type: options.resourceType ?? "auto",
    }),
  })

  if (!signResponse.ok) {
    const errorJson = (await signResponse.json().catch(() => null)) as { error?: string } | null
    throw new Error(errorJson?.error ?? "Failed to initialize Cloudinary upload authorization.")
  }

  const signData = await signResponse.json()

  // Step 2: Build FormData matching signed params
  const formData = new FormData()
  formData.append("file", file)
  formData.append("api_key", signData.apiKey)
  formData.append("timestamp", String(signData.timestamp))
  formData.append("signature", signData.signature)
  if (signData.folder) {
    formData.append("folder", signData.folder)
  }

  // Step 3: Direct POST to Cloudinary with progress tracking
  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", signData.uploadUrl)

    if (options.onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percentage = Math.round((event.loaded / event.total) * 100)
          options.onProgress?.({
            loaded: event.loaded,
            total: event.total,
            percentage,
          })
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve(response)
        } catch {
          reject(new Error("Unable to parse Cloudinary response."))
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText)
          reject(new Error(errorResponse?.error?.message || `Cloudinary upload rejected (${xhr.status}).`))
        } catch {
          reject(new Error(`Cloudinary upload failed with HTTP status ${xhr.status}.`))
        }
      }
    }

    xhr.onerror = () => {
      reject(new Error("Network connection error during Cloudinary upload."))
    }

    xhr.send(formData)
  })
}


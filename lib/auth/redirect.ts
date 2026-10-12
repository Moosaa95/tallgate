export function safeNextPath(next?: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null

  const baseUrl = "https://tallgate.invalid"
  let destination: URL
  try {
    destination = new URL(next, baseUrl)
  } catch {
    return null
  }
  if (destination.origin !== baseUrl) return null

  // Normalising dot-segments (e.g. "/admin/../..//evil.com") or backslashes can
  // turn a value that started with one slash into a protocol-relative path, so
  // re-check the resolved path before trusting it.
  if (destination.pathname.startsWith("//")) return null

  const path = `${destination.pathname}${destination.search}${destination.hash}`
  if (path.startsWith("/login") || path.startsWith("/register")) return null
  return path
}

export function getPostLoginPath(roles: string[], next?: string | null) {
  const destination = safeNextPath(next)
  if (destination) return destination
  if (roles.includes("admin")) return "/admin"
  return "/dashboard"
}

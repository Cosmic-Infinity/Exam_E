/**
 * Asset URL Resolver
 * 
 * Intelligently resolves asset URLs for use in development and production.
 * Handles:
 * - Absolute URLs (http/https) - returned as-is
 * - Relative paths starting with /media/ or /Data/ - uses current origin for LAN access
 * - Other relative paths - prepends API base URL
 * 
 * In debug mode on LAN/hotspot, this ensures URLs use the current hostname
 * instead of a hardcoded localhost reference.
 */

export function resolveAssetUrl(rawPath?: string): string | undefined {
  if (!rawPath) return undefined;

  // If already absolute URL, return as-is
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    return rawPath;
  }

  // For media and Data paths, use relative URLs to current origin
  // This allows them to work from any hostname (localhost, LAN IP, etc.)
  if (rawPath.startsWith("/media/") || rawPath.startsWith("/Data/")) {
    return rawPath;
  }

  // For other API paths, construct from current location or env fallback
  // In development, this will use the current hostname when accessed via hotspot
  const apiBase =
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:${
          // Use port 80 if accessed via nginx, otherwise use current port
          window.location.port ||
          (window.location.protocol === "https:" ? "443" : "80")
        }`
      : "http://localhost:8000");

  return `${apiBase}${rawPath.startsWith("/") ? rawPath : `/${rawPath}`}`;
}

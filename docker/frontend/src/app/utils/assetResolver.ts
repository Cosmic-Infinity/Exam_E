/** Resolves relative and environment-based asset URLs for current host. */
export function resolveAssetUrl(rawPath?: string): string | undefined {
  if (!rawPath) return undefined;

  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    return rawPath;
  }

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

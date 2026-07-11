function normalizeGatewayUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

export const API_GATEWAY_URL = normalizeGatewayUrl(
  process.env.NEXT_PUBLIC_API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_BASE_URL
);

export function apiUrl(path) {
  if (!API_GATEWAY_URL) {
    throw new Error("NEXT_PUBLIC_API_GATEWAY_URL is not configured.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_GATEWAY_URL}${normalizedPath}`;
}

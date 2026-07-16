import { API_BASE } from "../constants";

const PROXY_IMAGE_HOSTS = new Set(["image.coolapk.com"]);

export function getDisplayImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(imageUrl);
    if (parsedUrl.protocol === "https:" && PROXY_IMAGE_HOSTS.has(parsedUrl.hostname)) {
      return `${API_BASE}/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;
    }
  } catch {
    return imageUrl;
  }

  return imageUrl;
}

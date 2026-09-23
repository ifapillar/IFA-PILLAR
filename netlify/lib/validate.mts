const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Normalises whatever the owner pasted into a safe, absolute URL.
 * Bare domains get https://, and javascript:/data: URLs are rejected outright
 * so a stored link can never become a script injection on the public page.
 */
export function normaliseUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(candidate);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    if ((url.protocol === "http:" || url.protocol === "https:") && !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function text(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function bad(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

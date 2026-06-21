// Client-side cookie helpers for guest registration state.
// Stores a map of { [slug]: { status, ticketToken } } in a single cookie
// to soft-prevent duplicate submissions from the same browser.
// This is UX protection only — server-side uniqueness is not enforced here.

const COOKIE_NAME = "pyr_registrations";
const MAX_AGE_DAYS = 365;

interface RegistrationEntry {
  status: string;
  ticketToken: string | null;
}

type RegistrationMap = Record<string, RegistrationEntry>;

function read(): RegistrationMap {
  if (typeof document === "undefined") return {};
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match.slice(COOKIE_NAME.length + 1))) as RegistrationMap;
  } catch {
    return {};
  }
}

function write(map: RegistrationMap): void {
  if (typeof document === "undefined") return;
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(map))};path=/;max-age=${maxAge};SameSite=Lax`;
}

export function getRegistration(slug: string): RegistrationEntry | null {
  return read()[slug] ?? null;
}

export function saveRegistration(slug: string, entry: RegistrationEntry): void {
  const map = read();
  map[slug] = entry;
  write(map);
}

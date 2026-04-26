import { createClient } from "@supabase/supabase-js";
import { ensureDeviceId, getDeviceIdSync } from "./device";

// Env vars — must be set at build time. See .env.example.
// Fall back to a clearly-broken placeholder so we fail loudly in dev rather
// than silently committing real keys.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  "https://YOUR-PROJECT-REF.supabase.co";

const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "MISSING_VITE_SUPABASE_ANON_KEY";

if (
  SUPABASE_URL.includes("YOUR-PROJECT-REF") ||
  SUPABASE_KEY === "MISSING_VITE_SUPABASE_ANON_KEY"
) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Sleepover] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Copy .env.example to .env.local and fill in your Supabase project values."
  );
}

// Singleton client. RLS reads x-device-id from request headers.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      // Placeholder — overwritten below once device id is loaded.
      "x-device-id": "pending",
    },
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// Patch the device-id header as soon as it resolves so every fetch carries it.
ensureDeviceId().then((id) => {
  // @ts-expect-error — internal headers map
  supabase.rest.headers["x-device-id"] = id;
  // @ts-expect-error — internal headers map for storage
  supabase.storage.headers = { ...(supabase.storage.headers || {}), "x-device-id": id };
});

export function deviceId(): string | null {
  return getDeviceIdSync();
}

export const SUPABASE_URL_PUBLIC = SUPABASE_URL;

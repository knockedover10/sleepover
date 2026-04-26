// Device identity — stored in IndexedDB (localStorage is blocked in sandboxed iframes).
import { get, set } from "idb-keyval";

const KEY = "sleepover.device_id";

let cached: string | null = null;
let resolver: Promise<string> | null = null;

export function getDeviceIdSync(): string | null {
  return cached;
}

export async function ensureDeviceId(): Promise<string> {
  if (cached) return cached;
  if (resolver) return resolver;
  resolver = (async () => {
    let id = (await get<string>(KEY)) || null;
    if (!id) {
      id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await set(KEY, id);
    }
    cached = id;
    return id;
  })();
  return resolver;
}

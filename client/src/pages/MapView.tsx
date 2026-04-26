import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { useTripData } from "@/lib/trip-data";
import { osrmWalkRoute } from "@/lib/external";
import { PageContainer } from "@/components/AppShell";
import { cn } from "@/lib/utils";

const PALETTE = [
  "hsl(183 42% 38%)",
  "hsl(18 70% 55%)",
  "hsl(42 75% 50%)",
  "hsl(268 35% 55%)",
  "hsl(145 30% 42%)",
  "hsl(220 45% 55%)",
  "hsl(340 50% 58%)",
  "hsl(95 35% 45%)",
];

function dayColor(d: number) {
  return PALETTE[(d - 1) % PALETTE.length];
}

function makeIcon(color: string, day: number) {
  const html = `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.25);color:white;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;font-family:'Satoshi',sans-serif;">${day}</div>`;
  return L.divIcon({ html, className: "", iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
}

export default function MapView() {
  const data = useTripData();
  const tv = data.trip;

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  const numDays = tv?.numDays || 8;
  const ALL_DAYS = useMemo(() => Array.from({ length: numDays }, (_, i) => i + 1), [numDays]);
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set(ALL_DAYS));

  useEffect(() => { setActiveDays(new Set(ALL_DAYS)); }, [ALL_DAYS]);

  // OSRM walking routes per day, cached by query
  const dayItemsByDay = useMemo(() => {
    const m = new Map<number, typeof data.itinerary>();
    for (const it of data.itinerary) {
      if (it.lat === 0 && it.lng === 0) continue;
      const arr = m.get(it.day) || [];
      arr.push(it);
      m.set(it.day, arr);
    }
    return m;
  }, [data.itinerary]);

  const routesQ = useQuery({
    queryKey: ["osrm-routes", tv?.id, Array.from(dayItemsByDay.keys()).join(",")],
    enabled: !!tv && dayItemsByDay.size > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const out = new Map<number, { geometry: Array<[number, number]>; durationSec: number; distanceMeters: number }>();
      for (const [d, items] of dayItemsByDay.entries()) {
        if (items.length < 2) continue;
        const coords = items.map((it) => [it.lat, it.lng] as [number, number]);
        const route = await osrmWalkRoute(coords);
        if (route) out.set(d, route);
      }
      return out;
    },
  });

  useEffect(() => {
    if (!mapRef.current || mapInst.current || !tv) return;
    const center: [number, number] = [tv.centerLat || 0, tv.centerLng || 0];
    const map = L.map(mapRef.current, { center, zoom: 11, zoomControl: true });
    mapInst.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    return () => { map.remove(); mapInst.current = null; };
  }, [tv]);

  useEffect(() => {
    const map = mapInst.current;
    if (!map) return;
    layersRef.current.forEach((l) => l.remove());
    layersRef.current = [];

    const visible = data.itinerary.filter((i) => activeDays.has(i.day) && (i.lat !== 0 || i.lng !== 0));
    visible.forEach((item) => {
      const color = dayColor(item.day);
      const m = L.marker([item.lat, item.lng], { icon: makeIcon(color, item.day) }).addTo(map);
      m.bindPopup(
        `<div style="min-width:160px"><div style="font-weight:600;font-size:13px;line-height:1.3">${item.title}</div><div style="font-size:11px;color:#666;margin-top:2px">Day ${item.day} · ${item.time} · ${item.location || ""}</div></div>`
      );
      layersRef.current.push(m);
    });

    // walking lines
    if (routesQ.data) {
      for (const [day, route] of routesQ.data.entries()) {
        if (!activeDays.has(day)) continue;
        const line = L.polyline(route.geometry, { color: dayColor(day), weight: 4, opacity: 0.7, dashArray: "6, 6" }).addTo(map);
        layersRef.current.push(line);
      }
    }

    if (visible.length > 0) {
      const bounds = L.latLngBounds(visible.map((v) => [v.lat, v.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.15), { animate: true });
    }
  }, [activeDays, data.itinerary, routesQ.data]);

  const toggle = (d: number) => {
    setActiveDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      if (next.size === 0) return new Set(ALL_DAYS);
      return next;
    });
  };
  const allActive = activeDays.size === ALL_DAYS.length;

  // Walking-time summary (per day)
  const dayWalking = useMemo(() => {
    const arr: { day: number; minutes: number; meters: number }[] = [];
    if (!routesQ.data) return arr;
    for (const [day, route] of routesQ.data.entries()) {
      arr.push({ day, minutes: Math.round(route.durationSec / 60), meters: Math.round(route.distanceMeters) });
    }
    return arr.sort((a, b) => a.day - b.day);
  }, [routesQ.data]);

  if (!tv) return <PageContainer><div className="py-10 text-center text-muted-foreground">Loading…</div></PageContainer>;

  return (
    <PageContainer>
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight">Map</h1>
        <p className="text-xs text-muted-foreground">{data.itinerary.length} pins · color-coded by day · walking lines</p>
      </div>

      <div className="-mx-4 mb-3 overflow-x-auto scrollbar-hide px-4">
        <div className="flex w-max gap-1.5">
          <button
            onClick={() => setActiveDays(new Set(ALL_DAYS))}
            className={cn(
              "ios-tap shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
              allActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
            )}
            data-testid="chip-day-all"
          >
            All days
          </button>
          {ALL_DAYS.map((d) => {
            const active = activeDays.has(d);
            const color = dayColor(d);
            return (
              <button
                key={d}
                onClick={() => toggle(d)}
                className={cn(
                  "ios-tap flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  active ? "border-foreground/20 bg-card" : "border-border bg-muted text-muted-foreground"
                )}
                data-testid={`chip-day-${d}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, opacity: active ? 1 : 0.4 }} />
                Day {d}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={mapRef} className="h-[58dvh] w-full overflow-hidden rounded-3xl border bg-muted shadow-md" data-testid="map-container" />

      {dayWalking.length > 0 && (
        <div className="mt-3 rounded-2xl border bg-card overflow-hidden">
          <p className="border-b bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Walking time per day</p>
          <ul className="divide-y">
            {dayWalking.map((d) => (
              <li key={d.day} className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dayColor(d.day) }} />
                  Day {d.day}
                </span>
                <span className="tabular-nums text-muted-foreground">{d.minutes} min · {(d.meters / 1000).toFixed(1)} km</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">Tap a pin to preview the activity. Use day chips above to filter.</p>
    </PageContainer>
  );
}

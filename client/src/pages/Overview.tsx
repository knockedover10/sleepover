import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTripData, formatMoney, daysUntil, formatDateShort, totalSpent, dayDateLabel } from "@/lib/trip-data";
import { fetchWeather, type WeatherDay } from "@/lib/external";
import { buildReminders, type Reminder } from "@/lib/reminders";
import { useTripCtx } from "@/lib/trip-context";
import {
  Sun, Cloud, CloudSun, CloudRain, CloudDrizzle, Plane, Wallet, ListChecks,
  FolderClosed, CalendarClock, ChevronRight, AlertTriangle, X,
} from "lucide-react";
import { PageContainer } from "@/components/AppShell";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import type { ReactNode } from "react";

const wIcon: Record<WeatherDay["condition"], ReactNode> = {
  sunny: <Sun className="h-5 w-5 text-amber-500" />,
  partly: <CloudSun className="h-5 w-5 text-amber-500/80" />,
  cloudy: <Cloud className="h-5 w-5 text-slate-400" />,
  showers: <CloudDrizzle className="h-5 w-5 text-sky-500" />,
  rain: <CloudRain className="h-5 w-5 text-sky-600" />,
};

function StatCard({ icon, label, value, hint, to, testid }: {
  icon: ReactNode; label: string; value: string; hint?: string; to: string; testid: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(to)}
      className="ios-tap flex flex-col gap-2 rounded-2xl border bg-card p-3.5 text-left hover-elevate"
      data-testid={testid}
    >
      <div className="flex items-center justify-between">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">{icon}</div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-base font-semibold leading-tight">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </button>
  );
}

export default function Overview() {
  const data = useTripData();
  const { trip: tripRaw, inviteToken } = useTripCtx();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const tripView = data.trip;

  const weatherQ = useQuery<WeatherDay[]>({
    queryKey: ["weather", tripView?.startDate, tripView?.endDate, tripRaw?.latitude, tripRaw?.longitude],
    enabled: !!tripView?.startDate && !!tripView?.endDate,
    staleTime: 60 * 60 * 1000, // 1h
    queryFn: async () => {
      const lat = tripRaw?.latitude ?? tripView!.centerLat;
      const lng = tripRaw?.longitude ?? tripView!.centerLng;
      const start = tripView!.startDate;
      const end = tripView!.endDate;
      // Open-Meteo only forecasts ~16d into the future. If trip is far out, use a sample range starting today.
      const todayMs = Date.now();
      const startMs = new Date(start).getTime();
      const horizonMs = todayMs + 16 * 86400000;
      let s = start, e = end;
      if (startMs > horizonMs) {
        s = new Date(todayMs).toISOString().slice(0,10);
        e = new Date(todayMs + 8 * 86400000).toISOString().slice(0,10);
      }
      try { return await fetchWeather(lat, lng, s, e); }
      catch { return []; }
    },
  });

  const reminders: Reminder[] = useMemo(() => {
    if (!tripRaw) return [];
    const rainDay = (weatherQ.data || []).find((w) => w.precipChance > 50);
    return buildReminders({
      trip: tripRaw,
      items: data.itineraryRaw,
      expenses: data.expenses.map((e) => e._raw),
      splits: data.splits,
      tasks: data.tasks.map((t) => t._raw),
      documents: [],
      travelers: data.travelersRaw,
      me: data.meRaw,
      now: new Date(),
      weatherRain: rainDay ? { date: rainDay.date, chance: rainDay.precipChance } : null,
      inviteToken: inviteToken || undefined,
    });
  }, [tripRaw, data, weatherQ.data, inviteToken]);

  const visibleReminders = reminders.filter((r) => !dismissed.has(r.id));

  if (!tripView) {
    return (
      <PageContainer>
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Loading trip…</p>
        </div>
      </PageContainer>
    );
  }

  const days = daysUntil(tripView.startDate);
  const spent = totalSpent(data.expenses);
  const openTasks = data.tasks.filter((t) => !t.done).length;
  const docCount = data.documents.length;

  // "Today's plan" — find current day or first upcoming
  const todayIso = new Date().toISOString().slice(0, 10);
  let activeDayNum = 1;
  if (tripView.startDate) {
    const startMs = new Date(tripView.startDate + "T00:00:00").getTime();
    const todayMs = new Date(todayIso + "T00:00:00").getTime();
    const diff = Math.floor((todayMs - startMs) / 86400000) + 1;
    if (diff >= 1 && diff <= tripView.numDays) activeDayNum = diff;
  }
  const dayItems = data.itinerary.filter((i) => i.day === activeDayNum);
  const next = data.itinerary[0];

  return (
    <PageContainer>
      <section className="relative overflow-hidden rounded-3xl shadow-md" data-testid="hero-overview">
        <div
          className="aspect-[4/5] w-full bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.55) 100%), url(${tripView.heroImage})`,
            backgroundColor: "hsl(183 40% 30%)",
          }}
          role="img"
          aria-label={`${tripView.destination}`}
        />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-80">{tripView.destination}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{tripView.name}</h1>
          <p className="mt-1 text-sm opacity-90">
            {formatDateShort(tripView.startDate)} – {formatDateShort(tripView.endDate)} · {tripView.numDays} days · {tripView.baseCurrency} {tripView.budget.toLocaleString()} budget
          </p>
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-foreground shadow">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-primary" />
          {days >= 0 ? `${days} days to go` : `Day ${activeDayNum}`}
        </div>
      </section>

      {/* Reminders */}
      {visibleReminders.length > 0 && (
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Reminders</h2>
            <span className="text-[11px] text-muted-foreground">{visibleReminders.length} active</span>
          </div>
          <div className="space-y-2">
            {visibleReminders.slice(0, 3).map((r) => (
              <div
                key={r.id}
                onClick={() => r.related_link && setLocation(r.related_link)}
                className={`ios-tap flex items-start gap-3 rounded-2xl border p-3 hover-elevate cursor-pointer ${
                  r.severity === "urgent"
                    ? "bg-red-500/8 border-red-500/30"
                    : r.severity === "warning"
                      ? "bg-amber-500/8 border-amber-500/30"
                      : "bg-card"
                }`}
                data-testid={`reminder-${r.id}`}
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    r.severity === "urgent" ? "text-red-600" : r.severity === "warning" ? "text-amber-600" : "text-primary"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                </div>
                {r.dismissable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDismissed((s) => new Set(s).add(r.id)); }}
                    className="ios-tap rounded-full p-1 text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5">
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Spent" value={formatMoney(spent, tripView.baseCurrency)} hint={`of ${formatMoney(tripView.budget, tripView.baseCurrency)}`} to={`/t/${inviteToken}/budget`} testid="card-stat-spent" />
        <StatCard icon={<ListChecks className="h-4 w-4" />} label="Open tasks" value={`${openTasks}`} hint={`${data.tasks.length - openTasks} done`} to={`/t/${inviteToken}/tasks`} testid="card-stat-tasks" />
        <StatCard icon={<FolderClosed className="h-4 w-4" />} label="Documents" value={`${docCount}`} hint="Vault" to={`/t/${inviteToken}/documents`} testid="card-stat-docs" />
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Next up" value={next ? (next.title.length > 16 ? next.title.slice(0, 15) + "…" : next.title) : "—"} hint={next ? `Day ${next.day} · ${next.time}` : ""} to={`/t/${inviteToken}/itinerary`} testid="card-stat-next" />
      </section>

      <section className="mt-4 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Budget</p>
          <p className="text-xs text-muted-foreground">{formatMoney(spent, tripView.baseCurrency)} / {formatMoney(tripView.budget, tripView.baseCurrency)}</p>
        </div>
        <Progress value={tripView.budget > 0 ? (spent / tripView.budget) * 100 : 0} className="mt-3 h-2" data-testid="progress-budget" />
        <p className="mt-2 text-[11px] text-muted-foreground">
          {tripView.budget > 0 ? Math.round((spent / tripView.budget) * 100) : 0}% used · {formatMoney(Math.max(0, tripView.budget - spent), tripView.baseCurrency)} left
        </p>
      </section>

      {/* Weather */}
      {weatherQ.data && weatherQ.data.length > 0 && (
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Forecast — {tripView.destination}</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            {weatherQ.data.map((w) => {
              const d = new Date(w.date + "T00:00:00");
              return (
                <div
                  key={w.date}
                  className="flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-2xl border bg-card p-2.5"
                  data-testid={`weather-${w.date}`}
                >
                  <span className="text-[11px] font-semibold text-muted-foreground">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDateShort(w.date)}</span>
                  <div className="my-0.5">{wIcon[w.condition]}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold">{w.hi}°</span>
                    <span className="text-[11px] text-muted-foreground">{w.lo}°</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-4 rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Day {activeDayNum} — {dayDateLabel(tripView.startDate, activeDayNum)}</h2>
          </div>
          <button onClick={() => setLocation(`/t/${inviteToken}/itinerary`)} className="text-xs font-medium text-primary">All days</button>
        </div>
        {dayItems.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Nothing planned yet for this day.</p>
        ) : (
          <ul className="divide-y">
            {dayItems.map((item) => (
              <li key={item.id} className="flex gap-3 px-4 py-2.5">
                <div className="w-12 shrink-0 text-xs font-mono font-semibold text-muted-foreground">{item.time}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.location}</p>
                </div>
                <span className="day-bg-1 mt-1.5 h-2 w-2 shrink-0 rounded-full" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Recent expenses</h2>
          <button onClick={() => setLocation(`/t/${inviteToken}/budget`)} className="text-xs font-medium text-primary">See all</button>
        </div>
        {data.expenses.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">No expenses logged yet.</p>
        ) : (
          <ul className="divide-y">
            {data.expenses.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{e.category}</p>
                </div>
                <p className="ml-3 text-sm font-semibold tabular-nums">{formatMoney(e.amountSGD, tripView.baseCurrency)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}


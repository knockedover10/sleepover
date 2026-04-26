// Pure client-side smart-reminders engine.
import type {
  Trip,
  ItineraryItem,
  Expense,
  Task,
  TravelDocument,
  Traveler,
  ExpenseSplit,
} from "./types";

export type ReminderSeverity = "info" | "warning" | "urgent";
export type ReminderSourceType =
  | "flight"
  | "hotel"
  | "activity"
  | "packing"
  | "budget"
  | "weather"
  | "general";

export interface Reminder {
  id: string; // deterministic key
  title: string;
  description: string;
  severity: ReminderSeverity;
  source_type: ReminderSourceType;
  related_link?: string; // hash route
  fire_at: number; // ms epoch
  dismissable: boolean;
}

interface BuildInput {
  trip: Trip;
  items: ItineraryItem[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  tasks: Task[];
  documents: TravelDocument[];
  travelers: Traveler[];
  me?: Traveler | null;
  now?: Date;
  weatherRain?: { date: string; chance: number } | null;
  inviteToken?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function dateAt(dateIso: string | null, time?: string | null) {
  if (!dateIso) return null;
  const t = time ? time.slice(0, 5) : "09:00";
  return new Date(`${dateIso}T${t}:00`);
}

function dayDate(trip: Trip, dayNumber: number) {
  if (!trip.start_date) return null;
  const d = new Date(trip.start_date + "T00:00:00");
  d.setDate(d.getDate() + (dayNumber - 1));
  return d;
}

export function buildReminders(input: BuildInput): Reminder[] {
  const { trip, items, expenses, splits, tasks, documents, travelers, me, weatherRain, inviteToken } =
    input;
  const now = input.now || new Date();
  const out: Reminder[] = [];
  const link = (sub: string) => (inviteToken ? `/t/${inviteToken}${sub}` : sub);

  if (!trip.start_date || !trip.end_date) return out;
  const start = new Date(trip.start_date + "T00:00:00");
  const end = new Date(trip.end_date + "T23:59:59");
  const daysToStart = Math.ceil((start.getTime() - now.getTime()) / DAY);
  const inTrip = now >= start && now <= end;

  // ─── itinerary-driven ───
  for (const it of items) {
    const itDate = dayDate(trip, it.day_number);
    if (!itDate) continue;
    const itStart = dateAt(itDate.toISOString().slice(0, 10), it.start_time);
    if (!itStart) continue;

    if (it.category === "flight" && it.flight_number) {
      out.push({
        id: `flight-checkin-${it.id}`,
        title: `Online check-in: ${it.flight_number}`,
        description: `Opens 24h before departure (${itStart.toLocaleString()}). Get a good seat.`,
        severity: "info",
        source_type: "flight",
        related_link: link("/itinerary"),
        fire_at: itStart.getTime() - 24 * HOUR,
        dismissable: true,
      });
      out.push({
        id: `flight-headsup-${it.id}`,
        title: `Flight ${it.flight_number} in 4h`,
        description: `Leave for the airport. ${it.title}.`,
        severity: "warning",
        source_type: "flight",
        related_link: link("/itinerary"),
        fire_at: itStart.getTime() - 4 * HOUR,
        dismissable: true,
      });
      // tz heads-up if home != destination
      if (trip.home_timezone !== trip.destination_timezone) {
        out.push({
          id: `tz-${it.id}`,
          title: "Time zone change ahead",
          description: `${trip.home_timezone} → ${trip.destination_timezone}. Adjust your watch.`,
          severity: "info",
          source_type: "general",
          fire_at: itStart.getTime() - 24 * HOUR,
          dismissable: true,
        });
      }
    }

    if (it.category === "lodging") {
      if (it.check_in_time) {
        out.push({
          id: `hotel-checkin-${it.id}`,
          title: `Hotel check-in: ${it.title}`,
          description: `${it.location_name || ""} — check-in at ${it.check_in_time.slice(0, 5)}.`,
          severity: "info",
          source_type: "hotel",
          related_link: link("/itinerary"),
          fire_at: dateAt(itDate.toISOString().slice(0, 10), it.check_in_time)?.getTime() || itStart.getTime(),
          dismissable: true,
        });
      }
      if (it.check_out_time) {
        const co = dateAt(itDate.toISOString().slice(0, 10), it.check_out_time)!;
        out.push({
          id: `hotel-checkout-${it.id}`,
          title: `Checkout reminder: ${it.title}`,
          description: `Pack up — checkout at ${it.check_out_time.slice(0, 5)}.`,
          severity: "warning",
          source_type: "hotel",
          related_link: link("/itinerary"),
          fire_at: co.getTime() - 12 * HOUR,
          dismissable: true,
        });
      }
    }

    // Activity 2h heads-up (any time-sensitive item)
    if (it.start_time && (it.category === "activity" || it.category === "sight" || it.category === "food")) {
      out.push({
        id: `activity-${it.id}`,
        title: `Soon: ${it.title}`,
        description: `${it.start_time.slice(0, 5)} at ${it.location_name || "—"}.`,
        severity: "info",
        source_type: "activity",
        related_link: link("/itinerary"),
        fire_at: itStart.getTime() - 2 * HOUR,
        dismissable: true,
      });
    }
  }

  // ─── pre-trip macro reminders ───
  if (daysToStart > 0) {
    if (daysToStart <= 30 && daysToStart > 13) {
      out.push({
        id: `visa-30`,
        title: "Visa check (30 days out)",
        description: "Make sure visas are sorted if your destination needs one.",
        severity: "info",
        source_type: "general",
        related_link: link("/tasks"),
        fire_at: start.getTime() - 30 * DAY,
        dismissable: true,
      });
    }

    const hasInsurance = documents.some((d) => d.category === "insurance");
    if (daysToStart <= 14 && !hasInsurance) {
      out.push({
        id: `insurance-14`,
        title: "Travel insurance (14 days out)",
        description: "No insurance docs on file. Buy a policy and upload it.",
        severity: "warning",
        source_type: "general",
        related_link: link("/documents"),
        fire_at: start.getTime() - 14 * DAY,
        dismissable: true,
      });
    }
    if (daysToStart <= 7 && daysToStart > 3) {
      out.push({
        id: `cash-7`,
        title: "Currency / cash withdrawal",
        description: "Pick up local currency this week.",
        severity: "info",
        source_type: "general",
        related_link: link("/tasks"),
        fire_at: start.getTime() - 7 * DAY,
        dismissable: true,
      });
      out.push({
        id: `adapter-7`,
        title: "Power adapter & SIM",
        description: "Buy / pack adapter, eSIM or local SIM.",
        severity: "info",
        source_type: "packing",
        fire_at: start.getTime() - 7 * DAY,
        dismissable: true,
      });
      out.push({
        id: `budget-review-7`,
        title: "Pre-trip budget review",
        description: `Re-check ${trip.base_currency} ${trip.budget_total ?? "—"} budget vs plans.`,
        severity: "info",
        source_type: "budget",
        related_link: link("/budget"),
        fire_at: start.getTime() - 7 * DAY,
        dismissable: true,
      });
    }
    if (daysToStart <= 3 && weatherRain && weatherRain.chance > 50) {
      out.push({
        id: `pack-rain`,
        title: "Pack rain gear",
        description: `Forecast: ${weatherRain.chance}% rain on ${weatherRain.date}.`,
        severity: "warning",
        source_type: "weather",
        fire_at: start.getTime() - 3 * DAY,
        dismissable: true,
      });
    }
  }

  // ─── on-trip nudges ───
  if (inTrip && trip.budget_total) {
    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount_in_base), 0);
    const tripDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY));
    const elapsed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / DAY));
    const expected = (Number(trip.budget_total) / tripDays) * elapsed;
    if (totalSpent > expected * 1.15) {
      out.push({
        id: `budget-pace`,
        title: "Spending faster than budget",
        description: `${trip.base_currency} ${totalSpent.toFixed(0)} spent vs ${expected.toFixed(0)} expected.`,
        severity: "warning",
        source_type: "budget",
        related_link: link("/budget"),
        fire_at: now.getTime(),
        dismissable: true,
      });
    }
    out.push({
      id: `expense-log-${now.toISOString().slice(0, 10)}`,
      title: "Log today's expenses",
      description: "Add anything you spent today before bed.",
      severity: "info",
      source_type: "budget",
      related_link: link("/budget"),
      fire_at: new Date(now.toISOString().slice(0, 10) + "T20:00:00").getTime(),
      dismissable: true,
    });
    // Daily preview at 9pm
    const tomorrowDay =
      Math.ceil((now.getTime() - start.getTime()) / DAY) + 2;
    const tomorrowItems = items
      .filter((i) => i.day_number === tomorrowDay)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    if (tomorrowItems.length) {
      const first = tomorrowItems[0];
      out.push({
        id: `daily-preview-${tomorrowDay}`,
        title: `Tomorrow: ${first.title}`,
        description: `${first.start_time?.slice(0, 5) || ""} — ${first.location_name || ""}`,
        severity: "info",
        source_type: "general",
        related_link: link("/itinerary"),
        fire_at: new Date(now.toISOString().slice(0, 10) + "T21:00:00").getTime(),
        dismissable: true,
      });
    }
  }

  // ─── settle-up day before trip ends ───
  if (inTrip) {
    const dayBeforeEnd = end.getTime() - DAY;
    if (Math.abs(now.getTime() - dayBeforeEnd) < 2 * DAY) {
      out.push({
        id: `settle-up`,
        title: "Settle up before you go",
        description: "Run final settlements while everyone's still together.",
        severity: "info",
        source_type: "budget",
        related_link: link("/budget"),
        fire_at: dayBeforeEnd,
        dismissable: true,
      });
    }
  }

  // ─── balance imbalance warning ───
  const balance: Record<string, number> = {};
  for (const t of travelers) balance[t.id] = 0;
  for (const e of expenses) balance[e.paid_by_traveler_id] = (balance[e.paid_by_traveler_id] || 0) + Number(e.amount_in_base);
  for (const s of splits) balance[s.traveler_id] = (balance[s.traveler_id] || 0) - Number(s.share_amount_in_base);
  for (const [tid, amt] of Object.entries(balance)) {
    if (amt > 300) {
      const t = travelers.find((x) => x.id === tid);
      out.push({
        id: `imbalance-${tid}`,
        title: `${t?.name || "Someone"} is owed ${trip.base_currency} ${amt.toFixed(0)}`,
        description: "Consider partial settle-up to keep things even.",
        severity: "warning",
        source_type: "budget",
        related_link: link("/budget"),
        fire_at: now.getTime(),
        dismissable: true,
      });
    }
  }

  // ─── receipt missing for big expenses ───
  for (const e of expenses) {
    if (Number(e.amount_in_base) > 100 && !e.receipt_photo_path) {
      out.push({
        id: `receipt-${e.id}`,
        title: `No receipt: ${e.title}`,
        description: `${trip.base_currency} ${Number(e.amount_in_base).toFixed(0)} — add a receipt photo.`,
        severity: "info",
        source_type: "budget",
        related_link: link("/budget"),
        fire_at: now.getTime(),
        dismissable: true,
      });
    }
  }

  // sort: severity desc (urgent>warning>info), then fire_at desc (recent first)
  const sevRank: Record<ReminderSeverity, number> = { urgent: 3, warning: 2, info: 1 };
  return out.sort((a, b) => {
    const s = sevRank[b.severity] - sevRank[a.severity];
    if (s !== 0) return s;
    return Math.abs(a.fire_at - now.getTime()) - Math.abs(b.fire_at - now.getTime());
  });
}

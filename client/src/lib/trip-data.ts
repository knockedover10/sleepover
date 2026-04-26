// ──────────────────────────────────────────────────────────────────────
// Live data adapter. Wraps Supabase queries to expose the same shape the
// existing mockup UI expected. Pages call `useTripData()` to get every-
// thing for the current trip in one bundle.
// ──────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { useTripCtx } from "./trip-context";
import {
  useItinerary,
  useExpenses,
  useExpenseSplits,
  useTasks,
  useTaskAssignees,
  useDocuments,
  useCurrencies,
} from "./trip-queries";
import type {
  Trip as DbTrip,
  Traveler as DbTraveler,
  ItineraryItem as DbItem,
  Expense as DbExpense,
  ExpenseSplit,
  Task as DbTask,
  TaskAssignee,
  TravelDocument,
  Currency as DbCurrency,
} from "./types";

// ─── Mockup-compatible view types (used by existing pages) ───────────
export type DayIndex = number;

export interface Traveler {
  id: string;
  name: string;
  initials: string;
  color: string;
  isMe?: boolean;
}

export interface ItineraryItem {
  id: string;
  day: number;
  date: string;
  time: string;
  endTime?: string;
  title: string;
  location: string;
  notes?: string;
  lat: number;
  lng: number;
  category: "Food" | "Sightseeing" | "Transit" | "Stay" | "Activity" | "Shopping";
  // raw refs for mutations
  _raw: DbItem;
}

export interface Expense {
  id: string;
  date: string;
  title: string;
  category: "Lodging" | "Food" | "Transport" | "Activities" | "Other";
  amount: number;
  currency: string;
  amountSGD: number;
  paidBy: string;
  sharedWith: string[];
  splitMode: "equal" | "custom" | "percentage" | "itemized";
  receipt?: string | null;
  _raw: DbExpense;
  splits: ExpenseSplit[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  assignees: string[];
  dueDate?: string;
  category: "Pre-trip" | "Booking" | "Packing" | "On-trip";
  _raw: DbTask;
}

export interface TravelDoc {
  id: string;
  filename: string;
  type: "pdf" | "img";
  sizeKB: number;
  uploaderId: string;
  privacy: "Private" | "Shared";
  category: "Identity" | "Visas" | "Flights" | "Accommodation" | "Activities" | "Insurance";
  availableOffline?: boolean;
  filePath: string;
  mime: string;
}

// ─── helpers ────────────────────────────────────────────────────────

const CAT_TO_VIEW: Record<DbItem["category"], ItineraryItem["category"]> = {
  food: "Food",
  sight: "Sightseeing",
  transport: "Transit",
  flight: "Transit",
  lodging: "Stay",
  activity: "Activity",
  other: "Shopping",
};
export const VIEW_TO_DB: Record<ItineraryItem["category"], DbItem["category"]> = {
  Food: "food",
  Sightseeing: "sight",
  Transit: "transport",
  Stay: "lodging",
  Activity: "activity",
  Shopping: "other",
};

const EXP_CAT_TO_VIEW: Record<DbExpense["category"], Expense["category"]> = {
  lodging: "Lodging",
  food: "Food",
  transport: "Transport",
  activities: "Activities",
  other: "Other",
};
export const EXP_VIEW_TO_DB: Record<Expense["category"], DbExpense["category"]> = {
  Lodging: "lodging",
  Food: "food",
  Transport: "transport",
  Activities: "activities",
  Other: "other",
};

const TASK_CAT_TO_VIEW: Record<string, Task["category"]> = {
  "pre-trip": "Pre-trip",
  booking: "Booking",
  packing: "Packing",
  "on-trip": "On-trip",
  general: "Pre-trip",
  "post-trip": "On-trip",
};
export const TASK_VIEW_TO_DB: Record<Task["category"], DbTask["category"]> = {
  "Pre-trip": "pre-trip",
  Booking: "booking",
  Packing: "packing",
  "On-trip": "on-trip",
};

const DOC_CAT_TO_VIEW: Record<string, TravelDoc["category"]> = {
  identity: "Identity",
  visas: "Visas",
  flights: "Flights",
  accommodation: "Accommodation",
  activities: "Activities",
  insurance: "Insurance",
  transport: "Activities",
  other: "Activities",
};
export const DOC_VIEW_TO_DB: Record<TravelDoc["category"], string> = {
  Identity: "identity",
  Visas: "visas",
  Flights: "flights",
  Accommodation: "accommodation",
  Activities: "activities",
  Insurance: "insurance",
};

function dayDateIso(start: string, day: number): string {
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + (day - 1));
  return d.toISOString().slice(0, 10);
}

// ─── main hook ──────────────────────────────────────────────────────
export function useTripData() {
  const { trip, travelers, me, deviceId, inviteToken, isLoading } = useTripCtx();
  const tripId = trip?.id || null;

  const itinQ = useItinerary(tripId);
  const expQ = useExpenses(tripId);
  const expIds = useMemo(() => (expQ.data || []).map((e) => e.id), [expQ.data]);
  const splitsQ = useExpenseSplits(tripId, expIds);
  const tasksQ = useTasks(tripId);
  const taskIds = useMemo(() => (tasksQ.data || []).map((t) => t.id), [tasksQ.data]);
  const assigneesQ = useTaskAssignees(tripId, taskIds);
  const docsQ = useDocuments(tripId);
  const currenciesQ = useCurrencies(tripId);

  // Travelers in mockup-friendly shape
  const viewTravelers: Traveler[] = useMemo(() => {
    return travelers.map((t) => ({
      id: t.id,
      name: t.name,
      initials: (t.name?.[0] || "?").toUpperCase(),
      color: t.color,
      isMe: t.device_id === deviceId,
    }));
  }, [travelers, deviceId]);

  const meView = useMemo<Traveler | null>(() => {
    if (!me) return null;
    return {
      id: me.id,
      name: me.name,
      initials: (me.name?.[0] || "?").toUpperCase(),
      color: me.color,
      isMe: true,
    };
  }, [me]);

  // Trip in mockup shape
  const tripView = useMemo(() => {
    if (!trip) return null;
    const numDays = trip.start_date && trip.end_date
      ? Math.ceil(
          (new Date(trip.end_date + "T00:00:00").getTime() -
            new Date(trip.start_date + "T00:00:00").getTime()) /
            86400000
        ) + 1
      : 0;
    return {
      id: trip.id,
      name: trip.name,
      destination: trip.destination || "",
      startDate: trip.start_date || "",
      endDate: trip.end_date || "",
      baseCurrency: trip.base_currency,
      budget: trip.budget_total ? Number(trip.budget_total) : 0,
      notes: trip.notes || "",
      shareUrl:
        typeof window !== "undefined"
          ? `${window.location.origin}/#/t/${trip.invite_token}`
          : `/#/t/${trip.invite_token}`,
      heroImage:
        "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1200&q=80&auto=format&fit=crop",
      centerLat: 35.6762,
      centerLng: 139.6503,
      numDays,
      inviteToken: trip.invite_token,
      _raw: trip as DbTrip,
    };
  }, [trip]);

  // Itinerary
  const itinerary: ItineraryItem[] = useMemo(() => {
    if (!trip || !trip.start_date || !itinQ.data) return [];
    return itinQ.data.map((it) => ({
      id: it.id,
      day: it.day_number,
      date: dayDateIso(trip.start_date!, it.day_number),
      time: (it.start_time || "00:00").slice(0, 5),
      endTime: it.end_time?.slice(0, 5),
      title: it.title,
      location: it.location_name || "",
      notes: it.notes || undefined,
      lat: it.latitude || 0,
      lng: it.longitude || 0,
      category: CAT_TO_VIEW[it.category],
      _raw: it,
    }));
  }, [itinQ.data, trip]);

  // Expenses
  const expenses: Expense[] = useMemo(() => {
    if (!expQ.data) return [];
    const splitsByExp = new Map<string, ExpenseSplit[]>();
    for (const s of splitsQ.data || []) {
      const arr = splitsByExp.get(s.expense_id) || [];
      arr.push(s);
      splitsByExp.set(s.expense_id, arr);
    }
    return expQ.data.map((e) => {
      const sp = splitsByExp.get(e.id) || [];
      return {
        id: e.id,
        date: e.date,
        title: e.title,
        category: EXP_CAT_TO_VIEW[e.category],
        amount: Number(e.amount_original),
        currency: e.currency,
        amountSGD: Number(e.amount_in_base),
        paidBy: e.paid_by_traveler_id,
        sharedWith: sp.map((s) => s.traveler_id),
        splitMode: e.split_mode,
        receipt: e.receipt_photo_path,
        _raw: e,
        splits: sp,
      };
    });
  }, [expQ.data, splitsQ.data]);

  // Tasks
  const tasks: Task[] = useMemo(() => {
    if (!tasksQ.data) return [];
    const byTask = new Map<string, string[]>();
    for (const a of assigneesQ.data || []) {
      const arr = byTask.get(a.task_id) || [];
      arr.push(a.traveler_id);
      byTask.set(a.task_id, arr);
    }
    return tasksQ.data.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || undefined,
      done: t.is_done,
      assignees: byTask.get(t.id) || [],
      dueDate: t.due_date || undefined,
      category: TASK_CAT_TO_VIEW[t.category] || "Pre-trip",
      _raw: t,
    }));
  }, [tasksQ.data, assigneesQ.data]);

  const documents: TravelDoc[] = useMemo(() => {
    if (!docsQ.data) return [];
    return docsQ.data.map((d) => ({
      id: d.id,
      filename: d.filename,
      type: d.mime_type === "application/pdf" ? "pdf" : "img",
      sizeKB: Math.round(Number(d.file_size_bytes) / 1024),
      uploaderId: d.uploader_traveler_id,
      privacy: d.is_shared ? "Shared" : "Private",
      category: DOC_CAT_TO_VIEW[d.category] || "Identity",
      filePath: d.file_path,
      mime: d.mime_type,
    }));
  }, [docsQ.data]);

  const currencies = useMemo(() => {
    const list = currenciesQ.data || [];
    return list.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.label || c.code,
      rateToSGD: Number(c.rate_to_base),
      perOneSGD: Number(c.rate_to_base) === 1 ? 1 : 1 / Number(c.rate_to_base),
      isBase: c.code === trip?.base_currency,
      _raw: c as DbCurrency,
    }));
  }, [currenciesQ.data, trip]);

  return {
    isLoading: isLoading || itinQ.isLoading || expQ.isLoading,
    inviteToken,
    deviceId,
    trip: tripView,
    travelers: viewTravelers,
    travelersRaw: travelers as DbTraveler[],
    me: meView,
    meRaw: me,
    itinerary,
    itineraryRaw: itinQ.data || [],
    expenses,
    splits: splitsQ.data || [],
    tasks,
    taskAssignees: assigneesQ.data || [],
    documents,
    currencies,
  };
}

// ─── presentational helpers ────────────────────────────────────────
export function getTraveler(travelers: Traveler[], id: string) {
  return travelers.find((t) => t.id === id);
}

export function dayDateLabel(start: string | null | undefined, day: number): string {
  if (!start) return `Day ${day}`;
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + (day - 1));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatMoney(amount: number, currency: string = "SGD"): string {
  try {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number {
  if (!iso) return 0;
  const target = new Date(iso + "T00:00:00");
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeSettlements(expenses: Expense[], travelers: Traveler[]) {
  const balances: Record<string, number> = {};
  for (const t of travelers) balances[t.id] = 0;
  for (const e of expenses) {
    balances[e.paidBy] = (balances[e.paidBy] || 0) + e.amountSGD;
    if (e.splits.length) {
      for (const s of e.splits) {
        balances[s.traveler_id] = (balances[s.traveler_id] || 0) - Number(s.share_amount_in_base);
      }
    } else {
      // legacy fallback (equal across sharedWith)
      const share = e.amountSGD / Math.max(1, e.sharedWith.length);
      for (const id of e.sharedWith) balances[id] = (balances[id] || 0) - share;
    }
  }
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.01)
    .map(([k, v]) => ({ id: k, amt: -v }))
    .sort((a, b) => b.amt - a.amt);
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.01)
    .map(([k, v]) => ({ id: k, amt: v }))
    .sort((a, b) => b.amt - a.amt);
  const settlements: Array<{ from: string; to: string; amount: number }> = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0.01) settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return { settlements, balances };
}

export function totalSpent(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + e.amountSGD, 0);
}

export function categoryTotals(expenses: Expense[]) {
  const cats = ["Lodging", "Food", "Transport", "Activities", "Other"] as const;
  return cats.map((c) => ({
    category: c,
    total: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.amountSGD, 0),
  }));
}

// Seeds the demo "Tokyo Spring 2026" trip on first load when a device has no trips.
import { supabase } from "./supabase";

const TRAVELER_COLORS = ["#2c7273", "#c25e2a", "#c89b32", "#7a5da6", "#1f6f54", "#a8453d"];

const PLACEHOLDER_DEVICE_PREFIX = "placeholder-";

interface SeedResult {
  trip_id: string;
  invite_token: string;
  me_traveler_id: string;
}

function fakeToken() {
  // human-readable: word-word-4hex
  const ws1 = ["snowy", "bright", "warm", "soft", "neon", "lazy", "early", "late", "sleepy"];
  const ws2 = ["tokyo", "kyoto", "osaka", "fuji", "harbor", "city", "trail", "village"];
  const a = ws1[Math.floor(Math.random() * ws1.length)];
  const b = ws2[Math.floor(Math.random() * ws2.length)];
  const r = Math.floor(Math.random() * 65536).toString(16).padStart(4, "0");
  return `${a}-${b}-${r}`;
}

const ITINERARY: Array<{
  day: number;
  start_time: string;
  title: string;
  location_name: string;
  notes: string;
  latitude: number;
  longitude: number;
  category: "food" | "sight" | "transport" | "lodging" | "activity" | "flight" | "other";
}> = [
  // Day 1
  { day: 1, start_time: "16:30", title: "Arrive Haneda Airport", location_name: "HND, Ōta", notes: "SQ 12 lands 16:30. Buy IC cards at JR ticket office.", latitude: 35.5494, longitude: 139.7798, category: "flight" },
  { day: 1, start_time: "18:00", title: "Check-in Hotel Niwa", location_name: "Kanda, Chiyoda", notes: "Twin rooms × 2.", latitude: 35.6928, longitude: 139.76, category: "lodging" },
  { day: 1, start_time: "20:00", title: "Dinner: Tonkatsu Maisen", location_name: "Aoyama", notes: "Casual welcome dinner. Walk-in OK before 21:00.", latitude: 35.665, longitude: 139.711, category: "food" },
  // Day 2
  { day: 2, start_time: "09:00", title: "Senso-ji Temple", location_name: "Asakusa", notes: "Get there before crowds. Try ningyo-yaki.", latitude: 35.7148, longitude: 139.7967, category: "sight" },
  { day: 2, start_time: "12:00", title: "Lunch: Daikokuya Tempura", location_name: "Asakusa", notes: "Famous tendon. Expect 30 min queue.", latitude: 35.7143, longitude: 139.7958, category: "food" },
  { day: 2, start_time: "14:30", title: "Akihabara Electric Town", location_name: "Akihabara", notes: "Yodobashi Camera, Mandarake.", latitude: 35.7022, longitude: 139.7745, category: "other" },
  { day: 2, start_time: "19:00", title: "Izakaya: Andy's Shin Hinomoto", location_name: "Yurakucho", notes: "Under-the-tracks izakaya. Booked 4 seats.", latitude: 35.674, longitude: 139.7637, category: "food" },
  // Day 3
  { day: 3, start_time: "10:00", title: "teamLab Planets Tokyo", location_name: "Toyosu", notes: "Tickets booked — 10:00 entry.", latitude: 35.6489, longitude: 139.7901, category: "activity" },
  { day: 3, start_time: "13:30", title: "Lunch: Sushi no Midori", location_name: "Shibuya", notes: "Get ticket on arrival.", latitude: 35.6587, longitude: 139.7019, category: "food" },
  { day: 3, start_time: "15:30", title: "Shibuya Sky", location_name: "Shibuya", notes: "Sunset slot 17:00 booked.", latitude: 35.6586, longitude: 139.702, category: "sight" },
  { day: 3, start_time: "20:00", title: "Group dinner: Kaikaya", location_name: "Shibuya", notes: "Reservation 8pm — 4 pax.", latitude: 35.6553, longitude: 139.6968, category: "food" },
  // Day 4
  { day: 4, start_time: "07:30", title: "Romance Car to Hakone", location_name: "Shinjuku Stn", notes: "Reserved seats 7:30 → 9:00.", latitude: 35.6896, longitude: 139.7006, category: "transport" },
  { day: 4, start_time: "10:00", title: "Hakone Open-Air Museum", location_name: "Hakone", notes: "Outdoor sculptures + Picasso pavilion.", latitude: 35.2447, longitude: 139.0567, category: "sight" },
  { day: 4, start_time: "13:00", title: "Lake Ashi cruise + Owakudani", location_name: "Hakone", notes: "Black eggs at sulphur valley.", latitude: 35.2061, longitude: 139.0264, category: "activity" },
  { day: 4, start_time: "20:30", title: "Onsen at hotel", location_name: "Kanda", notes: "Hotel rooftop onsen open till 23:00.", latitude: 35.6928, longitude: 139.76, category: "lodging" },
  // Day 5
  { day: 5, start_time: "11:00", title: "Check-in Airbnb Shimokita", location_name: "Shimokitazawa", notes: "Whole apt, 2 BR. Self check-in via lockbox.", latitude: 35.6614, longitude: 139.6678, category: "lodging" },
  { day: 5, start_time: "13:00", title: "Lunch + walk Harajuku", location_name: "Harajuku", notes: "Takeshita-dori, Bape, Cat Street.", latitude: 35.6702, longitude: 139.7026, category: "other" },
  { day: 5, start_time: "16:00", title: "Meiji Jingu Shrine", location_name: "Yoyogi", notes: "Forest walk to clear the head.", latitude: 35.6764, longitude: 139.6993, category: "sight" },
  { day: 5, start_time: "19:30", title: "Dinner: Afuri Ramen", location_name: "Harajuku", notes: "Yuzu shio ramen — Priya's request.", latitude: 35.6694, longitude: 139.7053, category: "food" },
  // Day 6
  { day: 6, start_time: "07:30", title: "Tsukiji Outer Market", location_name: "Tsukiji", notes: "Tamago, sushi breakfast, knife shopping.", latitude: 35.6655, longitude: 139.7707, category: "food" },
  { day: 6, start_time: "11:00", title: "Hamarikyu Gardens", location_name: "Hamarikyu", notes: "Tea ceremony in tea house on the pond.", latitude: 35.6595, longitude: 139.7635, category: "sight" },
  { day: 6, start_time: "14:00", title: "Ginza Six + Itoya", location_name: "Ginza", notes: "Stationery + dept store. Ginza Six rooftop.", latitude: 35.6694, longitude: 139.7644, category: "other" },
  { day: 6, start_time: "20:00", title: "Omakase: Sushi Yuu", location_name: "Ginza", notes: "Splurge dinner. Smart casual.", latitude: 35.6722, longitude: 139.7644, category: "food" },
  // Day 7
  { day: 7, start_time: "10:00", title: "Yanaka old-town walk", location_name: "Yanaka", notes: "Cat shrines, tofu donut, slow morning.", latitude: 35.7274, longitude: 139.7681, category: "sight" },
  { day: 7, start_time: "13:00", title: "Lunch: Innsyoutei", location_name: "Ueno Park", notes: "Set lunch in 1875 wooden teahouse.", latitude: 35.7156, longitude: 139.7745, category: "food" },
  { day: 7, start_time: "15:00", title: "Tokyo National Museum", location_name: "Ueno", notes: "Honkan + Heiseikan. Gift shop.", latitude: 35.7188, longitude: 139.776, category: "sight" },
  { day: 7, start_time: "19:00", title: "Final dinner: Ichiran Ramen", location_name: "Shibuya", notes: "Casual, individual booths.", latitude: 35.6595, longitude: 139.7005, category: "food" },
  // Day 8
  { day: 8, start_time: "09:00", title: "Last-minute Don Quijote run", location_name: "Shibuya", notes: "Snacks, KitKat, gifts.", latitude: 35.6595, longitude: 139.7036, category: "other" },
  { day: 8, start_time: "13:00", title: "Depart Haneda — SQ 11", location_name: "HND, Ōta", notes: "Be at airport by 11:00.", latitude: 35.5494, longitude: 139.7798, category: "flight" },
];

const EXPENSES_SEED: Array<{
  date: string; title: string; category: "lodging"|"food"|"transport"|"activities"|"other";
  amount_original: number; currency: string; amount_in_base: number; paid_by: 0|1|2|3;
}> = [
  { date: "2026-04-10", title: "Hotel Niwa — 4 nights", category: "lodging", amount_original: 96000, currency: "JPY", amount_in_base: 872.73, paid_by: 0 },
  { date: "2026-04-10", title: "Airport Limousine Bus × 4", category: "transport", amount_original: 13200, currency: "JPY", amount_in_base: 120.0, paid_by: 1 },
  { date: "2026-04-10", title: "Welcome dinner — Maisen", category: "food", amount_original: 14400, currency: "JPY", amount_in_base: 130.91, paid_by: 0 },
  { date: "2026-04-11", title: "Lunch — Daikokuya Tempura", category: "food", amount_original: 7600, currency: "JPY", amount_in_base: 69.09, paid_by: 2 },
  { date: "2026-04-11", title: "IC Cards × 4", category: "transport", amount_original: 12000, currency: "JPY", amount_in_base: 109.09, paid_by: 3 },
  { date: "2026-04-12", title: "teamLab Planets tickets", category: "activities", amount_original: 15600, currency: "JPY", amount_in_base: 141.82, paid_by: 0 },
  { date: "2026-04-12", title: "Shibuya Sky — sunset", category: "activities", amount_original: 11000, currency: "JPY", amount_in_base: 100.0, paid_by: 1 },
  { date: "2026-04-13", title: "Hakone Free Pass × 4", category: "transport", amount_original: 25600, currency: "JPY", amount_in_base: 232.73, paid_by: 0 },
  { date: "2026-04-13", title: "Lake Ashi cruise", category: "activities", amount_original: 8400, currency: "JPY", amount_in_base: 76.36, paid_by: 3 },
  { date: "2026-04-15", title: "Tsukiji breakfast", category: "food", amount_original: 9200, currency: "JPY", amount_in_base: 83.64, paid_by: 2 },
];

const TASKS_SEED: Array<{ title: string; category: "pre-trip"|"booking"|"packing"|"on-trip"|"general"; done?: boolean; due_date?: string; description?: string; assignees: number[] }> = [
  { title: "Renew passport", category: "pre-trip", done: true, due_date: "2026-03-30", assignees: [2] },
  { title: "Apply Japan eVisa", category: "pre-trip", done: true, due_date: "2026-03-15", assignees: [0,1,2,3] },
  { title: "Book airport transfer", category: "booking", due_date: "2026-04-08", description: "4-pax minivan. Compare Klook vs hotel pickup.", assignees: [1] },
  { title: "Confirm Day 3 dinner reservation", category: "on-trip", due_date: "2026-04-12", description: "Kaikaya — call same morning to confirm.", assignees: [0,1,2,3] },
  { title: "Bring universal adapter", category: "packing", due_date: "2026-04-09", description: "Japan uses Type-A 100V.", assignees: [0] },
  { title: "Travel insurance signed", category: "pre-trip", done: true, due_date: "2026-04-01", assignees: [0,1,2,3] },
  { title: "Pre-load Suica on Apple Wallet", category: "pre-trip", due_date: "2026-04-09", assignees: [0,1,3] },
  { title: "Print Hakone Free Pass vouchers", category: "booking", due_date: "2026-04-09", assignees: [0] },
  { title: "Cash exchange — JPY 50k each", category: "pre-trip", due_date: "2026-04-08", assignees: [0,1,2,3] },
  { title: "Buy comfortable walking shoes", category: "packing", due_date: "2026-04-05", assignees: [3] },
];

export async function seedTokyoTrip(deviceId: string): Promise<SeedResult> {
  const token = fakeToken();
  // 1) Create trip + me-traveler atomically
  const { data: created, error: createErr } = await supabase.rpc("create_trip", {
    p_name: "Tokyo Spring 2026",
    p_destination: "Tokyo, Japan",
    p_start_date: "2026-04-10",
    p_end_date: "2026-04-17",
    p_base_currency: "SGD",
    p_budget_total: 4000,
    p_notes: "Focus: cherry blossoms, food, teamLab, day-trip to Hakone.",
    p_invite_token: token,
    p_home_timezone: "Asia/Singapore",
    p_destination_timezone: "Asia/Tokyo",
    p_traveler_name: "Liew",
    p_traveler_color: TRAVELER_COLORS[0],
    p_device_id: deviceId,
  });
  if (createErr) throw createErr;
  const row: any = (created as any[])[0];
  const tripId: string = row.trip_id;
  const meTravelerId: string = row.traveler_id;

  // 2) Add 3 placeholder travelers
  const placeholderNames = ["Alex", "Priya", "Marcus"];
  const placeholderInserts = placeholderNames.map((name, i) => ({
    trip_id: tripId,
    name,
    color: TRAVELER_COLORS[i + 1],
    device_id: PLACEHOLDER_DEVICE_PREFIX + tripId.slice(0, 8) + "-" + name.toLowerCase(),
    is_owner: false,
  }));
  const { data: placeholders, error: pErr } = await supabase
    .from("travelers")
    .insert(placeholderInserts)
    .select();
  if (pErr) throw pErr;
  const allTravelerIds: string[] = [meTravelerId, ...((placeholders || []) as any[]).map((p: any) => p.id)];

  // 3) Currencies
  const { error: curErr } = await supabase.from("currencies").insert([
    { trip_id: tripId, code: "SGD", rate_to_base: 1, label: "Singapore Dollar (base)" },
    { trip_id: tripId, code: "JPY", rate_to_base: 1 / 110, label: "Japanese Yen" },
    { trip_id: tripId, code: "USD", rate_to_base: 1.34, label: "US Dollar" },
  ]);
  if (curErr) throw curErr;

  // 4) Itinerary items
  const itinRows = ITINERARY.map((it, idx) => ({
    trip_id: tripId,
    day_number: it.day,
    start_time: it.start_time,
    title: it.title,
    location_name: it.location_name,
    latitude: it.latitude,
    longitude: it.longitude,
    notes: it.notes,
    category: it.category,
    order_in_day: idx,
  }));
  const { error: itinErr } = await supabase.from("itinerary_items").insert(itinRows);
  if (itinErr) throw itinErr;

  // 5) Expenses + equal splits across all 4 travelers
  for (const e of EXPENSES_SEED) {
    const { data: ex, error } = await supabase
      .from("expenses")
      .insert({
        trip_id: tripId,
        title: e.title,
        amount_original: e.amount_original,
        currency: e.currency,
        amount_in_base: e.amount_in_base,
        date: e.date,
        category: e.category,
        paid_by_traveler_id: allTravelerIds[e.paid_by],
        split_mode: "equal",
      })
      .select()
      .single();
    if (error) throw error;
    const share = +(e.amount_in_base / allTravelerIds.length).toFixed(2);
    const splits = allTravelerIds.map((tid, i) => ({
      expense_id: ex.id,
      traveler_id: tid,
      // Adjust last to absorb rounding
      share_amount_in_base: i === allTravelerIds.length - 1
        ? +(e.amount_in_base - share * (allTravelerIds.length - 1)).toFixed(2)
        : share,
    }));
    const { error: sErr } = await supabase.from("expense_splits").insert(splits);
    if (sErr) throw sErr;
  }

  // 6) Tasks + assignees
  for (const t of TASKS_SEED) {
    const { data: tk, error: tkErr } = await supabase
      .from("tasks")
      .insert({
        trip_id: tripId,
        title: t.title,
        description: t.description || null,
        due_date: t.due_date || null,
        category: t.category,
        is_done: !!t.done,
        created_by_traveler_id: meTravelerId,
        source: "manual",
      })
      .select()
      .single();
    if (tkErr) throw tkErr;
    if (t.assignees.length) {
      const rows = t.assignees.map((i) => ({ task_id: tk.id, traveler_id: allTravelerIds[i] }));
      const { error: aErr } = await supabase.from("task_assignees").insert(rows);
      if (aErr) throw aErr;
    }
  }

  return { trip_id: tripId, invite_token: token, me_traveler_id: meTravelerId };
}

// ── Pre-trip auto-checklist (used for new non-demo trips) ──
export const PRETRIP_TEMPLATE: Array<{
  title: string;
  category: "pre-trip" | "booking" | "packing" | "on-trip";
  daysBefore: number;
  description?: string;
}> = [
  { title: "Check passport validity (>6 months)", category: "pre-trip", daysBefore: 60, description: "Renew if needed." },
  { title: "Apply for visa if required", category: "pre-trip", daysBefore: 45 },
  { title: "Book travel insurance", category: "pre-trip", daysBefore: 14 },
  { title: "Notify bank of travel dates", category: "pre-trip", daysBefore: 10 },
  { title: "Arrange currency / cash withdrawal", category: "pre-trip", daysBefore: 7 },
  { title: "Buy power adapter / SIM card", category: "packing", daysBefore: 7 },
  { title: "Confirm hotel + flight bookings", category: "booking", daysBefore: 5 },
  { title: "Pack — first draft", category: "packing", daysBefore: 3 },
  { title: "Online check-in for outbound flight", category: "booking", daysBefore: 1 },
  { title: "Charge devices, pack chargers", category: "packing", daysBefore: 1 },
  { title: "Print / save offline copies of bookings", category: "pre-trip", daysBefore: 2 },
  { title: "Set out-of-office", category: "pre-trip", daysBefore: 1 },
];

export async function insertPretripChecklist(tripId: string, startDate: string, creatorTravelerId: string) {
  const start = new Date(startDate + "T00:00:00");
  const rows = PRETRIP_TEMPLATE.map((t) => {
    const due = new Date(start);
    due.setDate(due.getDate() - t.daysBefore);
    return {
      trip_id: tripId,
      title: t.title,
      description: t.description || null,
      due_date: due.toISOString().slice(0, 10),
      category: t.category,
      source: "auto-generated" as const,
      created_by_traveler_id: creatorTravelerId,
    };
  });
  await supabase.from("tasks").insert(rows);
}

// Database row types (camelCase mirrors of the Supabase tables).

export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null;
  base_currency: string;
  budget_total: number | null;
  notes: string | null;
  invite_token: string;
  home_timezone: string;
  destination_timezone: string;
  created_at: string;
  // Optional cached geocode (added in code only — column not required, but harmless if missing).
  latitude?: number | null;
  longitude?: number | null;
}

export interface Traveler {
  id: string;
  trip_id: string;
  name: string;
  color: string;
  device_id: string;
  is_owner: boolean;
  joined_at: string;
}

export interface Currency {
  id: string;
  trip_id: string;
  code: string;
  rate_to_base: number; // amount_in_base = amount * rate_to_base
  label: string | null;
}

export type ItineraryCategory =
  | "food"
  | "sight"
  | "transport"
  | "lodging"
  | "activity"
  | "flight"
  | "other";

export interface ItineraryItem {
  id: string;
  trip_id: string;
  day_number: number;
  start_time: string | null; // "HH:MM:SS" or "HH:MM"
  end_time: string | null;
  title: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  category: ItineraryCategory;
  notes: string | null;
  color: string | null;
  order_in_day: number;
  document_id: string | null;
  flight_number: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
}

export type ExpenseCategory = "lodging" | "food" | "transport" | "activities" | "other";
export type SplitMode = "equal" | "custom" | "percentage" | "itemized";

export interface Expense {
  id: string;
  trip_id: string;
  title: string;
  amount_original: number;
  currency: string;
  amount_in_base: number;
  date: string;
  category: ExpenseCategory;
  paid_by_traveler_id: string;
  split_mode: SplitMode;
  receipt_photo_path: string | null;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  traveler_id: string;
  share_amount_in_base: number;
}

export type TaskCategory =
  | "pre-trip"
  | "booking"
  | "packing"
  | "on-trip"
  | "post-trip"
  | "general";

export interface Task {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  category: TaskCategory;
  is_done: boolean;
  created_by_traveler_id: string | null;
  source: "manual" | "auto-generated";
  created_at: string;
}

export interface TaskAssignee {
  task_id: string;
  traveler_id: string;
}

export type DocumentCategory =
  | "identity"
  | "visas"
  | "flights"
  | "accommodation"
  | "transport"
  | "activities"
  | "insurance"
  | "other";

export interface TravelDocument {
  id: string;
  trip_id: string;
  filename: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  category: DocumentCategory;
  is_shared: boolean;
  uploader_traveler_id: string;
  uploaded_at: string;
}

export interface DismissedReminder {
  traveler_id: string;
  reminder_template_key: string;
  dismissed_at: string;
}

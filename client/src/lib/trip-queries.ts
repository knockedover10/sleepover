import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type {
  ItineraryItem,
  Expense,
  ExpenseSplit,
  Task,
  TaskAssignee,
  TravelDocument,
  Currency,
} from "./types";

export function useItinerary(tripId: string | null) {
  return useQuery<ItineraryItem[]>({
    queryKey: ["itinerary", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number")
        .order("order_in_day")
        .order("start_time");
      if (error) throw error;
      return (data || []) as ItineraryItem[];
    },
  });
}

export function useExpenses(tripId: string | null) {
  return useQuery<Expense[]>({
    queryKey: ["expenses", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as Expense[];
    },
  });
}

export function useExpenseSplits(tripId: string | null, expenseIds: string[]) {
  return useQuery<ExpenseSplit[]>({
    queryKey: ["expense-splits", tripId, expenseIds.sort().join(",")],
    enabled: !!tripId && expenseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_splits")
        .select("*")
        .in("expense_id", expenseIds);
      if (error) throw error;
      return (data || []) as ExpenseSplit[];
    },
  });
}

export function useTasks(tripId: string | null) {
  return useQuery<Task[]>({
    queryKey: ["tasks", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("trip_id", tripId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as Task[];
    },
  });
}

export function useTaskAssignees(tripId: string | null, taskIds: string[]) {
  return useQuery<TaskAssignee[]>({
    queryKey: ["task-assignees", tripId, taskIds.sort().join(",")],
    enabled: !!tripId && taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_assignees")
        .select("*")
        .in("task_id", taskIds);
      if (error) throw error;
      return (data || []) as TaskAssignee[];
    },
  });
}

export function useDocuments(tripId: string | null) {
  return useQuery<TravelDocument[]>({
    queryKey: ["documents", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("trip_id", tripId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TravelDocument[];
    },
  });
}

export function useCurrencies(tripId: string | null) {
  return useQuery<Currency[]>({
    queryKey: ["currencies", tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .eq("trip_id", tripId);
      if (error) throw error;
      return (data || []) as Currency[];
    },
  });
}

// ── Mutations ────────────────────────────────────────────────────────────

export function useInvalidateTrip(tripId: string | null) {
  const qc = useQueryClient();
  return () => {
    if (!tripId) return;
    qc.invalidateQueries({ queryKey: ["itinerary", tripId] });
    qc.invalidateQueries({ queryKey: ["expenses", tripId] });
    qc.invalidateQueries({ queryKey: ["expense-splits", tripId] });
    qc.invalidateQueries({ queryKey: ["tasks", tripId] });
    qc.invalidateQueries({ queryKey: ["task-assignees", tripId] });
    qc.invalidateQueries({ queryKey: ["documents", tripId] });
    qc.invalidateQueries({ queryKey: ["currencies", tripId] });
    qc.invalidateQueries({ queryKey: ["trip-by-token"] });
  };
}

export function useCreateExpense(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      amount_original: number;
      currency: string;
      amount_in_base: number;
      date: string;
      category: Expense["category"];
      paid_by_traveler_id: string;
      split_mode: Expense["split_mode"];
      receipt_photo_path?: string | null;
      splits: { traveler_id: string; share_amount_in_base: number }[];
    }) => {
      if (!tripId) throw new Error("no trip");
      const { data: ex, error } = await supabase
        .from("expenses")
        .insert({
          trip_id: tripId,
          title: input.title,
          amount_original: input.amount_original,
          currency: input.currency,
          amount_in_base: input.amount_in_base,
          date: input.date,
          category: input.category,
          paid_by_traveler_id: input.paid_by_traveler_id,
          split_mode: input.split_mode,
          receipt_photo_path: input.receipt_photo_path ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const splitsRows = input.splits.map((s) => ({
        expense_id: ex.id,
        traveler_id: s.traveler_id,
        share_amount_in_base: s.share_amount_in_base,
      }));
      if (splitsRows.length) {
        const { error: sErr } = await supabase.from("expense_splits").insert(splitsRows);
        if (sErr) throw sErr;
      }
      return ex.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", tripId] });
      qc.invalidateQueries({ queryKey: ["expense-splits", tripId] });
    },
  });
}

export function useDeleteExpense(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", tripId] });
      qc.invalidateQueries({ queryKey: ["expense-splits", tripId] });
    },
  });
}

export function useUpsertItineraryItem(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ItineraryItem> & { id?: string }) => {
      if (!tripId) throw new Error("no trip");
      const payload: any = { ...input, trip_id: tripId };
      if (input.id) {
        const { data, error } = await supabase
          .from("itinerary_items")
          .update(payload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        delete payload.id;
        const { data, error } = await supabase
          .from("itinerary_items")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
}

export function useDeleteItineraryItem(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("itinerary_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["itinerary", tripId] }),
  });
}

export function useUpsertTask(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      description?: string | null;
      due_date?: string | null;
      due_time?: string | null;
      category: Task["category"];
      is_done?: boolean;
      created_by_traveler_id?: string | null;
      source?: Task["source"];
      assignees: string[];
    }) => {
      if (!tripId) throw new Error("no trip");
      const { assignees, ...rest } = input;
      let taskId = input.id;
      if (taskId) {
        const { error } = await supabase.from("tasks").update({ ...rest, trip_id: tripId }).eq("id", taskId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ ...rest, trip_id: tripId, source: rest.source || "manual" })
          .select()
          .single();
        if (error) throw error;
        taskId = data.id as string;
      }
      // Replace assignees
      await supabase.from("task_assignees").delete().eq("task_id", taskId);
      if (assignees.length) {
        const rows = assignees.map((tid) => ({ task_id: taskId!, traveler_id: tid }));
        const { error: aErr } = await supabase.from("task_assignees").insert(rows);
        if (aErr) throw aErr;
      }
      return taskId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", tripId] });
      qc.invalidateQueries({ queryKey: ["task-assignees", tripId] });
    },
  });
}

export function useToggleTask(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ is_done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", tripId] }),
  });
}

export function useDeleteTask(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", tripId] }),
  });
}

export function useUpsertCurrency(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { id?: string; code: string; rate_to_base: number; label?: string | null }) => {
      if (!tripId) throw new Error("no trip");
      if (c.id) {
        const { error } = await supabase
          .from("currencies")
          .update({ rate_to_base: c.rate_to_base, label: c.label || null })
          .eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("currencies")
          .insert({ trip_id: tripId, code: c.code, rate_to_base: c.rate_to_base, label: c.label || null });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currencies", tripId] }),
  });
}

export function useDeleteCurrency(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("currencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currencies", tripId] }),
  });
}

export function useUpdateTrip(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!tripId) throw new Error("no trip");
      const { error } = await supabase.from("trips").update(patch).eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip-by-token"] }),
  });
}

export function useDeleteDocument(tripId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file_path }: { id: string; file_path: string }) => {
      await supabase.storage.from("documents").remove([file_path]);
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", tripId] }),
  });
}

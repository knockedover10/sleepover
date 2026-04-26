import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { ensureDeviceId } from "./device";
import type { Trip, Traveler } from "./types";

interface TripContextValue {
  trip: Trip | null;
  travelers: Traveler[];
  me: Traveler | null;
  inviteToken: string | null;
  deviceId: string | null;
  isLoading: boolean;
  isJoinPrompt: boolean; // true when device hasn't joined this trip yet
  refetch: () => void;
}

const TripContext = createContext<TripContextValue>({
  trip: null,
  travelers: [],
  me: null,
  inviteToken: null,
  deviceId: null,
  isLoading: true,
  isJoinPrompt: false,
  refetch: () => {},
});

export function useTripCtx() {
  return useContext(TripContext);
}

export function TripProvider({
  inviteToken,
  children,
}: {
  inviteToken: string | null;
  children: ReactNode;
}) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    ensureDeviceId().then(setDeviceId);
  }, []);

  // Look up trip + travelers by invite token via security-definer RPCs.
  const tripQ = useQuery<{ trip: Trip; travelers: Traveler[] } | null>({
    queryKey: ["trip-by-token", inviteToken, deviceId],
    enabled: !!inviteToken && !!deviceId,
    queryFn: async () => {
      if (!inviteToken) return null;
      const { data: tripRows, error: tripErr } = await supabase.rpc("trip_by_token", {
        p_token: inviteToken,
      });
      if (tripErr) throw tripErr;
      const tripRow = (tripRows as Trip[] | null)?.[0];
      if (!tripRow) return null;
      const { data: trav, error: tErr } = await supabase.rpc("travelers_by_token", {
        p_token: inviteToken,
      });
      if (tErr) throw tErr;
      return { trip: tripRow, travelers: (trav || []) as Traveler[] };
    },
  });

  const trip = tripQ.data?.trip || null;
  const travelers = tripQ.data?.travelers || [];
  const me = useMemo(
    () => (deviceId ? travelers.find((t) => t.device_id === deviceId) || null : null),
    [travelers, deviceId]
  );

  // RLS depends on device_id being a *known* traveler. If me is null but trip exists,
  // we can still see the trip row (it was returned via PostgREST because anyone with
  // the token URL can SELECT a trip via... wait — RLS blocks select unless device_id matches).
  // To make join flow work, we expose a public RPC-style fallback: try without device,
  // and if it fails, surface "join prompt" state. Approach below: if tripQ returned null
  // but inviteToken set, try a token-only lookup via RPC alternative — but since we don't
  // have one, we instead use a postgres function (not present). Simpler: the server lacks
  // any public-read endpoint. We work around this by allowing the join flow to insert a
  // traveler row first (RLS for travelers_insert with check (true)), and then the trip
  // becomes selectable. But to do that we need the trip ID without selecting it.
  //
  // Pragmatic solution: have a public_trip_lookup RPC included in the migration —
  // we DON'T have that. Instead: ensure the migration includes 'trips_select_anon' policy
  // by token. The provided migration uses RLS that blocks selecting trips unless the device
  // is already a traveler. To unblock join-by-token, we expose a security-definer RPC in a
  // patch SQL file (`supabase/patch.sql`) and document it. For now, isJoinPrompt is true
  // when invite token is set AND we got null back.

  // join prompt = trip resolved but my device not yet a traveler
  const isJoinPrompt = !!trip && !!deviceId && !me;

  // Real-time: when current trip changes, subscribe to all relevant tables.
  useEffect(() => {
    if (!trip) return;
    const ch = supabase
      .channel(`trip:${trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `id=eq.${trip.id}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["trip-by-token"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "travelers", filter: `trip_id=eq.${trip.id}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["trip-by-token"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "itinerary_items", filter: `trip_id=eq.${trip.id}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["itinerary", trip.id] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `trip_id=eq.${trip.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["expenses", trip.id] });
        queryClient.invalidateQueries({ queryKey: ["expense-splits", trip.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_splits" }, () =>
        queryClient.invalidateQueries({ queryKey: ["expense-splits", trip.id] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `trip_id=eq.${trip.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks", trip.id] });
        queryClient.invalidateQueries({ queryKey: ["task-assignees", trip.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, () =>
        queryClient.invalidateQueries({ queryKey: ["task-assignees", trip.id] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `trip_id=eq.${trip.id}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["documents", trip.id] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "currencies", filter: `trip_id=eq.${trip.id}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["currencies", trip.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [trip, queryClient]);

  const value: TripContextValue = {
    trip,
    travelers,
    me,
    inviteToken,
    deviceId,
    isLoading: tripQ.isLoading || !deviceId,
    isJoinPrompt,
    refetch: () => tripQ.refetch(),
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

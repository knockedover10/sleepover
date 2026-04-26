import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ensureDeviceId } from "@/lib/device";
import { seedTokyoTrip } from "@/lib/seed";
import type { Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Plus, ArrowRight, Sparkles, Plane, Loader2, MoonStar, Luggage } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    ensureDeviceId().then(setDeviceId);
  }, []);

  const tripsQ = useQuery<Trip[]>({
    queryKey: ["trips-for-device", deviceId],
    enabled: !!deviceId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("trips_for_device", {
        p_device_id: deviceId,
      });
      if (error) throw error;
      return (data || []) as Trip[];
    },
  });

  // Auto-seed Tokyo demo on first visit if device has zero trips
  useEffect(() => {
    if (!deviceId || tripsQ.isLoading || seeding) return;
    if (tripsQ.data && tripsQ.data.length === 0) {
      setSeeding(true);
      seedTokyoTrip(deviceId)
        .then((res) => {
          tripsQ.refetch();
          navigate(`/t/${res.invite_token}`);
        })
        .catch((e) => {
          toast({
            title: "Demo seed failed",
            description:
              e?.message ||
              "Run the migration in Supabase SQL Editor first (supabase/migration.sql).",
            variant: "destructive",
          });
        })
        .finally(() => setSeeding(false));
    }
  }, [deviceId, tripsQ.data, tripsQ.isLoading]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#dbe9e9] via-background to-background pb-20">
      <div className="mx-auto max-w-md px-5 pt-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Logo className="h-8 w-8 text-primary" />
            <span className="text-lg font-bold tracking-tight">Sleepover</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Plan trips together.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Collaborative itineraries, expenses, tasks, and documents — all in one place.
            No accounts. Share by link.
          </p>
        </div>

        {/* Trips list */}
        {tripsQ.isLoading || seeding ? (
          <div className="grid h-40 place-items-center rounded-2xl border bg-card text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">
                {seeding ? "Setting up demo trip..." : "Loading..."}
              </span>
            </div>
          </div>
        ) : tripsQ.data && tripsQ.data.length > 0 ? (
          <div className="space-y-2" data-testid="trips-list">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your trips
            </h2>
            {tripsQ.data.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/t/${t.invite_token}`)}
                className="ios-tap flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left hover-elevate"
                data-testid={`trip-${t.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{t.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.destination || "—"}
                    {t.start_date ? (
                      <>
                        {" · "}
                        {new Date(t.start_date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {t.end_date &&
                          " — " +
                            new Date(t.end_date + "T00:00:00").toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                      </>
                    ) : null}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No trips yet. Create one or join via link below.
          </div>
        )}

        {/* CTAs */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="ios-tap flex flex-col items-start gap-2 rounded-2xl border bg-primary p-4 text-left text-primary-foreground hover-elevate"
            data-testid="button-create-trip"
          >
            <Plus className="h-5 w-5" />
            <span className="text-sm font-semibold">Create new trip</span>
            <span className="text-[11px] opacity-90">Start from scratch</span>
          </button>
          <button
            onClick={() => setJoinOpen(true)}
            className="ios-tap flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-left hover-elevate"
            data-testid="button-join-trip"
          >
            <Plane className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Join via link</span>
            <span className="text-[11px] text-muted-foreground">Paste an invite link</span>
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Built for groups. Works offline. PWA-ready.
        </p>
      </div>

      {createOpen && deviceId && (
        <CreateTripSheet deviceId={deviceId} onClose={() => setCreateOpen(false)} />
      )}
      {joinOpen && <JoinTripSheet onClose={() => setJoinOpen(false)} />}
    </div>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-label="Sleepover">
      <path
        d="M22 6a8 8 0 1 0 4 4 6 6 0 0 1-4-4Z"
        fill="currentColor"
        opacity="0.9"
      />
      <rect
        x="4"
        y="18"
        width="20"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M11 18v-2a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CreateTripSheet({
  deviceId,
  onClose,
}: {
  deviceId: string;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [dest, setDest] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("SGD");
  const [budget, setBudget] = useState("");
  const [travelerName, setTravelerName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Trip name required", variant: "destructive" });
      return;
    }
    if (!travelerName.trim()) {
      toast({ title: "Your name required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const token = `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase.rpc("create_trip", {
        p_name: name.trim(),
        p_destination: dest.trim() || null,
        p_start_date: start || null,
        p_end_date: end || null,
        p_base_currency: currency,
        p_budget_total: budget ? Number(budget) : null,
        p_notes: null,
        p_invite_token: token,
        p_home_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        p_destination_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        p_traveler_name: travelerName.trim(),
        p_traveler_color: "#2c7273",
        p_device_id: deviceId,
      });
      if (error) throw error;
      const row: any = (data as any[])[0];
      // base currency row
      await supabase
        .from("currencies")
        .insert({ trip_id: row.trip_id, code: currency, rate_to_base: 1, label: currency });
      // pre-trip checklist if start provided
      if (start) {
        const { insertPretripChecklist } = await import("@/lib/seed");
        await insertPretripChecklist(row.trip_id, start, row.traveler_id);
      }
      navigate(`/t/${token}`);
      onClose();
    } catch (e: any) {
      toast({
        title: "Could not create trip",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-0 max-w-md mx-auto max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle>New trip</SheetTitle>
          <SheetDescription>Set up your trip. You can edit anything later.</SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cname">Trip name</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tokyo Spring 2026"
              data-testid="input-create-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdest">Destination</Label>
            <Input
              id="cdest"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="Tokyo, Japan"
              data-testid="input-create-destination"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cstart">Start</Label>
              <Input
                id="cstart"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                data-testid="input-create-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cend">End</Label>
              <Input
                id="cend"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                data-testid="input-create-end"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ccur">Base currency</Label>
              <Input
                id="ccur"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                data-testid="input-create-currency"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cbud">Budget</Label>
              <Input
                id="cbud"
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Optional"
                data-testid="input-create-budget"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctrav">Your name</Label>
            <Input
              id="ctrav"
              value={travelerName}
              onChange={(e) => setTravelerName(e.target.value)}
              placeholder="What should we call you?"
              data-testid="input-create-traveler"
            />
          </div>
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={busy}
            data-testid="button-submit-create"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create trip"
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function JoinTripSheet({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [link, setLink] = useState("");

  const go = () => {
    let token = link.trim();
    if (!token) return;
    // Extract token from full URL
    const match = token.match(/\/t\/([^\/?#]+)/);
    if (match) token = match[1];
    navigate(`/t/${token}`);
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-0 max-w-md mx-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Join a trip</SheetTitle>
          <SheetDescription>
            Paste the link a friend sent you, or just the token.
          </SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="link">Invite link</Label>
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… or sleepy-tokyo-1234"
              data-testid="input-join-link"
            />
          </div>
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={!link.trim()}
            data-testid="button-submit-join"
          >
            Continue
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30);
}

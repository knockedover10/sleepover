import { useState } from "react";
import { useLocation } from "wouter";
import { useTripData } from "@/lib/trip-data";
import {
  useUpdateTrip,
  useUpsertCurrency,
  useDeleteCurrency,
} from "@/lib/trip-queries";
import { supabase } from "@/lib/supabase";
import { seedTokyoTrip } from "@/lib/seed";
import { ensureDeviceId } from "@/lib/device";
import { PageContainer, Avatar } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Copy,
  Check,
  Trash2,
  LogOut,
  RefreshCw,
  Plus,
  Pencil,
  Calendar,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { trip, travelers, currencies, me, meRaw, itinerary } = useTripData();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const updateTrip = useUpdateTrip(trip?.id || null);
  const [copied, setCopied] = useState(false);
  const [editTrip, setEditTrip] = useState(false);
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [editCurrencyId, setEditCurrencyId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!trip) {
    return (
      <PageContainer>
        <p className="text-muted-foreground">Loading…</p>
      </PageContainer>
    );
  }

  const copyShare = () => {
    navigator.clipboard.writeText(trip.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const exportIcs = () => {
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sleepover//Trip//EN",
      "CALSCALE:GREGORIAN",
    ];
    for (const item of itinerary) {
      const dt = item.date.replace(/-/g, "");
      const t = (item.time || "00:00").replace(":", "") + "00";
      const endT = (item.endTime || addHour(item.time)).replace(":", "") + "00";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${item.id}@sleepover`,
        `DTSTART:${dt}T${t}`,
        `DTEND:${dt}T${endT}`,
        `SUMMARY:${escapeIcs(item.title)}`,
        item.location ? `LOCATION:${escapeIcs(item.location)}` : "",
        item.notes ? `DESCRIPTION:${escapeIcs(item.notes)}` : "",
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.filter(Boolean).join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trip.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const leaveTrip = async () => {
    if (!me) return;
    if (!confirm("Remove yourself from this trip? You can rejoin via the invite link.")) return;
    setBusy("leave");
    try {
      const { error } = await supabase.from("travelers").delete().eq("id", me.id);
      if (error) throw error;
      navigate("/");
    } catch (e: any) {
      toast({ title: "Could not leave", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const deleteTrip = async () => {
    if (!meRaw?.is_owner || !trip) return;
    if (!confirm(`Delete "${trip.name}" entirely? This cannot be undone.`)) return;
    setBusy("delete");
    try {
      const { error } = await supabase.from("trips").delete().eq("id", trip.id);
      if (error) throw error;
      navigate("/");
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const resetDemo = async () => {
    if (!confirm("Reset the demo trip? Creates a fresh Tokyo Spring 2026 trip.")) return;
    setBusy("reset");
    try {
      const did = await ensureDeviceId();
      const res = await seedTokyoTrip(did);
      navigate(`/t/${res.invite_token}`);
    } catch (e: any) {
      toast({
        title: "Reset failed",
        description: e?.message || "Run the migration first.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const isOwner = !!meRaw?.is_owner;

  return (
    <PageContainer>
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">{trip.name}</p>
      </div>

      <section className="space-y-2">
        <h2 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Share
        </h2>
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-3">
          <p
            className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
            data-testid="text-share-url"
          >
            {trip.shareUrl}
          </p>
          <Button
            size="sm"
            variant={copied ? "secondary" : "default"}
            className="rounded-full"
            onClick={copyShare}
            data-testid="button-copy-share"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </>
            )}
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trip details
        </h2>
        <div className="rounded-2xl border bg-card p-3">
          <button
            onClick={() => setEditTrip(true)}
            className="ios-tap flex w-full items-center justify-between text-left"
            data-testid="button-edit-trip"
          >
            <div>
              <p className="font-semibold">{trip.name}</p>
              <p className="text-xs text-muted-foreground">
                {trip.destination || "—"} · {trip.startDate || "?"} → {trip.endDate || "?"}
              </p>
            </div>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <button
          onClick={exportIcs}
          className="ios-tap flex w-full items-center gap-2 rounded-2xl border bg-card p-3 text-left hover-elevate"
          data-testid="button-export-ics"
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Export itinerary as .ics</span>
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="mt-4 mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Travelers</span>
          <span className="text-[10px] normal-case font-normal">{travelers.length}</span>
        </h2>
        <div className="space-y-1.5">
          {travelers.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-2xl border bg-card p-3"
              data-testid={`traveler-${t.id}`}
            >
              <Avatar {...t} size={32} ring />
              <div className="flex-1">
                <p className="text-sm font-semibold">{t.name}</p>
                {t.isMe && (
                  <p className="text-[11px] text-muted-foreground">You</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="mt-4 mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Currencies</span>
          <button
            onClick={() => setAddCurrencyOpen(true)}
            className="ios-tap flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
            data-testid="button-add-currency"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </h2>
        <div className="space-y-1.5">
          {currencies.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-2xl border bg-card p-3"
              data-testid={`currency-${c.code}`}
            >
              <div>
                <p className="text-sm font-semibold">
                  {c.code}
                  {c.isBase && (
                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      base
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  1 {c.code} = {c.rateToSGD.toFixed(c.rateToSGD < 0.1 ? 4 : 2)} {trip.baseCurrency}
                </p>
              </div>
              {!c.isBase && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditCurrencyId(c.id)}
                    aria-label="Edit currency"
                    className="ios-tap grid h-7 w-7 place-items-center rounded-full hover-elevate"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Demo
        </h2>
        <button
          onClick={resetDemo}
          disabled={busy === "reset"}
          className="ios-tap flex w-full items-center gap-2 rounded-2xl border bg-card p-3 text-left hover-elevate"
          data-testid="button-reset-demo"
        >
          {busy === "reset" ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">Reset demo trip (creates fresh Tokyo trip)</span>
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Danger zone
        </h2>
        <button
          onClick={leaveTrip}
          disabled={busy === "leave"}
          className="ios-tap flex w-full items-center gap-2 rounded-2xl border bg-card p-3 text-left hover-elevate"
          data-testid="button-leave-trip"
        >
          <LogOut className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Leave this trip
          </span>
        </button>
        {isOwner && (
          <button
            onClick={deleteTrip}
            disabled={busy === "delete"}
            className="ios-tap flex w-full items-center gap-2 rounded-2xl border bg-card p-3 text-left hover-elevate"
            data-testid="button-delete-trip"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              Delete trip permanently
            </span>
          </button>
        )}
      </section>

      {editTrip && trip && (
        <EditTripSheet
          tripView={trip}
          onClose={() => setEditTrip(false)}
        />
      )}
      {addCurrencyOpen && (
        <CurrencySheet onClose={() => setAddCurrencyOpen(false)} />
      )}
      {editCurrencyId && (
        <CurrencySheet
          editId={editCurrencyId}
          onClose={() => setEditCurrencyId(null)}
        />
      )}
    </PageContainer>
  );
}

function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function addHour(time: string): string {
  if (!time) return "01:00";
  const [h, m] = time.split(":").map(Number);
  const nh = (h + 1) % 24;
  return `${String(nh).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
}

function EditTripSheet({
  tripView,
  onClose,
}: {
  tripView: ReturnType<typeof useTripData>["trip"];
  onClose: () => void;
}) {
  const { trip } = useTripData();
  const updateTrip = useUpdateTrip(trip?.id || null);
  const { toast } = useToast();
  const [name, setName] = useState(tripView?.name || "");
  const [dest, setDest] = useState(tripView?.destination || "");
  const [start, setStart] = useState(tripView?.startDate || "");
  const [end, setEnd] = useState(tripView?.endDate || "");
  const [budget, setBudget] = useState(String(tripView?.budget || ""));
  const [notes, setNotes] = useState(tripView?.notes || "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await updateTrip.mutateAsync({
        name: name.trim() || tripView?.name,
        destination: dest.trim() || null,
        start_date: start || null,
        end_date: end || null,
        budget_total: budget ? Number(budget) : null,
        notes: notes.trim() || null,
      });
      toast({ title: "Trip updated" });
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-0 max-w-md mx-auto max-h-[88vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Edit trip</SheetTitle>
          <SheetDescription>Update trip name, dates, and budget.</SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ename">Name</Label>
            <Input id="ename" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edest">Destination</Label>
            <Input id="edest" value={dest} onChange={(e) => setDest(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="estart">Start</Label>
              <Input
                id="estart"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eend">End</Label>
              <Input id="eend" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ebud">Budget ({tripView?.baseCurrency})</Label>
            <Input
              id="ebud"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enotes">Notes</Label>
            <Textarea
              id="enotes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function CurrencySheet({
  editId,
  onClose,
}: {
  editId?: string;
  onClose: () => void;
}) {
  const { currencies, trip } = useTripData();
  const upsert = useUpsertCurrency(trip?.id || null);
  const del = useDeleteCurrency(trip?.id || null);
  const { toast } = useToast();
  const existing = currencies.find((c) => c.id === editId);
  const [code, setCode] = useState(existing?.code || "");
  const [rate, setRate] = useState(String(existing?.rateToSGD || ""));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await upsert.mutateAsync({
        id: editId,
        code: code.trim().toUpperCase(),
        rate_to_base: Number(rate) || 1,
        label: code.trim().toUpperCase(),
      });
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editId) return;
    if (!confirm(`Remove ${existing?.code}?`)) return;
    await del.mutateAsync(editId);
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-0 max-w-md mx-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{editId ? "Edit currency" : "Add currency"}</SheetTitle>
          <SheetDescription>
            Rate is "amount in {trip?.baseCurrency} per 1 of this currency".
          </SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ccode">Code</Label>
            <Input
              id="ccode"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="JPY"
              disabled={!!editId}
              data-testid="input-currency-code"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="crate">Rate to {trip?.baseCurrency}</Label>
            <Input
              id="crate"
              type="number"
              step="any"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.0091"
              data-testid="input-currency-rate"
            />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
          {editId && (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full text-red-600"
              onClick={remove}
            >
              Delete
            </Button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}

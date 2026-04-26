import { useEffect, useState } from "react";
import { useTripData, dayDateLabel, type ItineraryItem, VIEW_TO_DB } from "@/lib/trip-data";
import { useUpsertItineraryItem, useDeleteItineraryItem } from "@/lib/trip-queries";
import { useTripCtx } from "@/lib/trip-context";
import { geocode, type GeocodeResult } from "@/lib/external";
import { PageContainer } from "@/components/AppShell";
import { Plus, MapPin, Clock, Utensils, Camera, Bus, Bed, Sparkles, ShoppingBag, Trash2, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const catIcon: Record<ItineraryItem["category"], React.ReactNode> = {
  Food: <Utensils className="h-3.5 w-3.5" />,
  Sightseeing: <Camera className="h-3.5 w-3.5" />,
  Transit: <Bus className="h-3.5 w-3.5" />,
  Stay: <Bed className="h-3.5 w-3.5" />,
  Activity: <Sparkles className="h-3.5 w-3.5" />,
  Shopping: <ShoppingBag className="h-3.5 w-3.5" />,
};

const CATEGORIES: ItineraryItem["category"][] = ["Food", "Sightseeing", "Transit", "Stay", "Activity", "Shopping"];

function ItemDetail({
  item,
  startDate,
  onClose,
  onDelete,
  onEdit,
}: {
  item: ItineraryItem;
  startDate: string;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>{item.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Day {item.day} · {dayDateLabel(startDate, item.day)} · {item.time}{item.endTime ? ` – ${item.endTime}` : ""}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{item.location || "—"}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {catIcon[item.category]} {item.category}
          </div>
          {item.notes && (
            <div className="rounded-2xl bg-muted/60 p-3 text-sm">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
              {item.notes}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={onEdit} variant="secondary" className="flex-1 rounded-full">Edit</Button>
            <Button onClick={onDelete} variant="destructive" className="rounded-full" data-testid="button-delete-item">
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemForm({
  initial,
  numDays,
  onClose,
}: {
  initial?: ItineraryItem;
  numDays: number;
  onClose: () => void;
}) {
  const { trip } = useTripCtx();
  const upsert = useUpsertItineraryItem(trip?.id || null);

  const [title, setTitle] = useState(initial?.title || "");
  const [day, setDay] = useState<number>(initial?.day || 1);
  const [time, setTime] = useState(initial?.time || "12:00");
  const [endTime, setEndTime] = useState(initial?.endTime || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [lat, setLat] = useState<number | null>(initial?.lat || null);
  const [lng, setLng] = useState<number | null>(initial?.lng || null);
  const [category, setCategory] = useState<ItineraryItem["category"]>(initial?.category || "Sightseeing");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [flightNumber, setFlightNumber] = useState(initial?._raw.flight_number || "");
  const [checkIn, setCheckIn] = useState(initial?._raw.check_in_time?.slice(0, 5) || "");
  const [checkOut, setCheckOut] = useState(initial?._raw.check_out_time?.slice(0, 5) || "");

  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  // debounced search
  useEffect(() => {
    if (!location || location.length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      try { setSearching(true); setResults(await geocode(location, 5)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [location]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    await upsert.mutateAsync({
      id: initial?.id,
      day_number: day,
      start_time: time,
      end_time: endTime || null,
      title,
      location_name: location || null,
      latitude: lat,
      longitude: lng,
      category: VIEW_TO_DB[category],
      notes: notes || null,
      flight_number: category === "Transit" && flightNumber ? flightNumber : null,
      check_in_time: category === "Stay" && checkIn ? checkIn : null,
      check_out_time: category === "Stay" && checkOut ? checkOut : null,
    });
    onClose();
  };

  return (
    <form className="mt-4 space-y-3 pb-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="ititle">Title</Label>
        <Input id="ititle" value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="input-item-title" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="iday">Day</Label>
          <Input id="iday" type="number" min={1} max={numDays} value={day} onChange={(e) => setDay(parseInt(e.target.value || "1"))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="itime">Time</Label>
          <Input id="itime" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="iendtime">End</Label>
          <Input id="iendtime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                category === c ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="iloc">Location</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input id="iloc" value={location} onChange={(e) => setLocation(e.target.value)} className="pl-9" placeholder="Search a place…" />
        </div>
        {searching && <p className="text-[11px] text-muted-foreground">Searching…</p>}
        {results.length > 0 && (
          <ul className="max-h-40 overflow-y-auto rounded-xl border bg-card text-xs">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => { setLocation(r.display_name.split(",").slice(0, 2).join(",")); setLat(r.lat); setLng(r.lng); setResults([]); }}
                  className="w-full px-3 py-2 text-left hover-elevate"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {lat !== null && lng !== null && (
          <p className="text-[11px] text-muted-foreground">📍 {lat.toFixed(4)}, {lng.toFixed(4)}</p>
        )}
      </div>
      {category === "Transit" && (
        <div className="space-y-1.5">
          <Label htmlFor="iflight">Flight number (optional)</Label>
          <Input id="iflight" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="SQ 12" />
        </div>
      )}
      {category === "Stay" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ichecki">Check-in</Label>
            <Input id="ichecki" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="icheckout">Check-out</Label>
            <Input id="icheckout" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="inotes">Notes</Label>
        <Textarea id="inotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button type="submit" className="w-full rounded-full" disabled={upsert.isPending}>
        {upsert.isPending ? "Saving…" : initial ? "Save changes" : "Add to plan"}
      </Button>
    </form>
  );
}

export default function Itinerary() {
  const data = useTripData();
  const { trip } = useTripCtx();
  const del = useDeleteItineraryItem(trip?.id || null);
  const [selected, setSelected] = useState<ItineraryItem | null>(null);
  const [editing, setEditing] = useState<ItineraryItem | null>(null);
  const [adding, setAdding] = useState(false);

  const tv = data.trip;
  if (!tv) return <PageContainer><div className="py-10 text-center text-muted-foreground">Loading…</div></PageContainer>;

  const numDays = tv.numDays || 1;
  const days = Array.from({ length: numDays }, (_, i) => i + 1);
  const items = data.itinerary;

  return (
    <PageContainer>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Itinerary</h1>
          <p className="text-xs text-muted-foreground">{numDays} days · {items.length} items planned</p>
        </div>
      </div>

      <div className="space-y-5">
        {days.map((d) => {
          const dayItems = items.filter((i) => i.day === d);
          if (dayItems.length === 0) return null;
          return (
            <section key={d} data-testid={`day-section-${d}`}>
              <header className="mb-2 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", `day-bg-${((d - 1) % 8) + 1}`)} aria-hidden />
                  <h2 className="text-sm font-bold">Day {d}</h2>
                  <span className="text-xs text-muted-foreground">{dayDateLabel(tv.startDate, d)}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{dayItems.length} items</span>
              </header>
              <ul className="rounded-2xl border bg-card overflow-hidden divide-y">
                {dayItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setSelected(item)}
                      className="ios-tap flex w-full items-center gap-3 px-4 py-3 text-left hover-elevate"
                      data-testid={`item-${item.id}`}
                    >
                      <div className="w-12 shrink-0 font-mono text-xs font-semibold text-muted-foreground">{item.time}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.location}
                          {item.notes ? ` · ${item.notes}` : ""}
                        </p>
                      </div>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                        {catIcon[item.category]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            No items yet. Tap + to add your first plan.
          </div>
        )}
      </div>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetTrigger asChild>
          <button
            className="ios-tap fixed bottom-[72px] right-[max(1rem,calc(50%-13rem))] z-30 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
            aria-label="Add itinerary item"
            data-testid="button-add-item"
          >
            <Plus className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl border-t-0 max-w-md mx-auto max-h-[88vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>New itinerary item</SheetTitle>
            <SheetDescription>Add a stop, meal, or activity to a day.</SheetDescription>
          </SheetHeader>
          {adding && <ItemForm numDays={numDays} onClose={() => setAdding(false)} />}
        </SheetContent>
      </Sheet>

      {selected && !editing && (
        <ItemDetail
          item={selected}
          startDate={tv.startDate}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
          onDelete={async () => { await del.mutateAsync(selected.id); setSelected(null); }}
        />
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t-0 max-w-md mx-auto max-h-[88vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Edit item</SheetTitle>
          </SheetHeader>
          {editing && <ItemForm initial={editing} numDays={numDays} onClose={() => { setEditing(null); setSelected(null); }} />}
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}

import { useMemo, useState } from "react";
import {
  useTripData,
  computeSettlements,
  categoryTotals,
  totalSpent,
  formatMoney,
  formatDateShort,
  getTraveler,
  type Expense as ExpView,
  EXP_VIEW_TO_DB,
  type Traveler as TravelerView,
} from "@/lib/trip-data";
import { useTripCtx } from "@/lib/trip-context";
import { useCreateExpense, useDeleteExpense, useUpsertCurrency, useDeleteCurrency } from "@/lib/trip-queries";
import { supabase } from "@/lib/supabase";
import { PageContainer, Avatar } from "@/components/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ArrowRight, Receipt, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function CategoryBars({ expenses, baseCurrency }: { expenses: ExpView[]; baseCurrency: string }) {
  const totals = categoryTotals(expenses);
  const max = Math.max(...totals.map((t) => t.total)) || 1;
  return (
    <div className="space-y-2.5" data-testid="category-bars">
      {totals.map((t, i) => (
        <div key={t.category}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium">{t.category}</span>
            <span className="font-semibold tabular-nums">{formatMoney(t.total, baseCurrency)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${(t.total / max) * 100}%`, backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpenseList({
  expenses, travelers, baseCurrency, onDelete, meId,
}: {
  expenses: ExpView[]; travelers: TravelerView[]; baseCurrency: string;
  onDelete: (id: string) => void; meId: string | null;
}) {
  if (expenses.length === 0) {
    return <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">No expenses yet. Tap + to add one.</div>;
  }
  return (
    <ul className="space-y-2">
      {expenses.map((e) => {
        const paidBy = getTraveler(travelers, e.paidBy);
        return (
          <li key={e.id} className="ios-tap flex items-center gap-3 rounded-2xl border bg-card p-3 hover-elevate" data-testid={`expense-${e.id}`}>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{e.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {formatDateShort(e.date)} · {e.category} · paid by {paidBy?.name || "?"} · {e.splitMode}-split · {e.sharedWith.length}-ways
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums">{formatMoney(e.amountSGD, baseCurrency)}</p>
              {e.currency !== baseCurrency && <p className="text-[10px] text-muted-foreground tabular-nums">{formatMoney(e.amount, e.currency)}</p>}
            </div>
            {e.paidBy === meId && (
              <button onClick={() => onDelete(e.id)} className="ml-1 rounded-full p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SettleUp({ expenses, travelers, baseCurrency }: { expenses: ExpView[]; travelers: TravelerView[]; baseCurrency: string }) {
  const { settlements } = computeSettlements(expenses, travelers);
  if (settlements.length === 0) {
    return <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Everyone is settled up.</div>;
  }
  return (
    <ul className="space-y-2" data-testid="settle-list">
      {settlements.map((s, idx) => {
        const from = getTraveler(travelers, s.from)!;
        const to = getTraveler(travelers, s.to)!;
        return (
          <li key={idx} className="flex items-center gap-3 rounded-2xl border bg-card p-3" data-testid={`settle-${idx}`}>
            <Avatar {...from} size={32} />
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Avatar {...to} size={32} />
            <div className="ml-1 min-w-0 flex-1">
              <p className="truncate text-sm">
                <span className="font-semibold">{from.name}</span> owes <span className="font-semibold">{to.name}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Combined from group expenses</p>
            </div>
            <p className="text-sm font-bold tabular-nums text-primary">{formatMoney(s.amount, baseCurrency)}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Currencies({ tripBase, currencies, onUpdate, onAdd, onDelete }: {
  tripBase: string;
  currencies: ReturnType<typeof useTripData>["currencies"];
  onUpdate: (id: string, rate: number) => void;
  onAdd: (code: string, perOneBase: number) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [perOne, setPerOne] = useState("");

  return (
    <div className="space-y-2" data-testid="currencies-list">
      {currencies.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{c.code}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{c.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {c.isBase ? "Base currency" : `1 ${tripBase} ≈ ${(1 / c.rateToSGD).toFixed(c.code === "JPY" ? 0 : 4)} ${c.code}`}
            </p>
          </div>
          {!c.isBase && (
            <>
              <div className="flex w-24 items-center gap-1">
                <Input
                  type="number"
                  defaultValue={(1 / c.rateToSGD).toFixed(c.code === "JPY" ? 0 : 4)}
                  onBlur={(e) => {
                    const perOneBase = parseFloat(e.target.value) || 0;
                    if (perOneBase > 0) onUpdate(c.id, 1 / perOneBase);
                  }}
                  className="h-8 text-right text-xs tabular-nums"
                  data-testid={`input-rate-${c.code}`}
                />
              </div>
              <button onClick={() => onDelete(c.id)} className="ml-1 rounded-full p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete currency">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ))}

      {adding ? (
        <div className="rounded-2xl border bg-card p-3 space-y-2">
          <div className="flex gap-2">
            <Input placeholder="Code (e.g. EUR)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="h-9 text-sm" maxLength={5} />
            <Input placeholder={`per 1 ${tripBase}`} type="number" value={perOne} onChange={(e) => setPerOne(e.target.value)} className="h-9 text-sm w-32" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              if (code && parseFloat(perOne) > 0) {
                onAdd(code, parseFloat(perOne));
                setCode(""); setPerOne(""); setAdding(false);
              }
            }} className="flex-1 rounded-full">Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="rounded-full">Cancel</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="ios-tap w-full rounded-2xl border border-dashed bg-card p-3 text-center text-sm font-medium text-muted-foreground hover-elevate">
          + Add currency
        </button>
      )}
    </div>
  );
}

function AddExpenseSheet({
  travelers, currencies, baseCurrency, defaultPaidBy, tripId,
}: {
  travelers: TravelerView[];
  currencies: ReturnType<typeof useTripData>["currencies"];
  baseCurrency: string;
  defaultPaidBy: string | null;
  tripId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const create = useCreateExpense(tripId);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(currencies[0]?.code || baseCurrency);
  const [paidBy, setPaidBy] = useState(defaultPaidBy || (travelers[0]?.id || ""));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpView["category"]>("Food");
  const [mode, setMode] = useState<"equal" | "custom" | "percent" | "itemized">("equal");
  const [equalIds, setEqualIds] = useState<Set<string>>(new Set(travelers.map((t) => t.id)));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>(() => {
    const eq = travelers.length ? (100 / travelers.length).toFixed(2) : "0";
    return Object.fromEntries(travelers.map((t) => [t.id, eq]));
  });
  type LineItem = { id: string; label: string; amount: string; assignees: Set<string> };
  const [items, setItems] = useState<LineItem[]>([{ id: "1", label: "", amount: "", assignees: new Set(travelers.map((t) => t.id)) }]);
  const [receipt, setReceipt] = useState<File | null>(null);

  const fxRate = useMemo(() => {
    if (currency === baseCurrency) return 1;
    return currencies.find((c) => c.code === currency)?.rateToSGD || 1;
  }, [currency, currencies, baseCurrency]);

  const amtBase = (parseFloat(amount) || 0) * fxRate;

  const reset = () => {
    setTitle(""); setAmount(""); setReceipt(null); setMode("equal");
    setEqualIds(new Set(travelers.map((t) => t.id)));
    setCustomAmounts({});
    setItems([{ id: "1", label: "", amount: "", assignees: new Set(travelers.map((t) => t.id)) }]);
  };

  const computeSplits = (): { traveler_id: string; share_amount_in_base: number }[] => {
    if (mode === "equal") {
      const ids = Array.from(equalIds);
      if (ids.length === 0) return [];
      const share = +(amtBase / ids.length).toFixed(2);
      return ids.map((id, i) => ({
        traveler_id: id,
        share_amount_in_base: i === ids.length - 1 ? +(amtBase - share * (ids.length - 1)).toFixed(2) : share,
      }));
    }
    if (mode === "custom") {
      return travelers
        .map((t) => ({ traveler_id: t.id, share_amount_in_base: (parseFloat(customAmounts[t.id] || "0") || 0) * fxRate }))
        .filter((r) => r.share_amount_in_base > 0)
        .map((r) => ({ ...r, share_amount_in_base: +r.share_amount_in_base.toFixed(2) }));
    }
    if (mode === "percent") {
      return travelers
        .map((t) => ({ traveler_id: t.id, share_amount_in_base: +(amtBase * (parseFloat(percentages[t.id] || "0") / 100)).toFixed(2) }))
        .filter((r) => r.share_amount_in_base > 0);
    }
    // itemized: sum each traveler's portion across line items (each item splits among its assignees)
    const totals: Record<string, number> = {};
    for (const li of items) {
      const itAmt = (parseFloat(li.amount) || 0) * fxRate;
      const ass = Array.from(li.assignees);
      if (ass.length === 0) continue;
      const share = itAmt / ass.length;
      for (const id of ass) totals[id] = (totals[id] || 0) + share;
    }
    return Object.entries(totals).map(([traveler_id, v]) => ({ traveler_id, share_amount_in_base: +v.toFixed(2) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId || !paidBy || !title || !amount) return;

    let receiptPath: string | null = null;
    if (receipt) {
      const ext = receipt.name.split(".").pop() || "jpg";
      const path = `${tripId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, receipt, { upsert: false });
      if (!upErr) receiptPath = path;
    }

    const splits = computeSplits();
    await create.mutateAsync({
      title,
      amount_original: parseFloat(amount),
      currency,
      amount_in_base: +amtBase.toFixed(2),
      date,
      category: EXP_VIEW_TO_DB[category],
      paid_by_traveler_id: paidBy,
      split_mode: mode === "percent" ? "percentage" : mode === "itemized" ? "itemized" : mode,
      receipt_photo_path: receiptPath,
      splits,
    });
    reset();
    setOpen(false);
  };

  const percentSum = travelers.reduce((s, t) => s + (parseFloat(percentages[t.id] || "0") || 0), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="ios-tap fixed bottom-[72px] right-[max(1rem,calc(50%-13rem))] z-30 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
          aria-label="Add expense"
          data-testid="button-add-expense"
        >
          <Plus className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-0 max-w-md mx-auto max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Add expense</SheetTitle>
          <SheetDescription>Log a payment and split it with the group.</SheetDescription>
        </SheetHeader>
        <form className="mt-4 space-y-3 pb-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="ex-title">Description</Label>
            <Input id="ex-title" value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="input-expense-title" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="ex-amount">Amount</Label>
              <Input id="ex-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required data-testid="input-expense-amount" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-cur">Currency</Label>
              <select
                id="ex-cur"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {currencies.map((c) => <option key={c.id} value={c.code}>{c.code}</option>)}
                {currencies.length === 0 && <option value={baseCurrency}>{baseCurrency}</option>}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="ex-date">Date</Label>
              <Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-cat">Category</Label>
              <select
                id="ex-cat" value={category} onChange={(e) => setCategory(e.target.value as ExpView["category"])}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option>Food</option><option>Lodging</option><option>Transport</option><option>Activities</option><option>Other</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Paid by</Label>
            <div className="flex flex-wrap gap-1.5">
              {travelers.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setPaidBy(t.id)}
                  className={cn("ios-tap flex flex-col items-center gap-1 rounded-2xl border bg-card p-2 hover-elevate w-[68px]", paidBy === t.id && "border-primary")}
                >
                  <Avatar {...t} size={24} />
                  <span className="text-[11px] font-medium">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ex-receipt">Receipt photo (optional)</Label>
            <Input id="ex-receipt" type="file" accept="image/*" onChange={(e) => setReceipt(e.target.files?.[0] || null)} />
          </div>

          <div className="pt-1">
            <Label className="mb-2 block">Split mode</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="equal" className="text-xs">Equal</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
                <TabsTrigger value="percent" className="text-xs">%</TabsTrigger>
                <TabsTrigger value="itemized" className="text-xs">Items</TabsTrigger>
              </TabsList>

              <TabsContent value="equal" className="mt-3 space-y-2" data-testid="split-equal">
                <p className="text-xs text-muted-foreground">Split evenly between selected travelers.</p>
                <div className="space-y-1.5">
                  {travelers.map((t) => {
                    const checked = equalIds.has(t.id);
                    const pct = checked && equalIds.size > 0 ? Math.round(100 / equalIds.size) : 0;
                    return (
                      <label key={t.id} className="flex items-center justify-between rounded-2xl border bg-card p-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox" checked={checked}
                            onChange={(e) => {
                              setEqualIds((prev) => {
                                const n = new Set(prev);
                                if (e.target.checked) n.add(t.id);
                                else n.delete(t.id);
                                return n;
                              });
                            }}
                            className="accent-primary"
                          />
                          <Avatar {...t} size={22} />
                          <span className="text-sm font-medium">{t.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </label>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="custom" className="mt-3 space-y-1.5" data-testid="split-custom">
                <p className="text-xs text-muted-foreground">Set exact amount per person (in {currency}).</p>
                {travelers.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-2xl border bg-card p-2.5">
                    <Avatar {...t} size={22} />
                    <span className="flex-1 text-sm font-medium">{t.name}</span>
                    <Input type="number" step="0.01" value={customAmounts[t.id] || ""} onChange={(e) => setCustomAmounts((p) => ({ ...p, [t.id]: e.target.value }))} className="h-8 w-24 text-right text-xs" />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="percent" className="mt-3 space-y-1.5" data-testid="split-percent">
                <p className="text-xs text-muted-foreground">
                  Total: <span className={cn(Math.round(percentSum) === 100 ? "text-primary" : "text-destructive", "font-semibold")}>{percentSum.toFixed(0)}%</span>
                </p>
                {travelers.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-2xl border bg-card p-2.5">
                    <Avatar {...t} size={22} />
                    <span className="flex-1 text-sm font-medium">{t.name}</span>
                    <Input type="number" value={percentages[t.id] || ""} onChange={(e) => setPercentages((p) => ({ ...p, [t.id]: e.target.value }))} className="h-8 w-20 text-right text-xs" />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="itemized" className="mt-3 space-y-2" data-testid="split-itemized">
                <p className="text-xs text-muted-foreground">Add line items and assign each to specific travelers.</p>
                <div className="space-y-1.5">
                  {items.map((li, idx) => (
                    <div key={li.id} className="rounded-2xl border bg-card p-2.5">
                      <div className="flex items-center gap-2">
                        <Input value={li.label} onChange={(e) => setItems((all) => all.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} placeholder="Label" className="h-8 flex-1 text-xs" />
                        <Input type="number" step="0.01" value={li.amount} onChange={(e) => setItems((all) => all.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} placeholder={currency} className="h-8 w-20 text-right text-xs" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {travelers.map((t) => {
                          const sel = li.assignees.has(t.id);
                          return (
                            <button
                              key={t.id} type="button"
                              onClick={() => setItems((all) => all.map((x, i) => {
                                if (i !== idx) return x;
                                const n = new Set(x.assignees);
                                if (n.has(t.id)) n.delete(t.id); else n.add(t.id);
                                return { ...x, assignees: n };
                              }))}
                              className={cn("ios-tap rounded-full border px-1.5 py-0.5", sel ? "border-primary bg-primary/10" : "border-border bg-muted opacity-60")}
                            >
                              <Avatar {...t} size={18} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setItems((p) => [...p, { id: String(Date.now()), label: "", amount: "", assignees: new Set(travelers.map((t) => t.id)) }])}
                    className="ios-tap w-full rounded-2xl border border-dashed bg-card p-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    + Add line item
                  </button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {amtBase > 0 && (
            <p className="text-[11px] text-muted-foreground">
              ≈ {formatMoney(amtBase, baseCurrency)} in base currency
            </p>
          )}

          <Button type="submit" className="w-full rounded-full" disabled={create.isPending} data-testid="button-save-expense">
            {create.isPending ? "Saving…" : "Save expense"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default function Budget() {
  const data = useTripData();
  const { trip } = useTripCtx();
  const tripId = trip?.id || null;
  const tv = data.trip;
  const del = useDeleteExpense(tripId);
  const upsertCur = useUpsertCurrency(tripId);
  const delCur = useDeleteCurrency(tripId);

  if (!tv) return <PageContainer><div className="py-10 text-center text-muted-foreground">Loading…</div></PageContainer>;

  const spent = totalSpent(data.expenses);
  const pct = tv.budget > 0 ? (spent / tv.budget) * 100 : 0;

  return (
    <PageContainer>
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight">Budget</h1>
        <p className="text-xs text-muted-foreground">Tracked in {tv.baseCurrency} · auto-converted</p>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spent</p>
          <p className="text-xs text-muted-foreground tabular-nums">of {formatMoney(tv.budget, tv.baseCurrency)}</p>
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(spent, tv.baseCurrency)}</p>
        <Progress value={pct} className="mt-3 h-2" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">{Math.round(pct)}% used · {formatMoney(Math.max(0, tv.budget - spent), tv.baseCurrency)} remaining</p>
        <div className="mt-4 border-t pt-3"><CategoryBars expenses={data.expenses} baseCurrency={tv.baseCurrency} /></div>
      </section>

      <Tabs defaultValue="expenses" className="mt-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expenses" className="text-xs" data-testid="tab-expenses">Expenses</TabsTrigger>
          <TabsTrigger value="settle" className="text-xs" data-testid="tab-settle">Settle Up</TabsTrigger>
          <TabsTrigger value="currencies" className="text-xs" data-testid="tab-currencies">Currencies</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="mt-3">
          <ExpenseList
            expenses={data.expenses}
            travelers={data.travelers}
            baseCurrency={tv.baseCurrency}
            meId={data.me?.id || null}
            onDelete={(id) => del.mutate(id)}
          />
        </TabsContent>
        <TabsContent value="settle" className="mt-3">
          <SettleUp expenses={data.expenses} travelers={data.travelers} baseCurrency={tv.baseCurrency} />
        </TabsContent>
        <TabsContent value="currencies" className="mt-3">
          <Currencies
            tripBase={tv.baseCurrency}
            currencies={data.currencies}
            onUpdate={(id, rate) => upsertCur.mutate({ id, code: "", rate_to_base: rate })}
            onAdd={(code, perOne) => upsertCur.mutate({ code, rate_to_base: 1 / perOne, label: code })}
            onDelete={(id) => delCur.mutate(id)}
          />
        </TabsContent>
      </Tabs>

      <AddExpenseSheet
        travelers={data.travelers}
        currencies={data.currencies}
        baseCurrency={tv.baseCurrency}
        defaultPaidBy={data.me?.id || null}
        tripId={tripId}
      />
    </PageContainer>
  );
}


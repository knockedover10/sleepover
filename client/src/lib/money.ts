import type { Expense, ExpenseSplit, Traveler } from "./types";

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

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysUntil(iso: string | null | undefined, now: Date = new Date()): number {
  if (!iso) return 0;
  const target = new Date(iso + "T00:00:00");
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeSettlements(
  expenses: Expense[],
  splits: ExpenseSplit[],
  travelers: Traveler[]
) {
  const balances: Record<string, number> = {};
  for (const t of travelers) balances[t.id] = 0;
  for (const e of expenses) {
    balances[e.paid_by_traveler_id] = (balances[e.paid_by_traveler_id] || 0) + Number(e.amount_in_base);
  }
  for (const s of splits) {
    balances[s.traveler_id] = (balances[s.traveler_id] || 0) - Number(s.share_amount_in_base);
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
    if (pay > 0.01) {
      settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    }
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return { settlements, balances };
}

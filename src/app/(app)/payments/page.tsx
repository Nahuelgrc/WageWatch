"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addDays, format } from "date-fns";

type Payment = {
  id: number;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
  expectedAmount: string;
  amountPaid: string;
  note: string | null;
};

function toISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = toISO(new Date());
  const [paymentDate, setPaymentDate] = useState(today);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState(today);
  const [amountPaid, setAmountPaid] = useState("");
  const [note, setNote] = useState("");

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      const data = await res.json();
      const list: Payment[] = data.payments ?? [];
      setPayments(list);
      if (list.length > 0) {
        const lastEnd = list[list.length - 1].periodEnd;
        setPeriodStart(toISO(addDays(new Date(`${lastEnd}T00:00:00`), 1)));
      }
    } catch {
      setError("Could not load payments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!periodStart) {
      setError("Enter the period start date");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentDate,
          periodStart,
          periodEnd,
          amountPaid: Number(amountPaid),
          note: note || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save payment");
      }
      setAmountPaid("");
      setNote("");
      await loadPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payment");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setSaving(true);
    try {
      await fetch(`/api/payments?id=${id}`, { method: "DELETE" });
      await loadPayments();
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => {
    const expected = payments.reduce((s, p) => s + Number(p.expectedAmount), 0);
    const paid = payments.reduce((s, p) => s + Number(p.amountPaid), 0);
    return { expected, paid, diff: paid - expected };
  }, [payments]);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Log a received payment</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm text-slate-400">
            Period from
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100 [color-scheme:dark]"
              required
            />
          </label>
          <label className="flex flex-col text-sm text-slate-400">
            Period to
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100 [color-scheme:dark]"
              required
            />
          </label>
          <label className="flex flex-col text-sm text-slate-400">
            Payment date
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100 [color-scheme:dark]"
              required
            />
          </label>
          <label className="flex flex-col text-sm text-slate-400">
            Amount paid ($)
            <input
              type="number"
              min={0}
              step={0.01}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="mt-1 w-32 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100"
              required
            />
          </label>
          <label className="flex flex-col text-sm text-slate-400">
            Note
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100 placeholder:text-slate-500"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Save payment
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Payment history</h2>
          <p className="text-sm text-slate-400">
            Total expected: <span className="font-semibold text-slate-200">${totals.expected.toFixed(2)}</span> ·
            Total paid: <span className="font-semibold text-slate-200">${totals.paid.toFixed(2)}</span> ·{" "}
            {totals.diff < 0 ? (
              <span className="font-semibold text-red-400">
                Shortfall: ${Math.abs(totals.diff).toFixed(2)}
              </span>
            ) : (
              <span className="font-semibold text-green-400">
                Up to date {totals.diff > 0 ? `(+$${totals.diff.toFixed(2)})` : ""}
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Period</th>
                  <th className="py-2 pr-3 font-medium">Payment date</th>
                  <th className="py-2 pr-3 font-medium">Expected</th>
                  <th className="py-2 pr-3 font-medium">Paid</th>
                  <th className="py-2 pr-3 font-medium">Difference</th>
                  <th className="py-2 pr-3 font-medium">Note</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {[...payments].reverse().map((p) => {
                  const diff = Number(p.amountPaid) - Number(p.expectedAmount);
                  return (
                    <tr key={p.id} className="border-b border-slate-800 text-slate-200">
                      <td className="py-2 pr-3">
                        {p.periodStart} → {p.periodEnd}
                      </td>
                      <td className="py-2 pr-3">{p.paymentDate}</td>
                      <td className="py-2 pr-3">${Number(p.expectedAmount).toFixed(2)}</td>
                      <td className="py-2 pr-3">${Number(p.amountPaid).toFixed(2)}</td>
                      <td className={`py-2 pr-3 font-medium ${diff < 0 ? "text-red-400" : "text-green-400"}`}>
                        {diff < 0 ? `-$${Math.abs(diff).toFixed(2)}` : `+$${diff.toFixed(2)}`}
                      </td>
                      <td className="py-2 pr-3 text-slate-400">{p.note}</td>
                      <td className="py-2">
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={saving}
                          className="text-xs text-red-400 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

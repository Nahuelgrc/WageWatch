"use client";

import { useEffect, useState, type FormEvent } from "react";

export default function SettingsPage() {
  const [hourlyRate, setHourlyRate] = useState("");
  const [paydays, setPaydays] = useState<number[]>([]);
  const [newPayday, setNewPayday] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setHourlyRate(data.hourlyRate ?? "0");
        setPaydays(data.paydays ?? []);
      })
      .catch(() => setError("Could not load settings"))
      .finally(() => setLoading(false));
  }, []);

  function addPayday() {
    const n = Number(newPayday);
    if (!Number.isInteger(n) || n < 1 || n > 31) {
      setError("Day must be a whole number between 1 and 31");
      return;
    }
    if (!paydays.includes(n)) {
      setPaydays([...paydays, n].sort((a, b) => a - b));
    }
    setNewPayday("");
    setError(null);
  }

  function removePayday(n: number) {
    setPaydays(paydays.filter((d) => d !== n));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate: Number(hourlyRate), paydays }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading...</p>;

  return (
    <div className="max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-4 text-sm font-semibold text-slate-200">Settings</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col text-sm text-slate-400">
          Hourly rate ($)
          <input
            type="number"
            min={0}
            step={0.01}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100"
            required
          />
        </label>

        <div>
          <span className="text-sm text-slate-400">Company paydays (day of month)</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {paydays.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200"
              >
                Day {d}
                <button
                  type="button"
                  onClick={() => removePayday(d)}
                  className="text-slate-500 hover:text-red-400"
                  aria-label={`Remove day ${d}`}
                >
                  ×
                </button>
              </span>
            ))}
            {paydays.length === 0 && <span className="text-sm text-slate-500">Not set</span>}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              min={1}
              max={31}
              value={newPayday}
              onChange={(e) => setNewPayday(e.target.value)}
              placeholder="e.g. 15"
              className="w-24 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
            />
            <button
              type="button"
              onClick={addPayday}
              className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Save
          </button>
          {saved && <span className="text-sm text-green-400">Saved</span>}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { formatHMS, splitHMS, toSeconds } from "@/lib/time";

type Entry = { id: number; date: string; seconds: number };

function toISO(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function chunkWeeks(days: Date[]) {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export default function DashboardPage() {
  const [monthCursor, setMonthCursor] = useState(() =>
    startOfMonth(new Date()),
  );
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState(0);

  const rangeStart = startOfWeek(startOfMonth(monthCursor), {
    weekStartsOn: 1,
  });
  const rangeEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });

  async function loadEntries() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/hours?from=${toISO(rangeStart)}&to=${toISO(rangeEnd)}`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      setError("Could not load hours");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/month change
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setHourlyRate(Number(data.hourlyRate ?? 0));
      })
      .catch(() => {});
  }, []);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of entries) map.set(e.date, e);
    return map;
  }, [entries]);

  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const weeks = chunkWeeks(days);

  const monthlyTotalSeconds = entries
    .filter((e) => isSameMonth(parseISO(e.date), monthCursor))
    .reduce((sum, e) => sum + e.seconds, 0);

  const monthlyEarned = (monthlyTotalSeconds / 3600) * hourlyRate;

  return (
    <div className="flex flex-col gap-6">
      <section className="relative rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setMonthCursor((m) => addMonths(m, -1))}
            className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
          >
            ← Previous
          </button>
          <div className="text-center">
            <h2 className="text-base font-semibold capitalize text-slate-100">
              {format(monthCursor, "MMMM yyyy")}
            </h2>
            <p className="text-sm text-slate-400">
              Month total:{" "}
              <span className="font-semibold text-slate-100">
                {formatHMS(monthlyTotalSeconds)}
              </span>{" "}
              <span className="font-bold text-green-400">
                ${monthlyEarned.toFixed(2)}
              </span>
            </p>
          </div>
          <button
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
            className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
          >
            Next →
          </button>
        </div>

        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-slate-400">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (d) => (
                      <th key={d} className="pb-2 font-medium">
                        {d}
                      </th>
                    ),
                  )}
                  <th className="pb-2 font-medium">Week</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => {
                  const weekTotalSeconds = week.reduce((sum, day) => {
                    const entry = entriesByDate.get(toISO(day));
                    return sum + (entry ? entry.seconds : 0);
                  }, 0);
                  return (
                    <tr
                      key={toISO(week[0])}
                      className="border-t border-slate-800"
                    >
                      {week.map((day) => {
                        const iso = toISO(day);
                        const entry = entriesByDate.get(iso);
                        const inMonth = isSameMonth(day, monthCursor);
                        return (
                          <td key={iso} className="p-1 align-top">
                            <button
                              onClick={() => setEditingDate(iso)}
                              className={`flex h-16 w-full flex-col items-center justify-center rounded border text-xs transition ${
                                inMonth
                                  ? "border-slate-800 text-slate-200 hover:border-indigo-500"
                                  : "border-transparent text-slate-600"
                              } ${isToday(day) ? "ring-1 ring-slate-600" : ""}`}
                            >
                              <span>{format(day, "d")}</span>
                              <span
                                className={`text-[10px] font-semibold leading-tight ${entry ? "" : "invisible"}`}
                              >
                                {entry ? formatHMS(entry.seconds) : "0:00:00"}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                      <td className="p-1 text-center text-xs font-semibold text-slate-300">
                        {weekTotalSeconds ? formatHMS(weekTotalSeconds) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {editingDate && (
          <DayEntryModal
            date={editingDate}
            entry={entriesByDate.get(editingDate)}
            onClose={() => setEditingDate(null)}
            onSaved={loadEntries}
          />
        )}
      </section>
    </div>
  );
}

function DayEntryModal({
  date,
  entry,
  onClose,
  onSaved,
}: {
  date: string;
  entry: Entry | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initial = splitHMS(entry?.seconds ?? 0);
  const [hoursInput, setHoursInput] = useState(
    entry ? String(initial.hours) : "",
  );
  const [minutesInput, setMinutesInput] = useState(
    entry ? String(initial.minutes) : "",
  );
  const [secondsInput, setSecondsInput] = useState(
    entry ? String(initial.seconds) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    hoursRef.current?.focus();
    hoursRef.current?.select();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleFieldKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const h = Number(hoursInput || 0);
    const m = Number(minutesInput || 0);
    const s = Number(secondsInput || 0);
    if (
      !Number.isInteger(h) ||
      !Number.isInteger(m) ||
      !Number.isInteger(s) ||
      h < 0 ||
      m < 0 ||
      m > 59 ||
      s < 0 ||
      s > 59
    ) {
      setError(
        "Hours, minutes, and seconds must be valid integers (minutes and seconds between 0 and 59)",
      );
      return;
    }
    const seconds = toSeconds(h, m, s);
    if (seconds > 24 * 3600) {
      setError("Total can't exceed 24 hours");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, seconds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save");
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await fetch(`/api/hours?date=${date}`, { method: "DELETE" });
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-black/60 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xs rounded-lg border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold capitalize text-slate-100">
            {format(parseISO(date), "EEEE, MMM d")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-2xl leading-none text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col text-sm text-slate-400">
              Hours
              <input
                ref={hoursRef}
                type="number"
                min={0}
                max={24}
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                onKeyDown={handleFieldKeyDown}
                placeholder="0"
                className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100 placeholder:text-slate-500"
              />
            </label>
            <label className="flex flex-1 flex-col text-sm text-slate-400">
              Minutes
              <input
                type="number"
                min={0}
                max={59}
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
                onKeyDown={handleFieldKeyDown}
                placeholder="0"
                className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100 placeholder:text-slate-500"
              />
            </label>
            <label className="flex flex-1 flex-col text-sm text-slate-400">
              Seconds
              <input
                type="number"
                min={0}
                max={59}
                value={secondsInput}
                onChange={(e) => setSecondsInput(e.target.value)}
                onKeyDown={handleFieldKeyDown}
                placeholder="0"
                className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100 placeholder:text-slate-500"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Save
            </button>
            {entry && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="text-sm text-red-400 hover:underline disabled:opacity-50"
              >
                Delete this day
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

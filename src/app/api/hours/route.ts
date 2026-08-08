import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { workEntries } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const db = getDb();
  const conditions = [eq(workEntries.userId, userId)];
  if (from) conditions.push(gte(workEntries.date, from));
  if (to) conditions.push(lte(workEntries.date, to));

  const entries = await db
    .select()
    .from(workEntries)
    .where(and(...conditions))
    .orderBy(workEntries.date);

  return NextResponse.json({ entries });
}

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  seconds: z.coerce
    .number()
    .int()
    .min(0, "Must be positive")
    .max(24 * 3600, "Maximum 24 hours"),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 },
    );
  }

  const { date, seconds } = parsed.data;
  const db = getDb();

  const [entry] = await db
    .insert(workEntries)
    .values({ userId, date, seconds })
    .onConflictDoUpdate({
      target: [workEntries.userId, workEntries.date],
      set: { seconds },
    })
    .returning();

  return NextResponse.json({ entry });
}

const deleteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = deleteSchema.safeParse({ date: searchParams.get("date") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 },
    );
  }

  const db = getDb();
  await db
    .delete(workEntries)
    .where(and(eq(workEntries.userId, userId), eq(workEntries.date, parsed.data.date)));

  return NextResponse.json({ ok: true });
}

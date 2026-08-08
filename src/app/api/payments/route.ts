import { NextResponse } from "next/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { payments, users, workEntries } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(payments.periodEnd);

  return NextResponse.json({ payments: rows });
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

const createSchema = z
  .object({
    paymentDate: dateStr,
    periodStart: dateStr,
    periodEnd: dateStr,
    amountPaid: z.coerce.number().min(0, "Must be positive"),
    note: z.string().max(500).optional(),
  })
  .refine((data) => data.periodStart <= data.periodEnd, {
    message: "Period start must be before the end",
    path: ["periodStart"],
  });

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 },
    );
  }

  const { paymentDate, periodStart, periodEnd, amountPaid, note } = parsed.data;
  const db = getDb();

  const [user] = await db
    .select({ hourlyRate: users.hourlyRate })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [{ totalSeconds }] = await db
    .select({ totalSeconds: sql<string>`coalesce(sum(${workEntries.seconds}), 0)` })
    .from(workEntries)
    .where(
      and(
        eq(workEntries.userId, userId),
        gte(workEntries.date, periodStart),
        lte(workEntries.date, periodEnd),
      ),
    );

  const hourlyRate = Number(user?.hourlyRate ?? 0);
  const expectedAmount = (Number(totalSeconds) / 3600) * hourlyRate;

  const [payment] = await db
    .insert(payments)
    .values({
      userId,
      paymentDate,
      periodStart,
      periodEnd,
      expectedAmount: expectedAmount.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      note: note || null,
    })
    .returning();

  return NextResponse.json({ payment });
}

const deleteSchema = z.object({ id: z.coerce.number().int().positive() });

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = deleteSchema.safeParse({ id: searchParams.get("id") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  await db
    .delete(payments)
    .where(and(eq(payments.userId, userId), eq(payments.id, parsed.data.id)));

  return NextResponse.json({ ok: true });
}

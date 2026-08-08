import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { paydays, users } from "@/db/schema";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const [user] = await db
    .select({ hourlyRate: users.hourlyRate })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const paydayRows = await db
    .select({ dayOfMonth: paydays.dayOfMonth })
    .from(paydays)
    .where(eq(paydays.userId, userId))
    .orderBy(paydays.dayOfMonth);

  return NextResponse.json({
    hourlyRate: user?.hourlyRate ?? "0",
    paydays: paydayRows.map((p) => p.dayOfMonth),
  });
}

const settingsSchema = z.object({
  hourlyRate: z.coerce.number().min(0, "Must be positive"),
  paydays: z
    .array(z.coerce.number().int().min(1, "Between 1 and 31").max(31, "Between 1 and 31"))
    .max(10, "Maximum 10 paydays"),
});

export async function PUT(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 },
    );
  }

  const { hourlyRate, paydays: paydayValues } = parsed.data;
  const db = getDb();

  await db.update(users).set({ hourlyRate: hourlyRate.toString() }).where(eq(users.id, userId));

  await db.delete(paydays).where(eq(paydays.userId, userId));
  const uniqueDays = Array.from(new Set(paydayValues)).sort((a, b) => a - b);
  if (uniqueDays.length > 0) {
    await db.insert(paydays).values(uniqueDays.map((dayOfMonth) => ({ userId, dayOfMonth })));
  }

  return NextResponse.json({ ok: true });
}

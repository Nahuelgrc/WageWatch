import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const registerSchema = z.object({
  username: z.string().trim().min(3, "Must be at least 3 characters").max(50),
  password: z.string().min(6, "Must be at least 6 characters"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid data" },
      { status: 400 },
    );
  }

  const { username, password } = parsed.data;
  const db = getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ username, passwordHash });

  return NextResponse.json({ ok: true });
}

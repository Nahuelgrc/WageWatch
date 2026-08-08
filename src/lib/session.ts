import { auth } from "@/auth";

export async function getSessionUserId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const id = Number(session.user.id);
  return Number.isNaN(id) ? null : id;
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Precomputed bcrypt hash with no matching plaintext, compared against on
// unknown usernames so the response time doesn't reveal whether the
// username exists (bcrypt.compare dominates the request latency either way).
const DUMMY_HASH = "$2b$10$bt.pS/tqdPRiq3uwwWvWiecKGAZTGYiYbfi9S/1tpAeNnBYCKqDDS";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!username || !password) return null;

        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          await bcrypt.compare(password, DUMMY_HASH);
          // Mirror the extra write a real failed attempt performs below, so
          // unknown vs. known usernames take the same number of DB round trips.
          await db.update(users).set({ failedAttempts: 0 }).where(eq(users.id, -1));
          return null;
        }

        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
          const attempts = user.failedAttempts + 1;
          if (attempts >= MAX_FAILED_ATTEMPTS) {
            await db
              .update(users)
              .set({ failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) })
              .where(eq(users.id, user.id));
          } else {
            await db.update(users).set({ failedAttempts: attempts }).where(eq(users.id, user.id));
          }
          return null;
        }

        if (user.failedAttempts > 0 || user.lockedUntil) {
          await db
            .update(users)
            .set({ failedAttempts: 0, lockedUntil: null })
            .where(eq(users.id, user.id));
        }

        return { id: String(user.id), name: user.username };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});

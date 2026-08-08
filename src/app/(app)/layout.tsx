import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold tracking-tight text-white">WageWatch</span>
            <nav className="flex gap-4 text-sm font-medium text-slate-400">
              <Link href="/dashboard" className="hover:text-white">
                Hours
              </Link>
              <Link href="/payments" className="hover:text-white">
                Payments
              </Link>
              <Link href="/settings" className="hover:text-white">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>{session?.user?.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

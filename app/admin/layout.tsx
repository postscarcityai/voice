import Link from "next/link";
import { SignOut } from "@/components/admin/SignOut";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/admin" className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl leading-none">Voice</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted sm:inline">
              PostScarcity AI
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {[
              ["/admin", "Clients"],
              ["/admin/requests", "Requests"],
              ["/admin/sessions", "Calls"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-muted hover:text-fg">
                {label}
              </Link>
            ))}
            <SignOut />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</div>
    </div>
  );
}

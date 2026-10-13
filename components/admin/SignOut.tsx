"use client";

import { useRouter } from "next/navigation";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
      }}
      className="rounded-md px-2.5 py-1.5 text-sm text-fg-muted hover:bg-muted hover:text-fg"
    >
      Sign out
    </button>
  );
}

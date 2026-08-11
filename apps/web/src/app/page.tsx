"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/lib/store/session";

/**
 * Redirector raíz: replantea hacia login / select-branch / pos según el
 * estado de sesión hidratada. Evita flash de contenido con un splash.
 */
export default function RootRedirect() {
  const router = useRouter();
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const user = useSessionStore((s) => s.user);
  const branches = useSessionStore((s) => s.branches);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
    } else if (branches.length === 0) {
      router.replace("/login");
    } else if (!currentBranchId) {
      router.replace("/select-branch");
    } else {
      router.replace("/pos");
    }
  }, [hasHydrated, user, branches.length, currentBranchId, router]);

  return (
      <div className="flex flex-1 items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
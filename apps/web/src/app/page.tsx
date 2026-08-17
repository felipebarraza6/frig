"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/lib/store/session";
import type { User } from "@/lib/types";

function resolveLandingPath(
  user: User | null,
  currentBranchId: string | null,
): string {
  if (!user) return "/login";
  if (user.is_superuser || user.type_user === "ADM") return "/dashboard";
  if (!currentBranchId) return "/select-branch";

  const assignment = user.branch_assignments?.find(
    (a) => String(a.branch_id) === currentBranchId,
  );
  const role = assignment?.role_code?.trim().toUpperCase();

  if (role === "OWNER") return "/dashboard";
  if (role === "CAJERO") return "/pos/terminal";
  return "/pos";
}

/**
 * Redirector raíz: replantea hacia login / select-branch / pos según el
 * estado de sesión hidratada y el rol activo. Evita flash de contenido.
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
      return;
    }
    if (branches.length === 0) {
      router.replace("/login");
      return;
    }
    router.replace(resolveLandingPath(user, currentBranchId));
  }, [hasHydrated, user, branches.length, currentBranchId, router]);

  return (
      <div className="flex flex-1 items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
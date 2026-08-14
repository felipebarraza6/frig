"use client";

import Link from "next/link";
import { FileQuestion, Home, LogIn } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function RootNotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Página no encontrada</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        La página que buscas no existe.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/pos" className={buttonVariants()}>
          <Home className="mr-2 h-4 w-4" />
          Volver al inicio
        </Link>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <LogIn className="mr-2 h-4 w-4" />
          Ir al login
        </Link>
      </div>
    </div>
  );
}

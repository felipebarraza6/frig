"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "framer-motion";
import { ApiError } from "@/lib/api/client";

const loadFeatures = () =>
  import("framer-motion").then((res) => res.domAnimation);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              if (failureCount >= 2) return false;
              if (error instanceof ApiError) {
                // No reintentar errores de autenticación o validación de cliente
                if (error.status >= 400 && error.status < 500 && error.status !== 408) {
                  return false;
                }
              }
              return true;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={loadFeatures} strict={false}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  );
}
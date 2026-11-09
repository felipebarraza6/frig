"use client";

import { useEffect, useState } from "react";
import { isOnline } from "@/lib/net/online";

export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline);

  useEffect(() => {
    const sync = () => setOnline(isOnline());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

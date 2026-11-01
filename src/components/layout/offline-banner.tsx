"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="sticky top-14 z-20 flex items-center justify-center gap-2 border-b border-[rgba(245,185,66,0.25)] bg-[rgba(245,185,66,0.1)] px-4 py-2 text-xs font-medium text-[#fbd38d] lg:top-0">
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      Você está sem conexão. Algumas ações podem falhar até a internet voltar.
    </div>
  );
}

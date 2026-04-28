"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  active: boolean;
  activeLabel?: string;
  onClick: () => Promise<void>;
  variant?: "primary" | "secondary";
}

export function ActionButton({ label, active, activeLabel, onClick, variant = "secondary" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try { await onClick(); } finally { setLoading(false); }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-60",
        variant === "primary"
          ? "bg-primary-container text-on-primary-container hover:opacity-90"
          : active
          ? "bg-surface-container-highest text-on-surface border border-outline"
          : "border border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface",
      )}
    >
      {loading ? "…" : active && activeLabel ? activeLabel : label}
    </button>
  );
}
